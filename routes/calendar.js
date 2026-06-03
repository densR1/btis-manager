// routes/calendar.js — Academic Calendar Manager API
const express = require('express');
const router  = express.Router();

const getDb = (req) => req.app.locals.db;

// GET /api/calendar
router.get('/', async (req, res) => {
  try {
    let query = 'SELECT * FROM kalender_events WHERE 1=1';
    const params = [];
    if (req.query.tahun_ajar) { query += ' AND tahun_ajar = ?'; params.push(req.query.tahun_ajar); }
    if (req.query.semester)   { query += ' AND semester = ?';   params.push(req.query.semester); }
    if (req.query.tipe)       { query += ' AND tipe = ?';       params.push(req.query.tipe); }
    query += ' ORDER BY tanggal ASC';
    const rows = await getDb(req).query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Key-value storage routes (harus SEBELUM /:id) ─────────────────

async function getSetting(db, key) {
  const row = await db.queryOne('SELECT value FROM calendar_settings WHERE `key` = ?', [key]);
  return row ? row.value : null;
}
async function setSetting(db, key, value) {
  await db.execute(
    'INSERT INTO calendar_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?',
    [key, value, value]
  );
}

// GET /api/calendar/settings
router.get('/settings', async (req, res) => {
  try {
    const val = await getSetting(getDb(req), 'tahun');
    res.json({ success: true, tahun: val ? parseInt(val) : null });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT /api/calendar/settings
router.put('/settings', async (req, res) => {
  try {
    const { tahun } = req.body;
    if (!tahun) return res.status(400).json({ success: false, message: 'tahun wajib diisi' });
    await setSetting(getDb(req), 'tahun', String(tahun));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/calendar/logo
router.get('/logo', async (req, res) => {
  try {
    const val = await getSetting(getDb(req), 'logo');
    res.json({ success: true, logo: val || null });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT /api/calendar/logo
router.put('/logo', async (req, res) => {
  try {
    const { logo } = req.body;
    if (!logo) return res.status(400).json({ success: false, message: 'logo wajib diisi' });
    await setSetting(getDb(req), 'logo', logo);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/calendar/events
router.get('/events', async (req, res) => {
  try {
    const val = await getSetting(getDb(req), 'events');
    res.json({ success: true, events: val ? JSON.parse(val) : [] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT /api/calendar/events
router.put('/events', async (req, res) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events)) return res.status(400).json({ success: false, message: 'events harus berupa array' });
    await setSetting(getDb(req), 'events', JSON.stringify(events));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/calendar/ekskul
router.get('/ekskul', async (req, res) => {
  try {
    const val = await getSetting(getDb(req), 'ekskul');
    res.json({ success: true, ekskul: val ? JSON.parse(val) : null });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT /api/calendar/ekskul
router.put('/ekskul', async (req, res) => {
  try {
    const { ekskul } = req.body;
    await setSetting(getDb(req), 'ekskul', JSON.stringify(ekskul));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/calendar/ekskul-manual
router.get('/ekskul-manual', async (req, res) => {
  try {
    const val = await getSetting(getDb(req), 'ekskul-manual');
    res.json({ success: true, ekskulManual: val ? JSON.parse(val) : null });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT /api/calendar/ekskul-manual
router.put('/ekskul-manual', async (req, res) => {
  try {
    const { ekskulManual } = req.body;
    await setSetting(getDb(req), 'ekskul-manual', JSON.stringify(ekskulManual));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/calendar/:id
router.get('/:id', async (req, res) => {
  const row = await getDb(req).queryOne('SELECT * FROM kalender_events WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ success: false, message: 'Event tidak ditemukan' });
  res.json({ success: true, data: row });
});

// POST /api/calendar
router.post('/', async (req, res) => {
  try {
    const { tanggal, nama, tipe, he, semester, tahun_ajar, catatan } = req.body;
    if (!tanggal || !nama) return res.status(400).json({ success: false, message: 'tanggal dan nama wajib diisi' });
    const result = await getDb(req).execute(
      'INSERT INTO kalender_events (tanggal, nama, tipe, he, semester, tahun_ajar, catatan) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [tanggal, nama, tipe || 'kegiatan', he ?? 1, semester || '', tahun_ajar || '', catatan || '']
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/calendar/bulk
router.post('/bulk', async (req, res) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events) || events.length === 0)
      return res.status(400).json({ success: false, message: 'events harus berupa array' });

    await getDb(req).transaction(async (conn) => {
      for (const e of events) {
        await conn.execute(
          'INSERT INTO kalender_events (tanggal, nama, tipe, he, semester, tahun_ajar, catatan) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [e.tanggal, e.nama, e.tipe || 'kegiatan', e.he ?? 1, e.semester || '', e.tahun_ajar || '', e.catatan || '']
        );
      }
    });

    res.status(201).json({ success: true, count: events.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/calendar/:id
router.put('/:id', async (req, res) => {
  try {
    const { tanggal, nama, tipe, he, semester, tahun_ajar, catatan } = req.body;
    const result = await getDb(req).execute(
      'UPDATE kalender_events SET tanggal=?, nama=?, tipe=?, he=?, semester=?, tahun_ajar=?, catatan=? WHERE id=?',
      [tanggal, nama, tipe, he, semester, tahun_ajar, catatan, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Event tidak ditemukan' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/calendar/:id
router.delete('/:id', async (req, res) => {
  const result = await getDb(req).execute('DELETE FROM kalender_events WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Event tidak ditemukan' });
  res.json({ success: true });
});

// DELETE /api/calendar/tahun/:tahun_ajar
router.delete('/tahun/:tahun_ajar', async (req, res) => {
  const result = await getDb(req).execute('DELETE FROM kalender_events WHERE tahun_ajar = ?', [req.params.tahun_ajar]);
  res.json({ success: true, deleted: result.affectedRows });
});

module.exports = router;
