// routes/tahfidz.js — Tahfidz Manager API
const express = require('express');
const router  = express.Router();

const getDb = (req) => req.app.locals.db;

// ── SISWA ─────────────────────────────────────────────────────────

router.get('/siswa', async (req, res) => {
  try {
    let query = 'SELECT * FROM tahfidz_siswa WHERE 1=1';
    const params = [];
    if (req.query.kelas)   { query += ' AND kelas = ?';      params.push(req.query.kelas); }
    if (req.query.musyrif) { query += ' AND musyrif LIKE ?';  params.push(`%${req.query.musyrif}%`); }
    if (req.query.status)  { query += ' AND status = ?';     params.push(req.query.status); }
    if (req.query.q)       { query += ' AND nama LIKE ?';    params.push(`%${req.query.q}%`); }
    query += ' ORDER BY kelas ASC, nama ASC';
    const rows = await getDb(req).query(query, params);
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/siswa/:id', async (req, res) => {
  const siswa = await getDb(req).queryOne('SELECT * FROM tahfidz_siswa WHERE id = ?', [req.params.id]);
  if (!siswa) return res.status(404).json({ success: false, message: 'Siswa tidak ditemukan' });

  const setoran      = await getDb(req).query('SELECT * FROM tahfidz_setoran WHERE siswa_id = ? ORDER BY tanggal DESC', [req.params.id]);
  const totSetoran   = await getDb(req).queryOne("SELECT COUNT(*) as c FROM tahfidz_setoran WHERE siswa_id=? AND jenis='setoran'", [req.params.id]);
  const totMurajaah  = await getDb(req).queryOne("SELECT COUNT(*) as c FROM tahfidz_setoran WHERE siswa_id=? AND jenis='murajaah'", [req.params.id]);

  res.json({ success: true, data: { ...siswa, setoran, totalSetoran: totSetoran.c, totalMurajaah: totMurajaah.c } });
});

router.post('/siswa', async (req, res) => {
  try {
    const { nis, nama, kelas, target_surah, target_juz, musyrif, status } = req.body;
    if (!nama || !nama.trim()) return res.status(400).json({ success: false, message: 'Nama wajib diisi' });
    const result = await getDb(req).execute(
      'INSERT INTO tahfidz_siswa (nis, nama, kelas, target_surah, target_juz, musyrif, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [nis || '', nama.trim(), kelas || '', target_surah || '', target_juz || 1, musyrif || '', status || 'aktif']
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/siswa/:id', async (req, res) => {
  try {
    const { nis, nama, kelas, target_surah, target_juz, musyrif, status } = req.body;
    const result = await getDb(req).execute(
      'UPDATE tahfidz_siswa SET nis=?, nama=?, kelas=?, target_surah=?, target_juz=?, musyrif=?, status=? WHERE id=?',
      [nis || '', nama, kelas || '', target_surah || '', target_juz || 1, musyrif || '', status || 'aktif', req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Siswa tidak ditemukan' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/siswa/:id', async (req, res) => {
  const result = await getDb(req).execute('DELETE FROM tahfidz_siswa WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Siswa tidak ditemukan' });
  res.json({ success: true });
});

// ── SETORAN ────────────────────────────────────────────────────────

router.get('/setoran', async (req, res) => {
  try {
    let query = `
      SELECT s.*, ts.nama as nama_siswa, ts.kelas
      FROM tahfidz_setoran s
      JOIN tahfidz_siswa ts ON s.siswa_id = ts.id
      WHERE 1=1
    `;
    const params = [];
    if (req.query.siswa_id) { query += ' AND s.siswa_id = ?';   params.push(req.query.siswa_id); }
    if (req.query.jenis)    { query += ' AND s.jenis = ?';      params.push(req.query.jenis); }
    if (req.query.dari)     { query += ' AND s.tanggal >= ?';   params.push(req.query.dari); }
    if (req.query.sampai)   { query += ' AND s.tanggal <= ?';   params.push(req.query.sampai); }
    if (req.query.musyrif)  { query += ' AND s.musyrif LIKE ?'; params.push(`%${req.query.musyrif}%`); }
    query += ' ORDER BY s.tanggal DESC, s.id DESC';
    const rows = await getDb(req).query(query, params);
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/setoran', async (req, res) => {
  try {
    const { siswa_id, tanggal, surah, ayat_dari, ayat_sampai, jenis, nilai, musyrif, catatan } = req.body;
    if (!siswa_id || !tanggal || !surah) return res.status(400).json({ success: false, message: 'siswa_id, tanggal, surah wajib diisi' });
    const result = await getDb(req).execute(
      'INSERT INTO tahfidz_setoran (siswa_id, tanggal, surah, ayat_dari, ayat_sampai, jenis, nilai, musyrif, catatan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [siswa_id, tanggal, surah, ayat_dari || 1, ayat_sampai || 1, jenis || 'setoran', nilai || 'B', musyrif || '', catatan || '']
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/setoran/:id', async (req, res) => {
  try {
    const { tanggal, surah, ayat_dari, ayat_sampai, jenis, nilai, musyrif, catatan } = req.body;
    const result = await getDb(req).execute(
      'UPDATE tahfidz_setoran SET tanggal=?, surah=?, ayat_dari=?, ayat_sampai=?, jenis=?, nilai=?, musyrif=?, catatan=? WHERE id=?',
      [tanggal, surah, ayat_dari || 1, ayat_sampai || 1, jenis || 'setoran', nilai || 'B', musyrif || '', catatan || '', req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Setoran tidak ditemukan' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/setoran/:id', async (req, res) => {
  const result = await getDb(req).execute('DELETE FROM tahfidz_setoran WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Setoran tidak ditemukan' });
  res.json({ success: true });
});

// GET /api/tahfidz/stats
router.get('/stats', async (req, res) => {
  try {
    const totalSiswa    = await getDb(req).queryOne("SELECT COUNT(*) as c FROM tahfidz_siswa WHERE status='aktif'");
    const totalSetoran  = await getDb(req).queryOne("SELECT COUNT(*) as c FROM tahfidz_setoran WHERE jenis='setoran'");
    const totalMurajaah = await getDb(req).queryOne("SELECT COUNT(*) as c FROM tahfidz_setoran WHERE jenis='murajaah'");
    const nilaiA        = await getDb(req).queryOne("SELECT COUNT(*) as c FROM tahfidz_setoran WHERE nilai='A'");
    const nilaiB        = await getDb(req).queryOne("SELECT COUNT(*) as c FROM tahfidz_setoran WHERE nilai='B'");
    const nilaiC        = await getDb(req).queryOne("SELECT COUNT(*) as c FROM tahfidz_setoran WHERE nilai='C'");
    res.json({ success: true, data: {
      totalSiswa: totalSiswa.c, totalSetoran: totalSetoran.c, totalMurajaah: totalMurajaah.c,
      nilaiA: nilaiA.c, nilaiB: nilaiB.c, nilaiC: nilaiC.c
    }});
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
