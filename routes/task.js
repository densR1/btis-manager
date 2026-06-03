// routes/task.js — My Task API (per user berdasarkan token)
const express = require('express');
const router  = express.Router();

const getDb = (req) => req.app.locals.db;

function getToken(req) {
  return (req.headers['authorization'] || '').replace('Bearer ', '').trim();
}

// GET /api/task
router.get('/', async (req, res) => {
  try {
    const token = getToken(req);
    let query = 'SELECT * FROM tasks WHERE token = ?';
    const params = [token];
    if (req.query.status)    { query += ' AND status = ?';    params.push(req.query.status); }
    if (req.query.prioritas) { query += ' AND prioritas = ?'; params.push(req.query.prioritas); }
    if (req.query.kategori)  { query += ' AND kategori = ?';  params.push(req.query.kategori); }
    if (req.query.q)         { query += ' AND judul LIKE ?';  params.push(`%${req.query.q}%`); }
    query += " ORDER BY CASE prioritas WHEN 'mendesak' THEN 1 WHEN 'tinggi' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END, tenggat ASC";
    const rows = await getDb(req).query(query, params);
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/task/stats
router.get('/stats', async (req, res) => {
  try {
    const token = getToken(req);
    const total    = await getDb(req).queryOne('SELECT COUNT(*) as c FROM tasks WHERE token=?', [token]);
    const todo     = await getDb(req).queryOne("SELECT COUNT(*) as c FROM tasks WHERE token=? AND status='todo'", [token]);
    const proses   = await getDb(req).queryOne("SELECT COUNT(*) as c FROM tasks WHERE token=? AND status='proses'", [token]);
    const selesai  = await getDb(req).queryOne("SELECT COUNT(*) as c FROM tasks WHERE token=? AND status='selesai'", [token]);
    const mendesak = await getDb(req).queryOne("SELECT COUNT(*) as c FROM tasks WHERE token=? AND prioritas='mendesak' AND status!='selesai'", [token]);
    const terlambat= await getDb(req).queryOne("SELECT COUNT(*) as c FROM tasks WHERE token=? AND tenggat < CURDATE() AND status NOT IN ('selesai','batal')", [token]);
    res.json({ success: true, data: {
      total: total.c, todo: todo.c, proses: proses.c,
      selesai: selesai.c, mendesak: mendesak.c, terlambat: terlambat.c
    }});
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/task/:id
router.get('/:id', async (req, res) => {
  const token = getToken(req);
  const row = await getDb(req).queryOne('SELECT * FROM tasks WHERE id = ? AND token = ?', [req.params.id, token]);
  if (!row) return res.status(404).json({ success: false, message: 'Task tidak ditemukan' });
  res.json({ success: true, data: row });
});

// POST /api/task
router.post('/', async (req, res) => {
  try {
    const token = getToken(req);
    const { judul, deskripsi, prioritas, status, tenggat, kategori } = req.body;
    if (!judul || !judul.trim()) return res.status(400).json({ success: false, message: 'Judul wajib diisi' });
    const result = await getDb(req).execute(
      'INSERT INTO tasks (token, judul, deskripsi, prioritas, status, tenggat, kategori) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [token, judul.trim(), deskripsi || '', prioritas || 'normal', status || 'todo', tenggat || null, kategori || '']
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/task/:id
router.put('/:id', async (req, res) => {
  try {
    const token = getToken(req);
    const { judul, deskripsi, prioritas, status, tenggat, kategori } = req.body;
    const result = await getDb(req).execute(
      'UPDATE tasks SET judul=?, deskripsi=?, prioritas=?, status=?, tenggat=?, kategori=?, updated_at=NOW() WHERE id=? AND token=?',
      [judul, deskripsi || '', prioritas || 'normal', status || 'todo', tenggat || null, kategori || '', req.params.id, token]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Task tidak ditemukan' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/task/:id/status
router.patch('/:id/status', async (req, res) => {
  const token = getToken(req);
  const { status } = req.body;
  const allowed = ['todo', 'proses', 'selesai', 'batal'];
  if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Status tidak valid' });
  const result = await getDb(req).execute('UPDATE tasks SET status=?, updated_at=NOW() WHERE id=? AND token=?', [status, req.params.id, token]);
  if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Task tidak ditemukan' });
  res.json({ success: true });
});

// DELETE /api/task/:id
router.delete('/:id', async (req, res) => {
  const token = getToken(req);
  const result = await getDb(req).execute('DELETE FROM tasks WHERE id = ? AND token = ?', [req.params.id, token]);
  if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Task tidak ditemukan' });
  res.json({ success: true });
});

module.exports = router;
