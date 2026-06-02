# 🏫 BTIS Manager — Backend API

Backend untuk **Bojana Tirta Islamic School Manager** menggunakan **Node.js + Express + SQLite**.

---

## 📁 Struktur Folder

```
btis-backend/
├── server.js          ← Entry point, jalankan ini
├── db.js              ← Setup database & semua tabel
├── package.json
├── btis.db            ← File database SQLite (otomatis dibuat)
├── public/            ← ⬅️ Taruh semua file HTML di sini
│   ├── index.html
│   ├── meeting.html
│   ├── teacher.html
│   └── ... (semua file .html lainnya)
└── routes/
    ├── auth.js         ← Token, profil, PIN
    ├── calendar.js     ← Academic Calendar
    ├── meeting.js      ← Meeting Manager
    ├── teacher.js      ← Teacher Manager
    ├── task.js         ← My Task
    ├── supervision.js  ← Supervision
    ├── tahfidz.js      ← Tahfidz Manager
    └── timetable.js    ← Timetable Manager
```

---

## ⚡ Cara Menjalankan

### 1. Pastikan Node.js sudah terinstal
Download dari https://nodejs.org (pilih versi LTS)

### 2. Install dependencies
```bash
cd btis-backend
npm install
```

### 3. Taruh file HTML ke folder `public`
Buat folder `public` di dalam `btis-backend`, lalu **copy semua file `.html`** ke sana.

### 4. Jalankan server
```bash
node server.js
```
atau untuk auto-reload saat file berubah:
```bash
npm run dev
```

### 5. Buka di browser
```
http://localhost:3000
```

---

## 🔌 Daftar API Endpoint

### Auth & Profil
| Method | URL | Keterangan |
|--------|-----|------------|
| POST | `/api/auth/token` | Minta token baru |
| GET | `/api/auth/profile` | Ambil profil |
| PUT | `/api/auth/profile` | Simpan profil |
| GET | `/api/auth/pin` | Ambil PIN modul |
| PUT | `/api/auth/pin` | Ubah PIN modul |

### Academic Calendar
| Method | URL | Keterangan |
|--------|-----|------------|
| GET | `/api/calendar` | Ambil semua event |
| POST | `/api/calendar` | Tambah event |
| POST | `/api/calendar/bulk` | Tambah banyak event |
| PUT | `/api/calendar/:id` | Edit event |
| DELETE | `/api/calendar/:id` | Hapus event |

### Meeting
| Method | URL | Keterangan |
|--------|-----|------------|
| GET | `/api/meeting` | Daftar meeting |
| GET | `/api/meeting/:id` | Detail + peserta |
| POST | `/api/meeting` | Buat meeting |
| PUT | `/api/meeting/:id` | Edit meeting |
| PATCH | `/api/meeting/:id/status` | Ubah status |
| DELETE | `/api/meeting/:id` | Hapus meeting |

### Teacher
| Method | URL | Keterangan |
|--------|-----|------------|
| GET | `/api/teacher` | Daftar guru |
| GET | `/api/teacher/stats` | Statistik guru |
| POST | `/api/teacher` | Tambah guru |
| PUT | `/api/teacher/:id` | Edit guru |
| DELETE | `/api/teacher/:id` | Hapus guru |

### My Task
| Method | URL | Keterangan |
|--------|-----|------------|
| GET | `/api/task` | Daftar task milik saya |
| GET | `/api/task/stats` | Statistik task |
| POST | `/api/task` | Tambah task |
| PUT | `/api/task/:id` | Edit task |
| PATCH | `/api/task/:id/status` | Update status |
| DELETE | `/api/task/:id` | Hapus task |

### Supervision
| Method | URL | Keterangan |
|--------|-----|------------|
| GET | `/api/supervision` | Daftar supervisi |
| GET | `/api/supervision/stats` | Statistik |
| GET | `/api/supervision/:id` | Detail + aspek |
| POST | `/api/supervision` | Buat supervisi |
| PUT | `/api/supervision/:id` | Edit supervisi |
| PATCH | `/api/supervision/:id/finalize` | Finalisasi |
| DELETE | `/api/supervision/:id` | Hapus |

### Tahfidz
| Method | URL | Keterangan |
|--------|-----|------------|
| GET | `/api/tahfidz/siswa` | Daftar siswa |
| GET | `/api/tahfidz/siswa/:id` | Detail + setoran |
| POST | `/api/tahfidz/siswa` | Tambah siswa |
| PUT | `/api/tahfidz/siswa/:id` | Edit siswa |
| GET | `/api/tahfidz/setoran` | Daftar setoran |
| POST | `/api/tahfidz/setoran` | Input setoran |
| GET | `/api/tahfidz/stats` | Statistik |

### Timetable
| Method | URL | Keterangan |
|--------|-----|------------|
| GET | `/api/timetable/tahun-ajar` | Daftar tahun ajaran |
| GET | `/api/timetable/kelas` | Daftar kelas |
| GET | `/api/timetable/guru` | Daftar guru |
| GET | `/api/timetable/mapel` | Daftar mapel |
| GET | `/api/timetable/jadwal` | Jadwal pelajaran |
| POST | `/api/timetable/jadwal` | Tambah slot jadwal |
| DELETE | `/api/timetable/jadwal/:id` | Hapus slot jadwal |

---

## 🔐 Autentikasi

Semua request yang memerlukan identitas pengguna harus menyertakan header:
```
Authorization: Bearer <token>
```
Token didapat dari `POST /api/auth/token`.

---

## 💡 Tips

- File database `btis.db` ada di folder `btis-backend/`, **backup file ini** untuk menjaga data.
- Untuk development, gunakan `npm run dev` agar server otomatis restart saat ada perubahan kode.
- Untuk mengecek API berjalan, buka `http://localhost:3000/api/ping`
