// db.js — MySQL database menggunakan mysql2
const mysql = require('mysql2/promise');

let pool;

async function init() {
  pool = mysql.createPool({
    host:     process.env.DB_HOST || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'btis_manager',
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
  });

  const tables = [
    `CREATE TABLE IF NOT EXISTS auth_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      token VARCHAR(255) NOT NULL UNIQUE,
      created_at DATETIME NOT NULL DEFAULT NOW()
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS app_settings (
      \`key\` VARCHAR(100) PRIMARY KEY,
      value VARCHAR(255) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `INSERT IGNORE INTO app_settings (\`key\`, value) VALUES ('module_pin', '1234')`,
    `INSERT IGNORE INTO app_settings (\`key\`, value) VALUES ('LOCK_PASSWORD', 'imron')`,
    `INSERT IGNORE INTO app_settings (\`key\`, value) VALUES ('active_ta_name', '')`,

    `CREATE TABLE IF NOT EXISTS profiles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      token VARCHAR(255) NOT NULL UNIQUE,
      nama VARCHAR(255) NOT NULL,
      jabatan VARCHAR(255) NOT NULL DEFAULT '',
      avatar_color VARCHAR(20) NOT NULL DEFAULT '#1a3a6b',
      created_at DATETIME NOT NULL DEFAULT NOW(),
      updated_at DATETIME NOT NULL DEFAULT NOW()
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS timetable_data (
      \`key\` VARCHAR(150) PRIMARY KEY,
      value MEDIUMTEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS calendar_settings (
      \`key\` VARCHAR(100) PRIMARY KEY,
      value MEDIUMTEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS kalender_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tanggal DATE NOT NULL,
      nama VARCHAR(255) NOT NULL,
      tipe VARCHAR(50) NOT NULL DEFAULT 'kegiatan',
      he INT NOT NULL DEFAULT 1,
      semester VARCHAR(50),
      tahun_ajar VARCHAR(20) NOT NULL DEFAULT '',
      catatan TEXT,
      created_at DATETIME NOT NULL DEFAULT NOW()
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS tt_tahun_ajar (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nama VARCHAR(100) NOT NULL UNIQUE,
      aktif INT NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS tt_kelas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nama VARCHAR(100) NOT NULL,
      tingkat VARCHAR(50) NOT NULL DEFAULT '',
      parallel VARCHAR(10) NOT NULL DEFAULT '',
      ta_id INT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS tt_guru (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nama VARCHAR(255) NOT NULL,
      kode VARCHAR(20) NOT NULL DEFAULT '',
      mapel VARCHAR(255) NOT NULL DEFAULT '',
      max_jp INT NOT NULL DEFAULT 24,
      ta_id INT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS tt_mapel (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nama VARCHAR(255) NOT NULL,
      kode VARCHAR(20) NOT NULL DEFAULT '',
      warna VARCHAR(20) NOT NULL DEFAULT '#1a3a6b',
      ta_id INT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS tt_jadwal (
      id INT AUTO_INCREMENT PRIMARY KEY,
      kelas_id INT NOT NULL,
      guru_id INT,
      mapel_id INT,
      hari VARCHAR(10) NOT NULL,
      jam_ke INT NOT NULL,
      ta_id INT,
      created_at DATETIME NOT NULL DEFAULT NOW()
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS meetings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      judul VARCHAR(255) NOT NULL,
      tanggal DATE NOT NULL,
      waktu_mulai VARCHAR(10) NOT NULL DEFAULT '',
      waktu_selesai VARCHAR(10) NOT NULL DEFAULT '',
      tempat VARCHAR(255) NOT NULL DEFAULT '',
      pimpinan VARCHAR(255) NOT NULL DEFAULT '',
      agenda TEXT,
      notulensi TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'terjadwal',
      created_at DATETIME NOT NULL DEFAULT NOW(),
      updated_at DATETIME NOT NULL DEFAULT NOW()
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS meeting_peserta (
      id INT AUTO_INCREMENT PRIMARY KEY,
      meeting_id INT NOT NULL,
      nama VARCHAR(255) NOT NULL,
      jabatan VARCHAR(255) NOT NULL DEFAULT '',
      hadir INT NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS teachers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nip VARCHAR(50) NOT NULL DEFAULT '',
      nama VARCHAR(255) NOT NULL,
      jenis_kelamin VARCHAR(1) NOT NULL DEFAULT '',
      jabatan VARCHAR(255) NOT NULL DEFAULT '',
      mapel_utama VARCHAR(255) NOT NULL DEFAULT '',
      mapel_lain VARCHAR(255) NOT NULL DEFAULT '',
      status VARCHAR(20) NOT NULL DEFAULT 'aktif',
      no_hp VARCHAR(20) NOT NULL DEFAULT '',
      email VARCHAR(255) NOT NULL DEFAULT '',
      alamat TEXT,
      tanggal_masuk DATE,
      catatan TEXT,
      created_at DATETIME NOT NULL DEFAULT NOW(),
      updated_at DATETIME NOT NULL DEFAULT NOW()
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      token VARCHAR(255) NOT NULL DEFAULT '',
      judul VARCHAR(255) NOT NULL,
      deskripsi TEXT,
      prioritas VARCHAR(20) NOT NULL DEFAULT 'normal',
      status VARCHAR(20) NOT NULL DEFAULT 'todo',
      tenggat DATE,
      kategori VARCHAR(100) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT NOW(),
      updated_at DATETIME NOT NULL DEFAULT NOW()
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS supervisions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      guru_id INT,
      nama_guru VARCHAR(255) NOT NULL DEFAULT '',
      kelas VARCHAR(50) NOT NULL DEFAULT '',
      mapel VARCHAR(255) NOT NULL DEFAULT '',
      tanggal DATE NOT NULL,
      jam VARCHAR(20) NOT NULL DEFAULT '',
      supervisor VARCHAR(255) NOT NULL DEFAULT '',
      skor_total DOUBLE NOT NULL DEFAULT 0,
      catatan TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      created_at DATETIME NOT NULL DEFAULT NOW(),
      updated_at DATETIME NOT NULL DEFAULT NOW()
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS supervision_aspek (
      id INT AUTO_INCREMENT PRIMARY KEY,
      supervision_id INT NOT NULL,
      aspek VARCHAR(255) NOT NULL,
      skor INT NOT NULL DEFAULT 0,
      keterangan TEXT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS tahfidz_siswa (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nis VARCHAR(50) NOT NULL DEFAULT '',
      nama VARCHAR(255) NOT NULL,
      kelas VARCHAR(20) NOT NULL DEFAULT '',
      target_surah VARCHAR(255) NOT NULL DEFAULT '',
      target_juz INT NOT NULL DEFAULT 1,
      musyrif VARCHAR(255) NOT NULL DEFAULT '',
      status VARCHAR(20) NOT NULL DEFAULT 'aktif',
      created_at DATETIME NOT NULL DEFAULT NOW()
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS tahfidz_setoran (
      id INT AUTO_INCREMENT PRIMARY KEY,
      siswa_id INT NOT NULL,
      tanggal DATE NOT NULL,
      surah VARCHAR(255) NOT NULL,
      ayat_dari INT NOT NULL DEFAULT 1,
      ayat_sampai INT NOT NULL DEFAULT 1,
      jenis VARCHAR(20) NOT NULL DEFAULT 'setoran',
      nilai VARCHAR(5) NOT NULL DEFAULT 'B',
      musyrif VARCHAR(255) NOT NULL DEFAULT '',
      catatan TEXT,
      created_at DATETIME NOT NULL DEFAULT NOW()
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  ];

  for (const sql of tables) {
    await pool.execute(sql);
  }

  console.log('✅ Database siap (MySQL):', process.env.DB_NAME || 'btis_manager');

  return {
    async query(sql, params = []) {
      const [rows] = await pool.execute(sql, params);
      return rows;
    },
    async queryOne(sql, params = []) {
      const [rows] = await pool.execute(sql, params);
      return rows[0];
    },
    async execute(sql, params = []) {
      const [result] = await pool.execute(sql, params);
      return result;
    },
    async transaction(fn) {
      const conn = await pool.getConnection();
      await conn.beginTransaction();
      try {
        await fn(conn);
        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    },
    pool,
  };
}

module.exports = { init };
