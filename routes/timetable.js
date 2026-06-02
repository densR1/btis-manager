// routes/timetable.js — Timetable Manager API
const express = require('express');
const router  = express.Router();

// Ambil db dari app.locals (di-set oleh server.js setelah init)
const getDb = (req) => req.app.locals.db;


// ── TAHUN AJARAN ──────────────────────────────────────────────────

router.get('/tahun-ajar', (req, res) => {
  const rows = getDb(req).prepare('SELECT * FROM tt_tahun_ajar ORDER BY id DESC').all();
  res.json({ success: true, data: rows });
});

router.post('/tahun-ajar', (req, res) => {
  try {
    const { nama, aktif } = req.body;
    if (!nama) return res.status(400).json({ success: false, message: 'nama wajib diisi' });
    if (aktif) getDb(req).prepare('UPDATE tt_tahun_ajar SET aktif = 0').run(); // hanya 1 aktif
    const result = getDb(req).prepare('INSERT INTO tt_tahun_ajar (nama, aktif) VALUES (?, ?)').run(nama, aktif ? 1 : 0);
    res.status(201).json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/tahun-ajar/:id/aktif', (req, res) => {
  getDb(req).prepare('UPDATE tt_tahun_ajar SET aktif = 0').run();
  getDb(req).prepare('UPDATE tt_tahun_ajar SET aktif = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.delete('/tahun-ajar/:id', (req, res) => {
  getDb(req).prepare('DELETE FROM tt_tahun_ajar WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── KELAS ─────────────────────────────────────────────────────────

router.get('/kelas', (req, res) => {
  const ta_id = req.query.ta_id;
  const rows = ta_id
    ? getDb(req).prepare('SELECT * FROM tt_kelas WHERE ta_id = ? ORDER BY tingkat, parallel').all(ta_id)
    : getDb(req).prepare('SELECT * FROM tt_kelas ORDER BY tingkat, parallel').all();
  res.json({ success: true, data: rows });
});

router.post('/kelas', (req, res) => {
  try {
    const { nama, tingkat, parallel, ta_id } = req.body;
    if (!nama) return res.status(400).json({ success: false, message: 'nama wajib diisi' });
    const result = getDb(req).prepare('INSERT INTO tt_kelas (nama, tingkat, parallel, ta_id) VALUES (?, ?, ?, ?)').run(nama, tingkat||'', parallel||'', ta_id||null);
    res.status(201).json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/kelas/:id', (req, res) => {
  const { nama, tingkat, parallel } = req.body;
  getDb(req).prepare('UPDATE tt_kelas SET nama=?, tingkat=?, parallel=? WHERE id=?').run(nama, tingkat||'', parallel||'', req.params.id);
  res.json({ success: true });
});

router.delete('/kelas/:id', (req, res) => {
  getDb(req).prepare('DELETE FROM tt_kelas WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── GURU ──────────────────────────────────────────────────────────

router.get('/guru', (req, res) => {
  const ta_id = req.query.ta_id;
  const rows = ta_id
    ? getDb(req).prepare('SELECT * FROM tt_guru WHERE ta_id = ? ORDER BY nama').all(ta_id)
    : getDb(req).prepare('SELECT * FROM tt_guru ORDER BY nama').all();
  res.json({ success: true, data: rows });
});

router.post('/guru', (req, res) => {
  try {
    const { nama, kode, mapel, max_jp, ta_id } = req.body;
    if (!nama) return res.status(400).json({ success: false, message: 'nama wajib diisi' });
    const result = getDb(req).prepare('INSERT INTO tt_guru (nama, kode, mapel, max_jp, ta_id) VALUES (?, ?, ?, ?, ?)').run(nama, kode||'', mapel||'', max_jp||24, ta_id||null);
    res.status(201).json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/guru/:id', (req, res) => {
  const { nama, kode, mapel, max_jp } = req.body;
  getDb(req).prepare('UPDATE tt_guru SET nama=?, kode=?, mapel=?, max_jp=? WHERE id=?').run(nama, kode||'', mapel||'', max_jp||24, req.params.id);
  res.json({ success: true });
});

router.delete('/guru/:id', (req, res) => {
  getDb(req).prepare('DELETE FROM tt_guru WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── MAPEL ─────────────────────────────────────────────────────────

router.get('/mapel', (req, res) => {
  const ta_id = req.query.ta_id;
  const rows = ta_id
    ? getDb(req).prepare('SELECT * FROM tt_mapel WHERE ta_id = ? ORDER BY nama').all(ta_id)
    : getDb(req).prepare('SELECT * FROM tt_mapel ORDER BY nama').all();
  res.json({ success: true, data: rows });
});

router.post('/mapel', (req, res) => {
  try {
    const { nama, kode, warna, ta_id } = req.body;
    if (!nama) return res.status(400).json({ success: false, message: 'nama wajib diisi' });
    const result = getDb(req).prepare('INSERT INTO tt_mapel (nama, kode, warna, ta_id) VALUES (?, ?, ?, ?)').run(nama, kode||'', warna||'#1a3a6b', ta_id||null);
    res.status(201).json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/mapel/:id', (req, res) => {
  const { nama, kode, warna } = req.body;
  getDb(req).prepare('UPDATE tt_mapel SET nama=?, kode=?, warna=? WHERE id=?').run(nama, kode||'', warna||'#1a3a6b', req.params.id);
  res.json({ success: true });
});

router.delete('/mapel/:id', (req, res) => {
  getDb(req).prepare('DELETE FROM tt_mapel WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── JADWAL ────────────────────────────────────────────────────────

// GET /api/timetable/jadwal?kelas_id=1&ta_id=1
router.get('/jadwal', (req, res) => {
  try {
    let query = `
      SELECT j.*,
        k.nama as kelas_nama,
        g.nama as guru_nama, g.kode as guru_kode,
        m.nama as mapel_nama, m.warna as mapel_warna
      FROM tt_jadwal j
      LEFT JOIN tt_kelas  k ON j.kelas_id  = k.id
      LEFT JOIN tt_guru   g ON j.guru_id   = g.id
      LEFT JOIN tt_mapel  m ON j.mapel_id  = m.id
      WHERE 1=1
    `;
    const params = [];
    if (req.query.kelas_id) { query += ' AND j.kelas_id = ?'; params.push(req.query.kelas_id); }
    if (req.query.guru_id)  { query += ' AND j.guru_id = ?';  params.push(req.query.guru_id); }
    if (req.query.ta_id)    { query += ' AND j.ta_id = ?';    params.push(req.query.ta_id); }
    query += ' ORDER BY CASE j.hari WHEN "Senin" THEN 1 WHEN "Selasa" THEN 2 WHEN "Rabu" THEN 3 WHEN "Kamis" THEN 4 WHEN "Jumat" THEN 5 WHEN "Sabtu" THEN 6 ELSE 7 END, j.jam_ke ASC';
    const rows = getDb(req).prepare(query).all(...params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/timetable/jadwal
router.post('/jadwal', (req, res) => {
  try {
    const { kelas_id, guru_id, mapel_id, hari, jam_ke, ta_id } = req.body;
    if (!kelas_id || !hari || !jam_ke) return res.status(400).json({ success: false, message: 'kelas_id, hari, jam_ke wajib diisi' });

    // Cek bentrok guru
    if (guru_id) {
      const bentrok = getDb(req).prepare('SELECT id FROM tt_jadwal WHERE guru_id=? AND hari=? AND jam_ke=? AND ta_id=?').get(guru_id, hari, jam_ke, ta_id);
      if (bentrok) return res.status(409).json({ success: false, message: 'Guru sudah mengajar di slot yang sama' });
    }

    const result = getDb(req).prepare('INSERT INTO tt_jadwal (kelas_id, guru_id, mapel_id, hari, jam_ke, ta_id) VALUES (?, ?, ?, ?, ?, ?)').run(kelas_id, guru_id||null, mapel_id||null, hari, jam_ke, ta_id||null);
    res.status(201).json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/timetable/jadwal/:id
router.put('/jadwal/:id', (req, res) => {
  try {
    const { guru_id, mapel_id, hari, jam_ke } = req.body;
    getDb(req).prepare('UPDATE tt_jadwal SET guru_id=?, mapel_id=?, hari=?, jam_ke=? WHERE id=?').run(guru_id||null, mapel_id||null, hari, jam_ke, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/timetable/jadwal/:id
router.delete('/jadwal/:id', (req, res) => {
  getDb(req).prepare('DELETE FROM tt_jadwal WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
