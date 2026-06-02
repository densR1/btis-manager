// routes/meeting.js — Meeting Manager API
const express = require('express');
const router  = express.Router();

// Ambil db dari app.locals (di-set oleh server.js setelah init)
const getDb = (req) => req.app.locals.db;


// GET /api/meeting?status=terjadwal
router.get('/', (req, res) => {
  try {
    let query = 'SELECT * FROM meetings WHERE 1=1';
    const params = [];
    if (req.query.status) { query += ' AND status = ?'; params.push(req.query.status); }
    if (req.query.dari)   { query += ' AND tanggal >= ?'; params.push(req.query.dari); }
    if (req.query.sampai) { query += ' AND tanggal <= ?'; params.push(req.query.sampai); }
    query += ' ORDER BY tanggal DESC, waktu_mulai ASC';
    const rows = getDb(req).prepare(query).all(...params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/meeting/:id — detail lengkap + peserta
router.get('/:id', (req, res) => {
  const meeting = getDb(req).prepare('SELECT * FROM meetings WHERE id = ?').get(req.params.id);
  if (!meeting) return res.status(404).json({ success: false, message: 'Meeting tidak ditemukan' });
  const peserta = getDb(req).prepare('SELECT * FROM meeting_peserta WHERE meeting_id = ? ORDER BY id').all(req.params.id);
  res.json({ success: true, data: { ...meeting, peserta } });
});

// POST /api/meeting
router.post('/', (req, res) => {
  try {
    const { judul, tanggal, waktu_mulai, waktu_selesai, tempat, pimpinan, agenda, notulensi, status, peserta } = req.body;
    if (!judul || !tanggal) return res.status(400).json({ success: false, message: 'judul dan tanggal wajib diisi' });

    const result = getDb(req).prepare(`
      INSERT INTO meetings (judul, tanggal, waktu_mulai, waktu_selesai, tempat, pimpinan, agenda, notulensi, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(judul, tanggal, waktu_mulai || '', waktu_selesai || '', tempat || '', pimpinan || '', agenda || '', notulensi || '', status || 'terjadwal');

    const meetingId = result.lastInsertRowid;

    // Tambah peserta jika ada
    if (Array.isArray(peserta) && peserta.length > 0) {
      const insertPeserta = getDb(req).prepare('INSERT INTO meeting_peserta (meeting_id, nama, jabatan, hadir) VALUES (?, ?, ?, ?)');
      const insertMany = getDb(req).transaction((list) => {
        for (const p of list) insertPeserta.run(meetingId, p.nama, p.jabatan || '', p.hadir ?? 0);
      });
      insertMany(peserta);
    }

    res.status(201).json({ success: true, id: meetingId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/meeting/:id
router.put('/:id', (req, res) => {
  try {
    const { judul, tanggal, waktu_mulai, waktu_selesai, tempat, pimpinan, agenda, notulensi, status, peserta } = req.body;

    const result = getDb(req).prepare(`
      UPDATE meetings SET judul=?, tanggal=?, waktu_mulai=?, waktu_selesai=?, tempat=?,
        pimpinan=?, agenda=?, notulensi=?, status=?, updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(judul, tanggal, waktu_mulai || '', waktu_selesai || '', tempat || '', pimpinan || '', agenda || '', notulensi || '', status || 'terjadwal', req.params.id);

    if (result.changes === 0) return res.status(404).json({ success: false, message: 'Meeting tidak ditemukan' });

    // Update peserta: hapus lama, masukkan baru
    if (Array.isArray(peserta)) {
      getDb(req).prepare('DELETE FROM meeting_peserta WHERE meeting_id = ?').run(req.params.id);
      if (peserta.length > 0) {
        const ins = getDb(req).prepare('INSERT INTO meeting_peserta (meeting_id, nama, jabatan, hadir) VALUES (?, ?, ?, ?)');
        getDb(req).transaction((list) => { for (const p of list) ins.run(req.params.id, p.nama, p.jabatan || '', p.hadir ?? 0); })(peserta);
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/meeting/:id/status — ubah status saja
router.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  const allowed = ['terjadwal', 'berlangsung', 'selesai', 'dibatalkan'];
  if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Status tidak valid' });
  const result = getDb(req).prepare(`UPDATE meetings SET status=?, updated_at=datetime('now','localtime') WHERE id=?`).run(status, req.params.id);
  if (result.changes === 0) return res.status(404).json({ success: false, message: 'Meeting tidak ditemukan' });
  res.json({ success: true });
});

// PATCH /api/meeting/:id/peserta/:pid/hadir — update kehadiran
router.patch('/:id/peserta/:pid/hadir', (req, res) => {
  const { hadir } = req.body;
  getDb(req).prepare('UPDATE meeting_peserta SET hadir=? WHERE id=? AND meeting_id=?').run(hadir, req.params.pid, req.params.id);
  res.json({ success: true });
});

// DELETE /api/meeting/:id
router.delete('/:id', (req, res) => {
  const result = getDb(req).prepare('DELETE FROM meetings WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ success: false, message: 'Meeting tidak ditemukan' });
  res.json({ success: true });
});

module.exports = router;
