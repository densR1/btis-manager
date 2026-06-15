// routes/auth.js — Autentikasi, profil, dan PIN modul
const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');

const getDb = (req) => req.app.locals.db;

function getToken(req) {
  const auth = req.headers['authorization'] || '';
  return auth.replace('Bearer ', '').trim();
}

async function isValidToken(req, token) {
  if (!token) return false;
  const row = await getDb(req).queryOne('SELECT id FROM auth_tokens WHERE token = ?', [token]);
  return !!row;
}

// POST /api/auth/token — minta token baru
router.post('/token', async (req, res) => {
  try {
    const token = uuidv4();
    await getDb(req).execute('INSERT INTO auth_tokens (token) VALUES (?)', [token]);
    res.json({ success: true, token });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/auth/profile
router.get('/profile', async (req, res) => {
  const token = getToken(req);
  if (!await isValidToken(req, token)) return res.status(401).json({ success: false, message: 'Token tidak valid' });

  const profile = await getDb(req).queryOne('SELECT nama, jabatan, avatar_color FROM profiles WHERE token = ?', [token]);
  res.json({ success: true, data: profile || null });
});

// PUT /api/auth/profile
router.put('/profile', async (req, res) => {
  const token = getToken(req);
  if (!await isValidToken(req, token)) return res.status(401).json({ success: false, message: 'Token tidak valid' });

  const { nama, jabatan, avatar_color } = req.body;
  if (!nama || !nama.trim()) return res.status(400).json({ success: false, message: 'Nama wajib diisi' });

  const existing = await getDb(req).queryOne('SELECT id FROM profiles WHERE token = ?', [token]);
  if (existing) {
    await getDb(req).execute(
      'UPDATE profiles SET nama=?, jabatan=?, avatar_color=?, updated_at=NOW() WHERE token=?',
      [nama.trim(), jabatan || '', avatar_color || '#1a3a6b', token]
    );
  } else {
    await getDb(req).execute(
      'INSERT INTO profiles (token, nama, jabatan, avatar_color) VALUES (?, ?, ?, ?)',
      [token, nama.trim(), jabatan || '', avatar_color || '#1a3a6b']
    );
  }

  res.json({ success: true, message: 'Profil berhasil disimpan' });
});

// GET /api/auth/pin
router.get('/pin', async (req, res) => {
  const token = getToken(req);
  if (!await isValidToken(req, token)) return res.status(401).json({ success: false, message: 'Token tidak valid' });

  const row = await getDb(req).queryOne("SELECT value FROM app_settings WHERE `key` = 'module_pin'");
  res.json({ success: true, pin: row ? row.value : '1234' });
});

// PUT /api/auth/pin
router.put('/pin', async (req, res) => {
  const token = getToken(req);
  if (!await isValidToken(req, token)) return res.status(401).json({ success: false, message: 'Token tidak valid' });

  const { oldPin, newPin } = req.body;
  const row = await getDb(req).queryOne("SELECT value FROM app_settings WHERE `key` = 'module_pin'");
  const currentPin = row ? row.value : '1234';

  if (oldPin !== currentPin) return res.status(400).json({ success: false, message: 'PIN lama tidak sesuai' });
  if (!newPin || newPin.length < 4) return res.status(400).json({ success: false, message: 'PIN baru minimal 4 karakter' });

  await getDb(req).execute("UPDATE app_settings SET value=? WHERE `key`='module_pin'", [newPin]);
  res.json({ success: true, message: 'PIN berhasil diubah' });
});

// GET /api/auth/active-ta — ambil nama tahun ajaran aktif (ditampilkan di semua halaman)
router.get('/active-ta', async (req, res) => {
  const token = getToken(req);
  if (!await isValidToken(req, token)) return res.status(401).json({ success: false, message: 'Token tidak valid' });
  const row = await getDb(req).queryOne("SELECT value FROM app_settings WHERE `key` = 'active_ta_name'");
  res.json({ success: true, name: row ? row.value : '' });
});

// PUT /api/auth/active-ta — ubah tahun ajaran aktif
router.put('/active-ta', async (req, res) => {
  const token = getToken(req);
  if (!await isValidToken(req, token)) return res.status(401).json({ success: false, message: 'Token tidak valid' });
  const { name } = req.body;
  if (name === undefined) return res.status(400).json({ success: false, message: 'name diperlukan' });
  await getDb(req).execute(
    "INSERT INTO app_settings (`key`, value) VALUES ('active_ta_name', ?) ON DUPLICATE KEY UPDATE value = ?",
    [name, name]
  );
  res.json({ success: true });
});

// GET /api/auth/lock-password — ambil password lock timetable
router.get('/lock-password', async (req, res) => {
  const token = getToken(req);
  if (!await isValidToken(req, token)) return res.status(401).json({ success: false, message: 'Token tidak valid' });
  const row = await getDb(req).queryOne("SELECT value FROM app_settings WHERE `key` = 'LOCK_PASSWORD'");
  res.json({ success: true, password: row ? row.value : 'imron' });
});

// PUT /api/auth/lock-password — ubah password lock timetable
router.put('/lock-password', async (req, res) => {
  const token = getToken(req);
  if (!await isValidToken(req, token)) return res.status(401).json({ success: false, message: 'Token tidak valid' });
  const { newPassword } = req.body;
  if (!newPassword || !newPassword.trim()) return res.status(400).json({ success: false, message: 'Password tidak boleh kosong' });
  await getDb(req).execute(
    "INSERT INTO app_settings (`key`, value) VALUES ('LOCK_PASSWORD', ?) ON DUPLICATE KEY UPDATE value = ?",
    [newPassword.trim(), newPassword.trim()]
  );
  res.json({ success: true, message: 'Password berhasil diubah' });
});

module.exports = router;
