// server.js — Entry point BTIS Manager Backend
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','PATCH','DELETE'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Start: inisialisasi DB dulu, baru buka server ─────────────────
async function start() {
  try {
    // Init database dan simpan di app.locals agar bisa diakses routes
    const { init } = require('./db');
    const db = await init();
    app.locals.db = db;

    // Muat semua routes (setelah db siap)
    app.use('/api/auth',        require('./routes/auth'));
    app.use('/api/calendar',    require('./routes/calendar'));
    app.use('/api/meeting',     require('./routes/meeting'));
    app.use('/api/teacher',     require('./routes/teacher'));
    app.use('/api/task',        require('./routes/task'));
    app.use('/api/supervision', require('./routes/supervision'));
    app.use('/api/tahfidz',     require('./routes/tahfidz'));
    app.use('/api/timetable',   require('./routes/timetable'));

    // Health check
    app.get('/api/ping', (req, res) => res.json({
      success: true, message: 'BTIS Manager API aktif ✅',
      versi: '1.0.0', waktu: new Date().toLocaleString('id-ID')
    }));

    // SPA fallback
    app.get('*', (req, res) => {
      const indexFile = path.join(__dirname, 'public', 'index.html');
      const fs = require('fs');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.json({ success: true, message: 'BTIS Manager API berjalan. Taruh file HTML di folder public/' });
      }
    });

    // Error handler
    app.use((err, req, res, next) => {
      console.error('❌ Error:', err.message);
      res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
    });

    app.listen(PORT, () => {
      console.log(`\n🚀 BTIS Manager Backend berjalan di http://localhost:${PORT}`);
      console.log(`🔍 Cek API: http://localhost:${PORT}/api/ping\n`);
    });

  } catch (err) {
    console.error('❌ Gagal start server:', err.message);
    process.exit(1);
  }
}

start();
