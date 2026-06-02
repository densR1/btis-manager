// routes/supervision.js — Supervision (Observasi Mengajar) API
const express = require('express');
const router  = express.Router();

// Ambil db dari app.locals (di-set oleh server.js setelah init)
const getDb = (req) => req.app.locals.db;


// GET /api/supervision?guru_id=1&status=final
router.get('/', (req, res) => {
  try {
    let query = `
      SELECT s.*, t.nama as nama_guru_ref
      FROM supervisions s
      LEFT JOIN teachers t ON s.guru_id = t.id
      WHERE 1=1
    `;
    const params = [];
    if (req.query.guru_id) { query += ' AND s.guru_id = ?';  params.push(req.query.guru_id); }
    if (req.query.status)  { query += ' AND s.status = ?';   params.push(req.query.status); }
    if (req.query.dari)    { query += ' AND s.tanggal >= ?'; params.push(req.query.dari); }
    if (req.query.sampai)  { query += ' AND s.tanggal <= ?'; params.push(req.query.sampai); }
    query += ' ORDER BY s.tanggal DESC';
    const rows = getDb(req).prepare(query).all(...params);
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/supervision/stats
router.get('/stats', (req, res) => {
  try {
    const total  = getDb(req).prepare("SELECT COUNT(*) as c FROM supervisions").get().c;
    const final  = getDb(req).prepare("SELECT COUNT(*) as c FROM supervisions WHERE status='final'").get().c;
    const draft  = getDb(req).prepare("SELECT COUNT(*) as c FROM supervisions WHERE status='draft'").get().c;
    const avgSkor= getDb(req).prepare("SELECT AVG(skor_total) as avg FROM supervisions WHERE status='final'").get().avg;
    res.json({ success: true, data: { total, final, draft, rata_skor: avgSkor ? +avgSkor.toFixed(2) : 0 } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/supervision/:id — detail + aspek
router.get('/:id', (req, res) => {
  const sv = getDb(req).prepare('SELECT * FROM supervisions WHERE id = ?').get(req.params.id);
  if (!sv) return res.status(404).json({ success: false, message: 'Supervisi tidak ditemukan' });
  const aspek = getDb(req).prepare('SELECT * FROM supervision_aspek WHERE supervision_id = ? ORDER BY id').all(req.params.id);
  res.json({ success: true, data: { ...sv, aspek } });
});

// POST /api/supervision
router.post('/', (req, res) => {
  try {
    const { guru_id, nama_guru, kelas, mapel, tanggal, jam, supervisor, skor_total, catatan, status, aspek } = req.body;
    if (!tanggal) return res.status(400).json({ success: false, message: 'tanggal wajib diisi' });

    const result = getDb(req).prepare(`
      INSERT INTO supervisions (guru_id, nama_guru, kelas, mapel, tanggal, jam, supervisor, skor_total, catatan, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(guru_id||null, nama_guru||'', kelas||'', mapel||'', tanggal, jam||'', supervisor||'', skor_total||0, catatan||'', status||'draft');

    const svId = result.lastInsertRowid;

    if (Array.isArray(aspek) && aspek.length > 0) {
      const ins = getDb(req).prepare('INSERT INTO supervision_aspek (supervision_id, aspek, skor, keterangan) VALUES (?, ?, ?, ?)');
      getDb(req).transaction((list) => { for (const a of list) ins.run(svId, a.aspek, a.skor||0, a.keterangan||''); })(aspek);
    }

    res.status(201).json({ success: true, id: svId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/supervision/:id
router.put('/:id', (req, res) => {
  try {
    const { guru_id, nama_guru, kelas, mapel, tanggal, jam, supervisor, skor_total, catatan, status, aspek } = req.body;

    const result = getDb(req).prepare(`
      UPDATE supervisions SET guru_id=?, nama_guru=?, kelas=?, mapel=?, tanggal=?, jam=?,
        supervisor=?, skor_total=?, catatan=?, status=?, updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(guru_id||null, nama_guru||'', kelas||'', mapel||'', tanggal, jam||'', supervisor||'', skor_total||0, catatan||'', status||'draft', req.params.id);

    if (result.changes === 0) return res.status(404).json({ success: false, message: 'Supervisi tidak ditemukan' });

    if (Array.isArray(aspek)) {
      getDb(req).prepare('DELETE FROM supervision_aspek WHERE supervision_id = ?').run(req.params.id);
      if (aspek.length > 0) {
        const ins = getDb(req).prepare('INSERT INTO supervision_aspek (supervision_id, aspek, skor, keterangan) VALUES (?, ?, ?, ?)');
        getDb(req).transaction((list) => { for (const a of list) ins.run(req.params.id, a.aspek, a.skor||0, a.keterangan||''); })(aspek);
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/supervision/:id/finalize
router.patch('/:id/finalize', (req, res) => {
  const result = getDb(req).prepare(`UPDATE supervisions SET status='final', updated_at=datetime('now','localtime') WHERE id=?`).run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ success: false, message: 'Supervisi tidak ditemukan' });
  res.json({ success: true });
});

// DELETE /api/supervision/:id
router.delete('/:id', (req, res) => {
  const result = getDb(req).prepare('DELETE FROM supervisions WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ success: false, message: 'Supervisi tidak ditemukan' });
  res.json({ success: true });
});

module.exports = router;
