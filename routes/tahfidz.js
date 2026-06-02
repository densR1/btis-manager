// routes/tahfidz.js — Tahfidz Manager API
const express = require('express');
const router  = express.Router();

// Ambil db dari app.locals (di-set oleh server.js setelah init)
const getDb = (req) => req.app.locals.db;


// ── SISWA ─────────────────────────────────────────────────────────

// GET /api/tahfidz/siswa?kelas=7A&musyrif=Ustadz+Ali
router.get('/siswa', (req, res) => {
  try {
    let query = 'SELECT * FROM tahfidz_siswa WHERE 1=1';
    const params = [];
    if (req.query.kelas)   { query += ' AND kelas = ?';     params.push(req.query.kelas); }
    if (req.query.musyrif) { query += ' AND musyrif LIKE ?'; params.push(`%${req.query.musyrif}%`); }
    if (req.query.status)  { query += ' AND status = ?';    params.push(req.query.status); }
    if (req.query.q)       { query += ' AND nama LIKE ?';   params.push(`%${req.query.q}%`); }
    query += ' ORDER BY kelas ASC, nama ASC';
    const rows = getDb(req).prepare(query).all(...params);
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/tahfidz/siswa/:id — detail + rekap setoran
router.get('/siswa/:id', (req, res) => {
  const siswa = getDb(req).prepare('SELECT * FROM tahfidz_siswa WHERE id = ?').get(req.params.id);
  if (!siswa) return res.status(404).json({ success: false, message: 'Siswa tidak ditemukan' });

  const setoran = getDb(req).prepare('SELECT * FROM tahfidz_setoran WHERE siswa_id = ? ORDER BY tanggal DESC').all(req.params.id);

  // Hitung total ayat yang sudah disetorkan
  const totalSetoran = getDb(req).prepare("SELECT COUNT(*) as c FROM tahfidz_setoran WHERE siswa_id=? AND jenis='setoran'").get(req.params.id).c;
  const totalMurajaah = getDb(req).prepare("SELECT COUNT(*) as c FROM tahfidz_setoran WHERE siswa_id=? AND jenis='murajaah'").get(req.params.id).c;

  res.json({ success: true, data: { ...siswa, setoran, totalSetoran, totalMurajaah } });
});

// POST /api/tahfidz/siswa
router.post('/siswa', (req, res) => {
  try {
    const { nis, nama, kelas, target_surah, target_juz, musyrif, status } = req.body;
    if (!nama || !nama.trim()) return res.status(400).json({ success: false, message: 'Nama wajib diisi' });

    const result = getDb(req).prepare(`
      INSERT INTO tahfidz_siswa (nis, nama, kelas, target_surah, target_juz, musyrif, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(nis||'', nama.trim(), kelas||'', target_surah||'', target_juz||1, musyrif||'', status||'aktif');

    res.status(201).json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/tahfidz/siswa/:id
router.put('/siswa/:id', (req, res) => {
  try {
    const { nis, nama, kelas, target_surah, target_juz, musyrif, status } = req.body;
    const result = getDb(req).prepare(`
      UPDATE tahfidz_siswa SET nis=?, nama=?, kelas=?, target_surah=?, target_juz=?, musyrif=?, status=?
      WHERE id=?
    `).run(nis||'', nama, kelas||'', target_surah||'', target_juz||1, musyrif||'', status||'aktif', req.params.id);

    if (result.changes === 0) return res.status(404).json({ success: false, message: 'Siswa tidak ditemukan' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/tahfidz/siswa/:id
router.delete('/siswa/:id', (req, res) => {
  const result = getDb(req).prepare('DELETE FROM tahfidz_siswa WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ success: false, message: 'Siswa tidak ditemukan' });
  res.json({ success: true });
});

// ── SETORAN ────────────────────────────────────────────────────────

// GET /api/tahfidz/setoran?siswa_id=1&jenis=setoran
router.get('/setoran', (req, res) => {
  try {
    let query = `
      SELECT s.*, ts.nama as nama_siswa, ts.kelas
      FROM tahfidz_setoran s
      JOIN tahfidz_siswa ts ON s.siswa_id = ts.id
      WHERE 1=1
    `;
    const params = [];
    if (req.query.siswa_id) { query += ' AND s.siswa_id = ?'; params.push(req.query.siswa_id); }
    if (req.query.jenis)    { query += ' AND s.jenis = ?';    params.push(req.query.jenis); }
    if (req.query.dari)     { query += ' AND s.tanggal >= ?'; params.push(req.query.dari); }
    if (req.query.sampai)   { query += ' AND s.tanggal <= ?'; params.push(req.query.sampai); }
    if (req.query.musyrif)  { query += ' AND s.musyrif LIKE ?'; params.push(`%${req.query.musyrif}%`); }
    query += ' ORDER BY s.tanggal DESC, s.id DESC';
    const rows = getDb(req).prepare(query).all(...params);
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/tahfidz/setoran
router.post('/setoran', (req, res) => {
  try {
    const { siswa_id, tanggal, surah, ayat_dari, ayat_sampai, jenis, nilai, musyrif, catatan } = req.body;
    if (!siswa_id || !tanggal || !surah) return res.status(400).json({ success: false, message: 'siswa_id, tanggal, surah wajib diisi' });

    const result = getDb(req).prepare(`
      INSERT INTO tahfidz_setoran (siswa_id, tanggal, surah, ayat_dari, ayat_sampai, jenis, nilai, musyrif, catatan)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(siswa_id, tanggal, surah, ayat_dari||1, ayat_sampai||1, jenis||'setoran', nilai||'B', musyrif||'', catatan||'');

    res.status(201).json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/tahfidz/setoran/:id
router.put('/setoran/:id', (req, res) => {
  try {
    const { tanggal, surah, ayat_dari, ayat_sampai, jenis, nilai, musyrif, catatan } = req.body;
    const result = getDb(req).prepare(`
      UPDATE tahfidz_setoran SET tanggal=?, surah=?, ayat_dari=?, ayat_sampai=?, jenis=?, nilai=?, musyrif=?, catatan=?
      WHERE id=?
    `).run(tanggal, surah, ayat_dari||1, ayat_sampai||1, jenis||'setoran', nilai||'B', musyrif||'', catatan||'', req.params.id);
    if (result.changes === 0) return res.status(404).json({ success: false, message: 'Setoran tidak ditemukan' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/tahfidz/setoran/:id
router.delete('/setoran/:id', (req, res) => {
  const result = getDb(req).prepare('DELETE FROM tahfidz_setoran WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ success: false, message: 'Setoran tidak ditemukan' });
  res.json({ success: true });
});

// GET /api/tahfidz/stats
router.get('/stats', (req, res) => {
  try {
    const totalSiswa = getDb(req).prepare("SELECT COUNT(*) as c FROM tahfidz_siswa WHERE status='aktif'").get().c;
    const totalSetoran = getDb(req).prepare("SELECT COUNT(*) as c FROM tahfidz_setoran WHERE jenis='setoran'").get().c;
    const totalMurajaah = getDb(req).prepare("SELECT COUNT(*) as c FROM tahfidz_setoran WHERE jenis='murajaah'").get().c;
    const nilaiA = getDb(req).prepare("SELECT COUNT(*) as c FROM tahfidz_setoran WHERE nilai='A'").get().c;
    const nilaiB = getDb(req).prepare("SELECT COUNT(*) as c FROM tahfidz_setoran WHERE nilai='B'").get().c;
    const nilaiC = getDb(req).prepare("SELECT COUNT(*) as c FROM tahfidz_setoran WHERE nilai='C'").get().c;
    res.json({ success: true, data: { totalSiswa, totalSetoran, totalMurajaah, nilaiA, nilaiB, nilaiC } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
