// db.js — SQLite database menggunakan sql.js (pure JavaScript, tanpa kompilasi)
const path = require('path');
const fs   = require('fs');

const DB_PATH = path.join(__dirname, 'btis.db');

let _inner = null; // objek sql.js Database
let _SQL   = null;

// ── Simpan database ke file ───────────────────────────────────────
function save() {
  if (!_inner) return;
  fs.writeFileSync(DB_PATH, Buffer.from(_inner.export()));
}

// ── Wrapper kompatibel dengan API better-sqlite3 (synchronous) ────
function makeWrapper() {
  return {
    pragma: () => {},

    exec(sql) {
      _inner.run(sql);
      save();
      return this;
    },

    prepare(sql) {
      return {
        // Ambil 1 baris
        get(...params) {
          const stmt = _inner.prepare(sql);
          stmt.bind(params.flat());
          const result = stmt.step() ? stmt.getAsObject() : undefined;
          stmt.free();
          return result;
        },
        // Ambil semua baris
        all(...params) {
          const stmt = _inner.prepare(sql);
          stmt.bind(params.flat());
          const rows = [];
          while (stmt.step()) rows.push(stmt.getAsObject());
          stmt.free();
          return rows;
        },
        // Jalankan query (INSERT / UPDATE / DELETE)
        run(...params) {
          _inner.run(sql, params.flat());
          const changes = _inner.getRowsModified();
          const res     = _inner.exec('SELECT last_insert_rowid()');
          const lastInsertRowid = res[0]?.values[0]?.[0] || 0;
          save();
          return { changes, lastInsertRowid };
        }
      };
    },

    // Transaction: jalankan banyak operasi sekaligus
    transaction(fn) {
      return (...args) => {
        _inner.run('BEGIN');
        try {
          fn(...args);
          _inner.run('COMMIT');
        } catch (e) {
          _inner.run('ROLLBACK');
          throw e;
        }
        save();
      };
    }
  };
}

// ── Inisialisasi database (async, dipanggil 1x dari server.js) ────
async function init() {
  const initSqlJs = require('sql.js');
  _SQL = await initSqlJs();

  const fileBuffer = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH) : null;
  _inner = fileBuffer ? new _SQL.Database(fileBuffer) : new _SQL.Database();

  // Buat semua tabel
  _inner.run(`PRAGMA foreign_keys = ON;`);
  _inner.run(`
    CREATE TABLE IF NOT EXISTS auth_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT OR IGNORE INTO app_settings (key, value) VALUES ('module_pin', '1234');

    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE, nama TEXT NOT NULL,
      jabatan TEXT NOT NULL DEFAULT '', avatar_color TEXT NOT NULL DEFAULT '#1a3a6b',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS kalender_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tanggal TEXT NOT NULL, nama TEXT NOT NULL,
      tipe TEXT NOT NULL DEFAULT 'kegiatan', he INTEGER NOT NULL DEFAULT 1,
      semester TEXT, tahun_ajar TEXT NOT NULL DEFAULT '', catatan TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS tt_tahun_ajar (
      id INTEGER PRIMARY KEY AUTOINCREMENT, nama TEXT NOT NULL UNIQUE, aktif INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS tt_kelas (
      id INTEGER PRIMARY KEY AUTOINCREMENT, nama TEXT NOT NULL,
      tingkat TEXT NOT NULL DEFAULT '', parallel TEXT NOT NULL DEFAULT '',
      ta_id INTEGER REFERENCES tt_tahun_ajar(id)
    );
    CREATE TABLE IF NOT EXISTS tt_guru (
      id INTEGER PRIMARY KEY AUTOINCREMENT, nama TEXT NOT NULL,
      kode TEXT NOT NULL DEFAULT '', mapel TEXT NOT NULL DEFAULT '',
      max_jp INTEGER NOT NULL DEFAULT 24, ta_id INTEGER REFERENCES tt_tahun_ajar(id)
    );
    CREATE TABLE IF NOT EXISTS tt_mapel (
      id INTEGER PRIMARY KEY AUTOINCREMENT, nama TEXT NOT NULL,
      kode TEXT NOT NULL DEFAULT '', warna TEXT NOT NULL DEFAULT '#1a3a6b',
      ta_id INTEGER REFERENCES tt_tahun_ajar(id)
    );
    CREATE TABLE IF NOT EXISTS tt_jadwal (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kelas_id INTEGER NOT NULL, guru_id INTEGER, mapel_id INTEGER,
      hari TEXT NOT NULL, jam_ke INTEGER NOT NULL, ta_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      judul TEXT NOT NULL, tanggal TEXT NOT NULL,
      waktu_mulai TEXT NOT NULL DEFAULT '', waktu_selesai TEXT NOT NULL DEFAULT '',
      tempat TEXT NOT NULL DEFAULT '', pimpinan TEXT NOT NULL DEFAULT '',
      agenda TEXT NOT NULL DEFAULT '', notulensi TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'terjadwal',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS meeting_peserta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id INTEGER NOT NULL, nama TEXT NOT NULL,
      jabatan TEXT NOT NULL DEFAULT '', hadir INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nip TEXT NOT NULL DEFAULT '', nama TEXT NOT NULL,
      jenis_kelamin TEXT NOT NULL DEFAULT '', jabatan TEXT NOT NULL DEFAULT '',
      mapel_utama TEXT NOT NULL DEFAULT '', mapel_lain TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'aktif', no_hp TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '', alamat TEXT NOT NULL DEFAULT '',
      tanggal_masuk TEXT NOT NULL DEFAULT '', catatan TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL DEFAULT '', judul TEXT NOT NULL,
      deskripsi TEXT NOT NULL DEFAULT '', prioritas TEXT NOT NULL DEFAULT 'normal',
      status TEXT NOT NULL DEFAULT 'todo', tenggat TEXT NOT NULL DEFAULT '',
      kategori TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS supervisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guru_id INTEGER, nama_guru TEXT NOT NULL DEFAULT '',
      kelas TEXT NOT NULL DEFAULT '', mapel TEXT NOT NULL DEFAULT '',
      tanggal TEXT NOT NULL, jam TEXT NOT NULL DEFAULT '',
      supervisor TEXT NOT NULL DEFAULT '', skor_total REAL NOT NULL DEFAULT 0,
      catatan TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS supervision_aspek (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supervision_id INTEGER NOT NULL, aspek TEXT NOT NULL,
      skor INTEGER NOT NULL DEFAULT 0, keterangan TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS tahfidz_siswa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nis TEXT NOT NULL DEFAULT '', nama TEXT NOT NULL,
      kelas TEXT NOT NULL DEFAULT '', target_surah TEXT NOT NULL DEFAULT '',
      target_juz INTEGER NOT NULL DEFAULT 1, musyrif TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'aktif',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS tahfidz_setoran (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      siswa_id INTEGER NOT NULL, tanggal TEXT NOT NULL, surah TEXT NOT NULL,
      ayat_dari INTEGER NOT NULL DEFAULT 1, ayat_sampai INTEGER NOT NULL DEFAULT 1,
      jenis TEXT NOT NULL DEFAULT 'setoran', nilai TEXT NOT NULL DEFAULT 'B',
      musyrif TEXT NOT NULL DEFAULT '', catatan TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `);

  save();
  console.log('✅ Database siap:', DB_PATH);
  return makeWrapper();
}

module.exports = { init };
