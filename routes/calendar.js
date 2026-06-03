// routes/calendar.js — Academic Calendar Manager API
const express = require('express');
const router  = express.Router();

const getDb = (req) => req.app.locals.db;

// GET /api/calendar
router.get('/', async (req, res) => {
  try {
    let query = 'SELECT * FROM kalender_events WHERE 1=1';
    const params = [];
    if (req.query.tahun_ajar) { query += ' AND tahun_ajar = ?'; params.push(req.query.tahun_ajar); }
    if (req.query.semester)   { query += ' AND semester = ?';   params.push(req.query.semester); }
    if (req.query.tipe)       { query += ' AND tipe = ?';       params.push(req.query.tipe); }
    query += ' ORDER BY tanggal ASC';
    const rows = await getDb(req).query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/calendar/:id
router.get('/:id', async (req, res) => {
  const row = await getDb(req).queryOne('SELECT * FROM kalender_events WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ success: false, message: 'Event tidak ditemukan' });
  res.json({ success: true, data: row });
});

// POST /api/calendar
router.post('/', async (req, res) => {
  try {
    const { tanggal, nama, tipe, he, semester, tahun_ajar, catatan } = req.body;
    if (!tanggal || !nama) return res.status(400).json({ success: false, message: 'tanggal dan nama wajib diisi' });
    const result = await getDb(req).execute(
      'INSERT INTO kalender_events (tanggal, nama, tipe, he, semester, tahun_ajar, catatan) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [tanggal, nama, tipe || 'kegiatan', he ?? 1, semester || '', tahun_ajar || '', catatan || '']
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/calendar/bulk
router.post('/bulk', async (req, res) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events) || events.length === 0)
      return res.status(400).json({ success: false, message: 'events harus berupa array' });

    await getDb(req).transaction(async (conn) => {
      for (const e of events) {
        await conn.execute(
          'INSERT INTO kalender_events (tanggal, nama, tipe, he, semester, tahun_ajar, catatan) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [e.tanggal, e.nama, e.tipe || 'kegiatan', e.he ?? 1, e.semester || '', e.tahun_ajar || '', e.catatan || '']
        );
      }
    });

    res.status(201).json({ success: true, count: events.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/calendar/:id
router.put('/:id', async (req, res) => {
  try {
    const { tanggal, nama, tipe, he, semester, tahun_ajar, catatan } = req.body;
    const result = await getDb(req).execute(
      'UPDATE kalender_events SET tanggal=?, nama=?, tipe=?, he=?, semester=?, tahun_ajar=?, catatan=? WHERE id=?',
      [tanggal, nama, tipe, he, semester, tahun_ajar, catatan, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Event tidak ditemukan' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/calendar/:id
router.delete('/:id', async (req, res) => {
  const result = await getDb(req).execute('DELETE FROM kalender_events WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Event tidak ditemukan' });
  res.json({ success: true });
});

// DELETE /api/calendar/tahun/:tahun_ajar
router.delete('/tahun/:tahun_ajar', async (req, res) => {
  const result = await getDb(req).execute('DELETE FROM kalender_events WHERE tahun_ajar = ?', [req.params.tahun_ajar]);
  res.json({ success: true, deleted: result.affectedRows });
});

module.exports = router;
