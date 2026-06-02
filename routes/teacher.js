// routes/teacher.js — Teacher Manager API
const express = require('express');
const router  = express.Router();

// Ambil db dari app.locals (di-set oleh server.js setelah init)
const getDb = (req) => req.app.locals.db;


// GET /api/teacher?status=aktif&mapel=Matematika
router.get('/', (req, res) => {
  try {
    let query = 'SELECT * FROM teachers WHERE 1=1';
    const params = [];
    if (req.query.status) { query += ' AND status = ?'; params.push(req.query.status); }
    if (req.query.mapel)  { query += ' AND (mapel_utama LIKE ? OR mapel_lain LIKE ?)'; params.push(`%${req.query.mapel}%`, `%${req.query.mapel}%`); }
    if (req.query.q)      { query += ' AND nama LIKE ?'; params.push(`%${req.query.q}%`); }
    query += ' ORDER BY nama ASC';
    const rows = getDb(req).prepare(query).all(...params);
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/teacher/stats — ringkasan statistik
router.get('/stats', (req, res) => {
  try {
    const total    = getDb(req).prepare("SELECT COUNT(*) as c FROM teachers").get().c;
    const aktif    = getDb(req).prepare("SELECT COUNT(*) as c FROM teachers WHERE status='aktif'").get().c;
    const cuti     = getDb(req).prepare("SELECT COUNT(*) as c FROM teachers WHERE status='cuti'").get().c;
    const nonaktif = getDb(req).prepare("SELECT COUNT(*) as c FROM teachers WHERE status='non-aktif'").get().c;
    const laki     = getDb(req).prepare("SELECT COUNT(*) as c FROM teachers WHERE jenis_kelamin='L'").get().c;
    const perempuan= getDb(req).prepare("SELECT COUNT(*) as c FROM teachers WHERE jenis_kelamin='P'").get().c;
    res.json({ success: true, data: { total, aktif, cuti, nonaktif, laki, perempuan } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/teacher/:id
router.get('/:id', (req, res) => {
  const row = getDb(req).prepare('SELECT * FROM teachers WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: 'Guru tidak ditemukan' });
  res.json({ success: true, data: row });
});

// POST /api/teacher
router.post('/', (req, res) => {
  try {
    const { nip, nama, jenis_kelamin, jabatan, mapel_utama, mapel_lain, status, no_hp, email, alamat, tanggal_masuk, catatan } = req.body;
    if (!nama || !nama.trim()) return res.status(400).json({ success: false, message: 'Nama wajib diisi' });

    const result = getDb(req).prepare(`
      INSERT INTO teachers (nip, nama, jenis_kelamin, jabatan, mapel_utama, mapel_lain, status, no_hp, email, alamat, tanggal_masuk, catatan)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(nip||'', nama.trim(), jenis_kelamin||'', jabatan||'', mapel_utama||'', mapel_lain||'', status||'aktif', no_hp||'', email||'', alamat||'', tanggal_masuk||'', catatan||'');

    res.status(201).json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/teacher/:id
router.put('/:id', (req, res) => {
  try {
    const { nip, nama, jenis_kelamin, jabatan, mapel_utama, mapel_lain, status, no_hp, email, alamat, tanggal_masuk, catatan } = req.body;
    if (!nama || !nama.trim()) return res.status(400).json({ success: false, message: 'Nama wajib diisi' });

    const result = getDb(req).prepare(`
      UPDATE teachers SET nip=?, nama=?, jenis_kelamin=?, jabatan=?, mapel_utama=?, mapel_lain=?,
        status=?, no_hp=?, email=?, alamat=?, tanggal_masuk=?, catatan=?, updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(nip||'', nama.trim(), jenis_kelamin||'', jabatan||'', mapel_utama||'', mapel_lain||'', status||'aktif', no_hp||'', email||'', alamat||'', tanggal_masuk||'', catatan||'', req.params.id);

    if (result.changes === 0) return res.status(404).json({ success: false, message: 'Guru tidak ditemukan' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/teacher/:id
router.delete('/:id', (req, res) => {
  const result = getDb(req).prepare('DELETE FROM teachers WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ success: false, message: 'Guru tidak ditemukan' });
  res.json({ success: true });
});

module.exports = router;
