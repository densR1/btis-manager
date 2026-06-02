// routes/auth.js — Autentikasi, profil, dan PIN modul
const express = require('express');
const router  = express.Router();

// Ambil db dari app.locals (di-set oleh server.js setelah init)
const getDb = (req) => req.app.locals.db;
const { v4: uuidv4 } = require('uuid');


// ── Helper: ambil token dari header ──────────────────────────────
function getToken(req) {
  const auth = req.headers['authorization'] || '';
  return auth.replace('Bearer ', '').trim();
}

// ── Helper: validasi token ada di DB ─────────────────────────────
function isValidToken(req, token) {
  if (!token) return false;
  const row = getDb(req).prepare('SELECT id FROM auth_tokens WHERE token = ?').get(token);
  return !!row;
}

// ════════════════════════════════════════════════════════════════
//  POST /api/auth/token — minta token baru (login pertama kali)
// ════════════════════════════════════════════════════════════════
router.post('/token', (req, res) => {
  try {
    const token = uuidv4();
    getDb(req).prepare('INSERT INTO auth_tokens (token) VALUES (?)').run(token);
    res.json({ success: true, token });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ════════════════════════════════════════════════════════════════
//  GET /api/auth/profile — ambil profil pengguna
// ════════════════════════════════════════════════════════════════
router.get('/profile', (req, res) => {
  const token = getToken(req);
  if (!isValidToken(req, token)) return res.status(401).json({ success: false, message: 'Token tidak valid' });

  const profile = getDb(req).prepare('SELECT nama, jabatan, avatar_color FROM profiles WHERE token = ?').get(token);
  if (!profile) return res.json({ success: true, data: null });

  res.json({ success: true, data: profile });
});

// ════════════════════════════════════════════════════════════════
//  PUT /api/auth/profile — simpan / update profil
// ════════════════════════════════════════════════════════════════
router.put('/profile', (req, res) => {
  const token = getToken(req);
  if (!isValidToken(req, token)) return res.status(401).json({ success: false, message: 'Token tidak valid' });

  const { nama, jabatan, avatar_color } = req.body;
  if (!nama || !nama.trim()) return res.status(400).json({ success: false, message: 'Nama wajib diisi' });

  const existing = getDb(req).prepare('SELECT id FROM profiles WHERE token = ?').get(token);
  if (existing) {
    getDb(req).prepare(`
      UPDATE profiles SET nama = ?, jabatan = ?, avatar_color = ?, updated_at = datetime('now','localtime')
      WHERE token = ?
    `).run(nama.trim(), jabatan || '', avatar_color || '#1a3a6b', token);
  } else {
    getDb(req).prepare(`
      INSERT INTO profiles (token, nama, jabatan, avatar_color) VALUES (?, ?, ?, ?)
    `).run(token, nama.trim(), jabatan || '', avatar_color || '#1a3a6b');
  }

  res.json({ success: true, message: 'Profil berhasil disimpan' });
});

// ════════════════════════════════════════════════════════════════
//  GET /api/auth/pin — ambil PIN modul
// ════════════════════════════════════════════════════════════════
router.get('/pin', (req, res) => {
  const token = getToken(req);
  if (!isValidToken(req, token)) return res.status(401).json({ success: false, message: 'Token tidak valid' });

  const row = getDb(req).prepare("SELECT value FROM app_settings WHERE key = 'module_pin'").get();
  res.json({ success: true, pin: row ? row.value : '1234' });
});

// ════════════════════════════════════════════════════════════════
//  PUT /api/auth/pin — ubah PIN modul
// ════════════════════════════════════════════════════════════════
router.put('/pin', (req, res) => {
  const token = getToken(req);
  if (!isValidToken(req, token)) return res.status(401).json({ success: false, message: 'Token tidak valid' });

  const { oldPin, newPin } = req.body;
  const row = getDb(req).prepare("SELECT value FROM app_settings WHERE key = 'module_pin'").get();
  const currentPin = row ? row.value : '1234';

  if (oldPin !== currentPin) return res.status(400).json({ success: false, message: 'PIN lama tidak sesuai' });
  if (!newPin || newPin.length < 4) return res.status(400).json({ success: false, message: 'PIN baru minimal 4 karakter' });

  getDb(req).prepare("UPDATE app_settings SET value = ? WHERE key = 'module_pin'").run(newPin);
  res.json({ success: true, message: 'PIN berhasil diubah' });
});

module.exports = router;
