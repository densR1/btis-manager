// routes/timetable.js — Timetable Manager API
const express = require('express');
const router  = express.Router();

const getDb = (req) => req.app.locals.db;

// ── KEY-VALUE STORAGE (meta & data per TA) ────────────────────────

async function ttGet(db, key) {
  const row = await db.queryOne('SELECT value FROM timetable_data WHERE `key` = ?', [key]);
  return row ? row.value : null;
}
async function ttSet(db, key, value) {
  await db.execute(
    'INSERT INTO timetable_data (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?',
    [key, value, value]
  );
}

// GET /api/timetable/meta
router.get('/meta', async (req, res) => {
  try {
    const val = await ttGet(getDb(req), 'meta');
    res.json({ success: true, meta: val ? JSON.parse(val) : null });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT /api/timetable/meta
router.put('/meta', async (req, res) => {
  try {
    const { meta } = req.body;
    await ttSet(getDb(req), 'meta', JSON.stringify(meta));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/timetable/:id  (id = tahun ajar, e.g. "2024%2F2025")
router.get('/:id', async (req, res) => {
  try {
    const val = await ttGet(getDb(req), 'ta:' + req.params.id);
    if (!val) return res.json({ success: true, data: null });
    const data = JSON.parse(val);
    if (!Array.isArray(data.days) || data.days.length < 2) {
      data.days = ['Senin','Selasa','Rabu','Kamis','Jumat'];
      await ttSet(getDb(req), 'ta:' + req.params.id, JSON.stringify(data));
    }
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT /api/timetable/:id
router.put('/:id', async (req, res) => {
  try {
    const { data } = req.body;
    const db = getDb(req);
    const key = 'ta:' + req.params.id;
    const newStr = JSON.stringify(data);
    const prev = await ttGet(db, key);
    // Jaring pengaman: kalau data lama "besar" tapi data baru menyusut drastis
    // (indikasi wipe/kosong), cadangkan dulu versi lama bertimestamp agar tidak
    // hilang diam-diam. Cadangan bisa dipulihkan via GET ta:<id>:bak:<ts>.
    if (prev && prev.length > 20000 && newStr.length < prev.length * 0.4) {
      await ttSet(db, key + ':bak:' + Date.now(), prev);
    }
    await ttSet(db, key, newStr);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── TAHUN AJARAN ──────────────────────────────────────────────────

router.get('/tahun-ajar', async (req, res) => {
  const rows = await getDb(req).query('SELECT * FROM tt_tahun_ajar ORDER BY id DESC');
  res.json({ success: true, data: rows });
});

router.post('/tahun-ajar', async (req, res) => {
  try {
    const { nama, aktif } = req.body;
    if (!nama) return res.status(400).json({ success: false, message: 'nama wajib diisi' });
    if (aktif) await getDb(req).execute('UPDATE tt_tahun_ajar SET aktif = 0');
    const result = await getDb(req).execute('INSERT INTO tt_tahun_ajar (nama, aktif) VALUES (?, ?)', [nama, aktif ? 1 : 0]);
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/tahun-ajar/:id/aktif', async (req, res) => {
  await getDb(req).execute('UPDATE tt_tahun_ajar SET aktif = 0');
  await getDb(req).execute('UPDATE tt_tahun_ajar SET aktif = 1 WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

router.delete('/tahun-ajar/:id', async (req, res) => {
  await getDb(req).execute('DELETE FROM tt_tahun_ajar WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// ── KELAS ─────────────────────────────────────────────────────────

router.get('/kelas', async (req, res) => {
  const ta_id = req.query.ta_id;
  const rows = ta_id
    ? await getDb(req).query('SELECT * FROM tt_kelas WHERE ta_id = ? ORDER BY tingkat, parallel', [ta_id])
    : await getDb(req).query('SELECT * FROM tt_kelas ORDER BY tingkat, parallel');
  res.json({ success: true, data: rows });
});

router.post('/kelas', async (req, res) => {
  try {
    const { nama, tingkat, parallel, ta_id } = req.body;
    if (!nama) return res.status(400).json({ success: false, message: 'nama wajib diisi' });
    const result = await getDb(req).execute(
      'INSERT INTO tt_kelas (nama, tingkat, parallel, ta_id) VALUES (?, ?, ?, ?)',
      [nama, tingkat || '', parallel || '', ta_id || null]
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/kelas/:id', async (req, res) => {
  const { nama, tingkat, parallel } = req.body;
  await getDb(req).execute('UPDATE tt_kelas SET nama=?, tingkat=?, parallel=? WHERE id=?', [nama, tingkat || '', parallel || '', req.params.id]);
  res.json({ success: true });
});

router.delete('/kelas/:id', async (req, res) => {
  await getDb(req).execute('DELETE FROM tt_kelas WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// ── GURU ──────────────────────────────────────────────────────────

router.get('/guru', async (req, res) => {
  const ta_id = req.query.ta_id;
  const rows = ta_id
    ? await getDb(req).query('SELECT * FROM tt_guru WHERE ta_id = ? ORDER BY nama', [ta_id])
    : await getDb(req).query('SELECT * FROM tt_guru ORDER BY nama');
  res.json({ success: true, data: rows });
});

router.post('/guru', async (req, res) => {
  try {
    const { nama, kode, mapel, max_jp, ta_id } = req.body;
    if (!nama) return res.status(400).json({ success: false, message: 'nama wajib diisi' });
    const result = await getDb(req).execute(
      'INSERT INTO tt_guru (nama, kode, mapel, max_jp, ta_id) VALUES (?, ?, ?, ?, ?)',
      [nama, kode || '', mapel || '', max_jp || 24, ta_id || null]
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/guru/:id', async (req, res) => {
  const { nama, kode, mapel, max_jp } = req.body;
  await getDb(req).execute('UPDATE tt_guru SET nama=?, kode=?, mapel=?, max_jp=? WHERE id=?', [nama, kode || '', mapel || '', max_jp || 24, req.params.id]);
  res.json({ success: true });
});

router.delete('/guru/:id', async (req, res) => {
  await getDb(req).execute('DELETE FROM tt_guru WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// ── MAPEL ─────────────────────────────────────────────────────────

router.get('/mapel', async (req, res) => {
  const ta_id = req.query.ta_id;
  const rows = ta_id
    ? await getDb(req).query('SELECT * FROM tt_mapel WHERE ta_id = ? ORDER BY nama', [ta_id])
    : await getDb(req).query('SELECT * FROM tt_mapel ORDER BY nama');
  res.json({ success: true, data: rows });
});

router.post('/mapel', async (req, res) => {
  try {
    const { nama, kode, warna, ta_id } = req.body;
    if (!nama) return res.status(400).json({ success: false, message: 'nama wajib diisi' });
    const result = await getDb(req).execute(
      'INSERT INTO tt_mapel (nama, kode, warna, ta_id) VALUES (?, ?, ?, ?)',
      [nama, kode || '', warna || '#1a3a6b', ta_id || null]
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/mapel/:id', async (req, res) => {
  const { nama, kode, warna } = req.body;
  await getDb(req).execute('UPDATE tt_mapel SET nama=?, kode=?, warna=? WHERE id=?', [nama, kode || '', warna || '#1a3a6b', req.params.id]);
  res.json({ success: true });
});

router.delete('/mapel/:id', async (req, res) => {
  await getDb(req).execute('DELETE FROM tt_mapel WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// ── JADWAL ────────────────────────────────────────────────────────

router.get('/jadwal', async (req, res) => {
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
    query += " ORDER BY CASE j.hari WHEN 'Senin' THEN 1 WHEN 'Selasa' THEN 2 WHEN 'Rabu' THEN 3 WHEN 'Kamis' THEN 4 WHEN 'Jumat' THEN 5 WHEN 'Sabtu' THEN 6 ELSE 7 END, j.jam_ke ASC";
    const rows = await getDb(req).query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/jadwal', async (req, res) => {
  try {
    const { kelas_id, guru_id, mapel_id, hari, jam_ke, ta_id } = req.body;
    if (!kelas_id || !hari || !jam_ke) return res.status(400).json({ success: false, message: 'kelas_id, hari, jam_ke wajib diisi' });

    if (guru_id) {
      const bentrok = await getDb(req).queryOne('SELECT id FROM tt_jadwal WHERE guru_id=? AND hari=? AND jam_ke=? AND ta_id=?', [guru_id, hari, jam_ke, ta_id]);
      if (bentrok) return res.status(409).json({ success: false, message: 'Guru sudah mengajar di slot yang sama' });
    }

    const result = await getDb(req).execute(
      'INSERT INTO tt_jadwal (kelas_id, guru_id, mapel_id, hari, jam_ke, ta_id) VALUES (?, ?, ?, ?, ?, ?)',
      [kelas_id, guru_id || null, mapel_id || null, hari, jam_ke, ta_id || null]
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/jadwal/:id', async (req, res) => {
  try {
    const { guru_id, mapel_id, hari, jam_ke } = req.body;
    await getDb(req).execute('UPDATE tt_jadwal SET guru_id=?, mapel_id=?, hari=?, jam_ke=? WHERE id=?', [guru_id || null, mapel_id || null, hari, jam_ke, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/jadwal/:id', async (req, res) => {
  await getDb(req).execute('DELETE FROM tt_jadwal WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
