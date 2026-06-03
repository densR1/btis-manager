// routes/supervision.js — Supervision (Observasi Mengajar) API
const express = require('express');
const router  = express.Router();

const getDb = (req) => req.app.locals.db;

// GET /api/supervision
router.get('/', async (req, res) => {
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
    const rows = await getDb(req).query(query, params);
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/supervision/stats
router.get('/stats', async (req, res) => {
  try {
    const total   = await getDb(req).queryOne('SELECT COUNT(*) as c FROM supervisions');
    const final   = await getDb(req).queryOne("SELECT COUNT(*) as c FROM supervisions WHERE status='final'");
    const draft   = await getDb(req).queryOne("SELECT COUNT(*) as c FROM supervisions WHERE status='draft'");
    const avgSkor = await getDb(req).queryOne("SELECT AVG(skor_total) as avg FROM supervisions WHERE status='final'");
    res.json({ success: true, data: {
      total: total.c, final: final.c, draft: draft.c,
      rata_skor: avgSkor.avg ? +Number(avgSkor.avg).toFixed(2) : 0
    }});
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/supervision/:id
router.get('/:id', async (req, res) => {
  const sv = await getDb(req).queryOne('SELECT * FROM supervisions WHERE id = ?', [req.params.id]);
  if (!sv) return res.status(404).json({ success: false, message: 'Supervisi tidak ditemukan' });
  const aspek = await getDb(req).query('SELECT * FROM supervision_aspek WHERE supervision_id = ? ORDER BY id', [req.params.id]);
  res.json({ success: true, data: { ...sv, aspek } });
});

// POST /api/supervision
router.post('/', async (req, res) => {
  try {
    const { guru_id, nama_guru, kelas, mapel, tanggal, jam, supervisor, skor_total, catatan, status, aspek } = req.body;
    if (!tanggal) return res.status(400).json({ success: false, message: 'tanggal wajib diisi' });

    const result = await getDb(req).execute(
      'INSERT INTO supervisions (guru_id, nama_guru, kelas, mapel, tanggal, jam, supervisor, skor_total, catatan, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [guru_id || null, nama_guru || '', kelas || '', mapel || '', tanggal, jam || '', supervisor || '', skor_total || 0, catatan || '', status || 'draft']
    );
    const svId = result.insertId;

    if (Array.isArray(aspek) && aspek.length > 0) {
      await getDb(req).transaction(async (conn) => {
        for (const a of aspek) {
          await conn.execute(
            'INSERT INTO supervision_aspek (supervision_id, aspek, skor, keterangan) VALUES (?, ?, ?, ?)',
            [svId, a.aspek, a.skor || 0, a.keterangan || '']
          );
        }
      });
    }

    res.status(201).json({ success: true, id: svId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/supervision/:id
router.put('/:id', async (req, res) => {
  try {
    const { guru_id, nama_guru, kelas, mapel, tanggal, jam, supervisor, skor_total, catatan, status, aspek } = req.body;

    const result = await getDb(req).execute(
      'UPDATE supervisions SET guru_id=?, nama_guru=?, kelas=?, mapel=?, tanggal=?, jam=?, supervisor=?, skor_total=?, catatan=?, status=?, updated_at=NOW() WHERE id=?',
      [guru_id || null, nama_guru || '', kelas || '', mapel || '', tanggal, jam || '', supervisor || '', skor_total || 0, catatan || '', status || 'draft', req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Supervisi tidak ditemukan' });

    if (Array.isArray(aspek)) {
      await getDb(req).execute('DELETE FROM supervision_aspek WHERE supervision_id = ?', [req.params.id]);
      if (aspek.length > 0) {
        await getDb(req).transaction(async (conn) => {
          for (const a of aspek) {
            await conn.execute(
              'INSERT INTO supervision_aspek (supervision_id, aspek, skor, keterangan) VALUES (?, ?, ?, ?)',
              [req.params.id, a.aspek, a.skor || 0, a.keterangan || '']
            );
          }
        });
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/supervision/:id/finalize
router.patch('/:id/finalize', async (req, res) => {
  const result = await getDb(req).execute("UPDATE supervisions SET status='final', updated_at=NOW() WHERE id=?", [req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Supervisi tidak ditemukan' });
  res.json({ success: true });
});

// DELETE /api/supervision/:id
router.delete('/:id', async (req, res) => {
  const result = await getDb(req).execute('DELETE FROM supervisions WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Supervisi tidak ditemukan' });
  res.json({ success: true });
});

module.exports = router;
