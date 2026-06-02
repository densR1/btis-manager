// routes/calendar.js — Academic Calendar Manager API
const express = require('express');
const router  = express.Router();

// Ambil db dari app.locals (di-set oleh server.js setelah init)
const getDb = (req) => req.app.locals.db;


// GET /api/calendar?tahun_ajar=2025/2026&semester=ganjil
router.get('/', (req, res) => {
  try {
    let query = 'SELECT * FROM kalender_events WHERE 1=1';
    const params = [];
    if (req.query.tahun_ajar) { query += ' AND tahun_ajar = ?'; params.push(req.query.tahun_ajar); }
    if (req.query.semester)   { query += ' AND semester = ?';   params.push(req.query.semester); }
    if (req.query.tipe)       { query += ' AND tipe = ?';       params.push(req.query.tipe); }
    query += ' ORDER BY tanggal ASC';
    const rows = getDb(req).prepare(query).all(...params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/calendar/:id
router.get('/:id', (req, res) => {
  const row = getDb(req).prepare('SELECT * FROM kalender_events WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: 'Event tidak ditemukan' });
  res.json({ success: true, data: row });
});

// POST /api/calendar
router.post('/', (req, res) => {
  try {
    const { tanggal, nama, tipe, he, semester, tahun_ajar, catatan } = req.body;
    if (!tanggal || !nama) return res.status(400).json({ success: false, message: 'tanggal dan nama wajib diisi' });
    const result = getDb(req).prepare(`
      INSERT INTO kalender_events (tanggal, nama, tipe, he, semester, tahun_ajar, catatan)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(tanggal, nama, tipe || 'kegiatan', he ?? 1, semester || '', tahun_ajar || '', catatan || '');
    res.status(201).json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/calendar/bulk — tambah banyak event sekaligus
router.post('/bulk', (req, res) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events) || events.length === 0)
      return res.status(400).json({ success: false, message: 'events harus berupa array' });
    const insert = getDb(req).prepare(`
      INSERT INTO kalender_events (tanggal, nama, tipe, he, semester, tahun_ajar, catatan)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMany = getDb(req).transaction((evs) => {
      for (const e of evs) insert.run(e.tanggal, e.nama, e.tipe || 'kegiatan', e.he ?? 1, e.semester || '', e.tahun_ajar || '', e.catatan || '');
    });
    insertMany(events);
    res.status(201).json({ success: true, count: events.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/calendar/:id
router.put('/:id', (req, res) => {
  try {
    const { tanggal, nama, tipe, he, semester, tahun_ajar, catatan } = req.body;
    const result = getDb(req).prepare(`
      UPDATE kalender_events SET tanggal=?, nama=?, tipe=?, he=?, semester=?, tahun_ajar=?, catatan=?
      WHERE id=?
    `).run(tanggal, nama, tipe, he, semester, tahun_ajar, catatan, req.params.id);
    if (result.changes === 0) return res.status(404).json({ success: false, message: 'Event tidak ditemukan' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/calendar/:id
router.delete('/:id', (req, res) => {
  const result = getDb(req).prepare('DELETE FROM kalender_events WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ success: false, message: 'Event tidak ditemukan' });
  res.json({ success: true });
});

// DELETE /api/calendar/tahun/:tahun_ajar — hapus semua event per tahun ajaran
router.delete('/tahun/:tahun_ajar', (req, res) => {
  const result = getDb(req).prepare('DELETE FROM kalender_events WHERE tahun_ajar = ?').run(req.params.tahun_ajar);
  res.json({ success: true, deleted: result.changes });
});

module.exports = router;
