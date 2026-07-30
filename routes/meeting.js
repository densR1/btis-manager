// routes/meeting.js — Event Manager API
const express = require('express');
const router  = express.Router();

const getDb = (req) => req.app.locals.db;

// GET /api/meeting/data — ambil pics, notulen, evaluasi (harus sebelum /:id)
router.get('/data', async (req, res) => {
  try {
    const db = getDb(req);
    const upsert = async (key, def) => {
      const row = await db.queryOne("SELECT value FROM calendar_settings WHERE `key` = ?", [key]);
      return row ? JSON.parse(row.value) : def;
    };
    const meetings = await upsert('meeting_meetings', []);
    const pics     = await upsert('meeting_pics',     []);
    const notulen  = await upsert('meeting_notulen',  []);
    const evaluasi = await upsert('meeting_evaluasi', []);
    res.json({ success: true, meetings, pics, notulen, evaluasi });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT /api/meeting/data — simpan pics, notulen, evaluasi
router.put('/data', async (req, res) => {
  try {
    const db = getDb(req);
    const save = (key, val) => db.execute(
      "INSERT INTO calendar_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?",
      [key, val, val]
    );
    const { meetings, pics, notulen, evaluasi } = req.body;
    if (meetings !== undefined) await save('meeting_meetings', JSON.stringify(meetings));
    if (pics     !== undefined) await save('meeting_pics',     JSON.stringify(pics));
    if (notulen  !== undefined) await save('meeting_notulen',  JSON.stringify(notulen));
    if (evaluasi !== undefined) await save('meeting_evaluasi', JSON.stringify(evaluasi));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/meeting
router.get('/', async (req, res) => {
  try {
    let query = 'SELECT * FROM meetings WHERE 1=1';
    const params = [];
    if (req.query.status) { query += ' AND status = ?';    params.push(req.query.status); }
    if (req.query.dari)   { query += ' AND tanggal >= ?';  params.push(req.query.dari); }
    if (req.query.sampai) { query += ' AND tanggal <= ?';  params.push(req.query.sampai); }
    query += ' ORDER BY tanggal DESC, waktu_mulai ASC';
    const rows = await getDb(req).query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/meeting/:id
router.get('/:id', async (req, res) => {
  const meeting = await getDb(req).queryOne('SELECT * FROM meetings WHERE id = ?', [req.params.id]);
  if (!meeting) return res.status(404).json({ success: false, message: 'Meeting tidak ditemukan' });
  const peserta = await getDb(req).query('SELECT * FROM meeting_peserta WHERE meeting_id = ? ORDER BY id', [req.params.id]);
  res.json({ success: true, data: { ...meeting, peserta } });
});

// POST /api/meeting
router.post('/', async (req, res) => {
  try {
    const { judul, tanggal, waktu_mulai, waktu_selesai, tempat, pimpinan, agenda, notulensi, status, peserta } = req.body;
    if (!judul || !tanggal) return res.status(400).json({ success: false, message: 'judul dan tanggal wajib diisi' });

    const result = await getDb(req).execute(
      'INSERT INTO meetings (judul, tanggal, waktu_mulai, waktu_selesai, tempat, pimpinan, agenda, notulensi, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [judul, tanggal, waktu_mulai || '', waktu_selesai || '', tempat || '', pimpinan || '', agenda || '', notulensi || '', status || 'terjadwal']
    );
    const meetingId = result.insertId;

    if (Array.isArray(peserta) && peserta.length > 0) {
      await getDb(req).transaction(async (conn) => {
        for (const p of peserta) {
          await conn.execute(
            'INSERT INTO meeting_peserta (meeting_id, nama, jabatan, hadir) VALUES (?, ?, ?, ?)',
            [meetingId, p.nama, p.jabatan || '', p.hadir ?? 0]
          );
        }
      });
    }

    res.status(201).json({ success: true, id: meetingId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/meeting/:id
router.put('/:id', async (req, res) => {
  try {
    const { judul, tanggal, waktu_mulai, waktu_selesai, tempat, pimpinan, agenda, notulensi, status, peserta } = req.body;

    const result = await getDb(req).execute(
      'UPDATE meetings SET judul=?, tanggal=?, waktu_mulai=?, waktu_selesai=?, tempat=?, pimpinan=?, agenda=?, notulensi=?, status=?, updated_at=NOW() WHERE id=?',
      [judul, tanggal, waktu_mulai || '', waktu_selesai || '', tempat || '', pimpinan || '', agenda || '', notulensi || '', status || 'terjadwal', req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Meeting tidak ditemukan' });

    if (Array.isArray(peserta)) {
      await getDb(req).execute('DELETE FROM meeting_peserta WHERE meeting_id = ?', [req.params.id]);
      if (peserta.length > 0) {
        await getDb(req).transaction(async (conn) => {
          for (const p of peserta) {
            await conn.execute(
              'INSERT INTO meeting_peserta (meeting_id, nama, jabatan, hadir) VALUES (?, ?, ?, ?)',
              [req.params.id, p.nama, p.jabatan || '', p.hadir ?? 0]
            );
          }
        });
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/meeting/:id/status
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  const allowed = ['terjadwal', 'berlangsung', 'selesai', 'dibatalkan'];
  if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Status tidak valid' });
  const result = await getDb(req).execute('UPDATE meetings SET status=?, updated_at=NOW() WHERE id=?', [status, req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Meeting tidak ditemukan' });
  res.json({ success: true });
});

// PATCH /api/meeting/:id/peserta/:pid/hadir
router.patch('/:id/peserta/:pid/hadir', async (req, res) => {
  const { hadir } = req.body;
  await getDb(req).execute('UPDATE meeting_peserta SET hadir=? WHERE id=? AND meeting_id=?', [hadir, req.params.pid, req.params.id]);
  res.json({ success: true });
});

// DELETE /api/meeting/:id
router.delete('/:id', async (req, res) => {
  const result = await getDb(req).execute('DELETE FROM meetings WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Meeting tidak ditemukan' });
  res.json({ success: true });
});

module.exports = router;
