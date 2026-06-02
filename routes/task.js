// routes/task.js — My Task API (per user berdasarkan token)
const express = require('express');
const router  = express.Router();

// Ambil db dari app.locals (di-set oleh server.js setelah init)
const getDb = (req) => req.app.locals.db;


function getToken(req) {
  return (req.headers['authorization'] || '').replace('Bearer ', '').trim();
}

// GET /api/task?status=todo&prioritas=tinggi
router.get('/', (req, res) => {
  try {
    const token = getToken(req);
    let query = 'SELECT * FROM tasks WHERE token = ?';
    const params = [token];
    if (req.query.status)    { query += ' AND status = ?';    params.push(req.query.status); }
    if (req.query.prioritas) { query += ' AND prioritas = ?'; params.push(req.query.prioritas); }
    if (req.query.kategori)  { query += ' AND kategori = ?';  params.push(req.query.kategori); }
    if (req.query.q)         { query += ' AND judul LIKE ?';  params.push(`%${req.query.q}%`); }
    query += ' ORDER BY CASE prioritas WHEN "mendesak" THEN 1 WHEN "tinggi" THEN 2 WHEN "normal" THEN 3 ELSE 4 END, tenggat ASC';
    const rows = getDb(req).prepare(query).all(...params);
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/task/stats
router.get('/stats', (req, res) => {
  try {
    const token = getToken(req);
    const total    = getDb(req).prepare("SELECT COUNT(*) as c FROM tasks WHERE token=?").get(token).c;
    const todo     = getDb(req).prepare("SELECT COUNT(*) as c FROM tasks WHERE token=? AND status='todo'").get(token).c;
    const proses   = getDb(req).prepare("SELECT COUNT(*) as c FROM tasks WHERE token=? AND status='proses'").get(token).c;
    const selesai  = getDb(req).prepare("SELECT COUNT(*) as c FROM tasks WHERE token=? AND status='selesai'").get(token).c;
    const mendesak = getDb(req).prepare("SELECT COUNT(*) as c FROM tasks WHERE token=? AND prioritas='mendesak' AND status!='selesai'").get(token).c;
    const terlambat= getDb(req).prepare("SELECT COUNT(*) as c FROM tasks WHERE token=? AND tenggat < date('now') AND status NOT IN ('selesai','batal')").get(token).c;
    res.json({ success: true, data: { total, todo, proses, selesai, mendesak, terlambat } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/task/:id
router.get('/:id', (req, res) => {
  const token = getToken(req);
  const row = getDb(req).prepare('SELECT * FROM tasks WHERE id = ? AND token = ?').get(req.params.id, token);
  if (!row) return res.status(404).json({ success: false, message: 'Task tidak ditemukan' });
  res.json({ success: true, data: row });
});

// POST /api/task
router.post('/', (req, res) => {
  try {
    const token = getToken(req);
    const { judul, deskripsi, prioritas, status, tenggat, kategori } = req.body;
    if (!judul || !judul.trim()) return res.status(400).json({ success: false, message: 'Judul wajib diisi' });

    const result = getDb(req).prepare(`
      INSERT INTO tasks (token, judul, deskripsi, prioritas, status, tenggat, kategori)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(token, judul.trim(), deskripsi||'', prioritas||'normal', status||'todo', tenggat||'', kategori||'');

    res.status(201).json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/task/:id
router.put('/:id', (req, res) => {
  try {
    const token = getToken(req);
    const { judul, deskripsi, prioritas, status, tenggat, kategori } = req.body;
    const result = getDb(req).prepare(`
      UPDATE tasks SET judul=?, deskripsi=?, prioritas=?, status=?, tenggat=?, kategori=?,
        updated_at=datetime('now','localtime')
      WHERE id=? AND token=?
    `).run(judul, deskripsi||'', prioritas||'normal', status||'todo', tenggat||'', kategori||'', req.params.id, token);

    if (result.changes === 0) return res.status(404).json({ success: false, message: 'Task tidak ditemukan' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/task/:id/status
router.patch('/:id/status', (req, res) => {
  const token = getToken(req);
  const { status } = req.body;
  const allowed = ['todo', 'proses', 'selesai', 'batal'];
  if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Status tidak valid' });
  const result = getDb(req).prepare(`UPDATE tasks SET status=?, updated_at=datetime('now','localtime') WHERE id=? AND token=?`).run(status, req.params.id, token);
  if (result.changes === 0) return res.status(404).json({ success: false, message: 'Task tidak ditemukan' });
  res.json({ success: true });
});

// DELETE /api/task/:id
router.delete('/:id', (req, res) => {
  const token = getToken(req);
  const result = getDb(req).prepare('DELETE FROM tasks WHERE id = ? AND token = ?').run(req.params.id, token);
  if (result.changes === 0) return res.status(404).json({ success: false, message: 'Task tidak ditemukan' });
  res.json({ success: true });
});

module.exports = router;
