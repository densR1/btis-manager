// routes/teacher.js — Teacher Manager API
const express = require('express');
const router  = express.Router();

const getDb = (req) => req.app.locals.db;

// GET /api/teacher
router.get('/', async (req, res) => {
  try {
    let query = 'SELECT * FROM teachers WHERE 1=1';
    const params = [];
    if (req.query.status) { query += ' AND status = ?'; params.push(req.query.status); }
    if (req.query.mapel)  { query += ' AND (mapel_utama LIKE ? OR mapel_lain LIKE ?)'; params.push(`%${req.query.mapel}%`, `%${req.query.mapel}%`); }
    if (req.query.q)      { query += ' AND nama LIKE ?'; params.push(`%${req.query.q}%`); }
    query += ' ORDER BY nama ASC';
    const rows = await getDb(req).query(query, params);
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/teacher/stats
router.get('/stats', async (req, res) => {
  try {
    const total    = await getDb(req).queryOne('SELECT COUNT(*) as c FROM teachers');
    const aktif    = await getDb(req).queryOne("SELECT COUNT(*) as c FROM teachers WHERE status='aktif'");
    const cuti     = await getDb(req).queryOne("SELECT COUNT(*) as c FROM teachers WHERE status='cuti'");
    const nonaktif = await getDb(req).queryOne("SELECT COUNT(*) as c FROM teachers WHERE status='non-aktif'");
    const laki     = await getDb(req).queryOne("SELECT COUNT(*) as c FROM teachers WHERE jenis_kelamin='L'");
    const perempuan= await getDb(req).queryOne("SELECT COUNT(*) as c FROM teachers WHERE jenis_kelamin='P'");
    res.json({ success: true, data: {
      total: total.c, aktif: aktif.c, cuti: cuti.c,
      nonaktif: nonaktif.c, laki: laki.c, perempuan: perempuan.c
    }});
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── TEACHER DUTY (dokumen tugas guru) ────────────────────────────
// Catatan: rute /duty* HARUS sebelum /:id agar tidak tertangkap sebagai id.
const DUTY_MAX = 5 * 1024 * 1024; // 5MB (ukuran file asli)
const DUTY_MIME_OK = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

// GET /api/teacher/duty — list metadata (tanpa base64 data biar ringan)
router.get('/duty', async (req, res) => {
  try {
    const rows = await getDb(req).query(
      'SELECT id, judul, keterangan, filename, mime, size, created_at, updated_at FROM teacher_duty ORDER BY created_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/teacher/duty/:id/download — kirim file
router.get('/duty/:id/download', async (req, res) => {
  try {
    const row = await getDb(req).queryOne('SELECT filename, mime, data FROM teacher_duty WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ success: false, message: 'Dokumen tidak ditemukan' });
    const buf = Buffer.from(row.data, 'base64');
    res.setHeader('Content-Type', row.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', 'inline; filename="' + encodeURIComponent(row.filename || 'dokumen') + '"');
    res.send(buf);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/teacher/duty — upload dokumen baru
router.post('/duty', async (req, res) => {
  try {
    const { judul, keterangan, filename, mime, size, data } = req.body;
    if (!judul || !judul.trim()) return res.status(400).json({ success: false, message: 'Judul wajib diisi' });
    if (!data) return res.status(400).json({ success: false, message: 'File wajib diunggah' });
    if (mime && !DUTY_MIME_OK.includes(mime)) return res.status(400).json({ success: false, message: 'Hanya file PDF atau Word yang diperbolehkan' });
    if (size && size > DUTY_MAX) return res.status(400).json({ success: false, message: 'Ukuran file maksimal 5MB' });
    const result = await getDb(req).execute(
      'INSERT INTO teacher_duty (judul, keterangan, filename, mime, size, data) VALUES (?, ?, ?, ?, ?, ?)',
      [judul.trim(), keterangan || '', filename || '', mime || '', size || 0, data]
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT /api/teacher/duty/:id — edit judul/keterangan (dan opsional ganti file)
router.put('/duty/:id', async (req, res) => {
  try {
    const { judul, keterangan, filename, mime, size, data } = req.body;
    if (!judul || !judul.trim()) return res.status(400).json({ success: false, message: 'Judul wajib diisi' });
    let result;
    if (data) { // ganti file sekalian
      if (mime && !DUTY_MIME_OK.includes(mime)) return res.status(400).json({ success: false, message: 'Hanya file PDF atau Word yang diperbolehkan' });
      if (size && size > DUTY_MAX) return res.status(400).json({ success: false, message: 'Ukuran file maksimal 5MB' });
      result = await getDb(req).execute(
        'UPDATE teacher_duty SET judul=?, keterangan=?, filename=?, mime=?, size=?, data=?, updated_at=NOW() WHERE id=?',
        [judul.trim(), keterangan || '', filename || '', mime || '', size || 0, data, req.params.id]
      );
    } else { // hanya metadata
      result = await getDb(req).execute(
        'UPDATE teacher_duty SET judul=?, keterangan=?, updated_at=NOW() WHERE id=?',
        [judul.trim(), keterangan || '', req.params.id]
      );
    }
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Dokumen tidak ditemukan' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DELETE /api/teacher/duty/:id
router.delete('/duty/:id', async (req, res) => {
  const result = await getDb(req).execute('DELETE FROM teacher_duty WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Dokumen tidak ditemukan' });
  res.json({ success: true });
});

// GET /api/teacher/:id
router.get('/:id', async (req, res) => {
  const row = await getDb(req).queryOne('SELECT * FROM teachers WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ success: false, message: 'Guru tidak ditemukan' });
  res.json({ success: true, data: row });
});

// POST /api/teacher
router.post('/', async (req, res) => {
  try {
    const { nip, nama, jenis_kelamin, jabatan, mapel_utama, mapel_lain, status, no_hp, email, alamat, tanggal_masuk, catatan } = req.body;
    if (!nama || !nama.trim()) return res.status(400).json({ success: false, message: 'Nama wajib diisi' });
    const result = await getDb(req).execute(
      'INSERT INTO teachers (nip, nama, jenis_kelamin, jabatan, mapel_utama, mapel_lain, status, no_hp, email, alamat, tanggal_masuk, catatan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [nip || '', nama.trim(), jenis_kelamin || '', jabatan || '', mapel_utama || '', mapel_lain || '', status || 'aktif', no_hp || '', email || '', alamat || '', tanggal_masuk || null, catatan || '']
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/teacher/:id
router.put('/:id', async (req, res) => {
  try {
    const { nip, nama, jenis_kelamin, jabatan, mapel_utama, mapel_lain, status, no_hp, email, alamat, tanggal_masuk, catatan } = req.body;
    if (!nama || !nama.trim()) return res.status(400).json({ success: false, message: 'Nama wajib diisi' });
    const result = await getDb(req).execute(
      'UPDATE teachers SET nip=?, nama=?, jenis_kelamin=?, jabatan=?, mapel_utama=?, mapel_lain=?, status=?, no_hp=?, email=?, alamat=?, tanggal_masuk=?, catatan=?, updated_at=NOW() WHERE id=?',
      [nip || '', nama.trim(), jenis_kelamin || '', jabatan || '', mapel_utama || '', mapel_lain || '', status || 'aktif', no_hp || '', email || '', alamat || '', tanggal_masuk || null, catatan || '', req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Guru tidak ditemukan' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/teacher/:id
router.delete('/:id', async (req, res) => {
  const result = await getDb(req).execute('DELETE FROM teachers WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Guru tidak ditemukan' });
  res.json({ success: true });
});

module.exports = router;
