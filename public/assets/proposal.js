/* ============================================================================
   proposal.js — Generator Proposal Kegiatan (tab di Teacher Manager)
   Daftar proposal tersimpan → form buat/edit → pratinjau (bisa diedit) →
   simpan ke server / unduh PDF (via print browser).
   Vanilla JS, tanpa dependency. Aktif hanya bila markup tab proposal ada.
   ========================================================================== */
(function () {
  if (!document.getElementById('pp-form')) return; // tab proposal tak ada → skip

  // ── Konstanta ─────────────────────────────────────────────────────────
  var LOGO_URL = 'assets/logo-sekolah.png';
  var SCHOOL = {
    name: 'Bojana Tirta Islamic School',
    address: 'Jalan Bujana Tirta Raya No. 3A, RT. 11/RW. 6, Kelurahan Pisangan Timur, Kecamatan Pulo Gadung, Jakarta Timur, 13230'
  };
  var DEFAULT_PANITIA = [
    'Penanggung Jawab', 'Koordinator Kegiatan', 'Ketua Panitia', 'Bendahara',
    'Bagian Acara', 'Bagian Perlengkapan', 'Bagian Konsumsi',
    'Bagian Humas & Publikasi', 'Bagian Dokumentasi', 'Bagian Keamanan'
  ].map(function (j) { return { jabatan: j, nama: '' }; });
  var DEFAULT_ACARA = [
    'Registrasi peserta', 'Pembukaan', 'Sambutan-sambutan', 'Acara inti',
    'Ishoma', 'Acara inti (lanjutan)', 'Pengumuman/Penutupan'
  ].map(function (k) { return { waktu: '', kegiatan: k, pj: '' }; });
  var DEFAULT_LAMPIRAN = [
    'Susunan Panitia Lengkap (jika berbeda dari Bab III)',
    'Surat Permohonan Izin Tempat/Kegiatan',
    'Surat Permohonan Sponsor/Dana (jika ada)',
    'Denah Lokasi Kegiatan',
    'Dokumen Pendukung Lainnya'
  ].map(function (t) { return { label: t, checked: false }; });

  var PP_PAGE_SIZE = 10;

  // ── State ─────────────────────────────────────────────────────────────
  // freshState(): buffer default untuk proposal baru / reset form.
  function freshState() {
    var s = {
      namaKegiatan: '', temaKegiatan: '', tahunAjaran: '2026/2027', namaPIC: '',
      kotaPengajuan: 'Jakarta Timur', tanggalPengajuan: '',
      hariTanggal: '', jamMulai: '', jamSelesai: '', tempatPelaksanaan: '',
      bentukKegiatan: '', sasaranPeserta: '',
      latarBelakang: '', dasarPemikiran: [], tujuanKegiatan: [''],
      deskripsiSingkat: '',
      panitia: JSON.parse(JSON.stringify(DEFAULT_PANITIA)),
      anggaranGambar: [],
      acara: JSON.parse(JSON.stringify(DEFAULT_ACARA)),
      acaraGambar: [],
      totalAnggaran: '', ketuaNama: '', wakilKepsekNama: '', kepsekNama: '',
      lampiran: JSON.parse(JSON.stringify(DEFAULT_LAMPIRAN))
    };
    s.dasarPemikiran = [
      'Program Kerja Tahun Ajaran ' + s.tahunAjaran,
      'Kalender Pendidikan Sekolah ' + s.tahunAjaran,
      'Hasil rapat panitia tanggal [Tanggal Rapat]'
    ];
    return s;
  }

  var state = freshState();   // proposal yang sedang dibuka/diedit
  var currentId = null;       // id record aktif (null = proposal baru)
  var proposals = [];         // metadata daftar proposal
  var ppSearch = '';
  var ppPage = 1;

  // ── Helpers ───────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function uid() { return 'img_' + Math.random().toString(36).slice(2, 10); }
  function $(id) { return document.getElementById(id); }
  function authHeaders(extra) {
    // Pakai helper global dari teacher.html bila ada (menyertakan token admin).
    if (typeof _authHeaders === 'function') return _authHeaders(extra);
    return Object.assign({ 'Content-Type': 'application/json', 'Accept': 'application/json' }, extra || {});
  }
  function ppToast(msg, isError) {
    var t = $('pp-toast');
    t.textContent = msg;
    t.classList.toggle('error', !!isError);
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.remove('show'); }, isError ? 6000 : 2600);
  }
  function formatTanggal(iso) {
    if (!iso) return '';
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    var bln = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return d.getDate() + ' ' + bln[d.getMonth()] + ' ' + d.getFullYear();
  }
  function shortDate(s) {
    if (typeof fmtDate === 'function') return fmtDate(s); // helper global
    if (!s) return '';
    try { return new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch (e) { return ''; }
  }

  // ── Bind field teks sederhana ─────────────────────────────────────────
  var TEXT_FIELDS = [
    'namaKegiatan', 'temaKegiatan', 'tahunAjaran', 'namaPIC', 'kotaPengajuan', 'tanggalPengajuan',
    'hariTanggal', 'jamMulai', 'jamSelesai', 'tempatPelaksanaan', 'bentukKegiatan', 'sasaranPeserta',
    'latarBelakang', 'deskripsiSingkat',
    'totalAnggaran', 'ketuaNama', 'wakilKepsekNama', 'kepsekNama'
  ];
  // Pasang listener sekali saja; nilainya diisi ulang lewat fillTextFields().
  function attachTextListeners() {
    TEXT_FIELDS.forEach(function (key) {
      var el = $('f_' + key); if (!el) return;
      el.addEventListener('input', function () { state[key] = el.value; });
    });
  }
  function fillTextFields() {
    TEXT_FIELDS.forEach(function (key) {
      var el = $('f_' + key); if (!el) return;
      el.value = state[key] == null ? '' : state[key];
    });
  }

  // ── List dinamis (dasar pemikiran, tujuan, panitia, acara, lampiran) ──
  function renderDasarPemikiran() {
    var box = $('dpList');
    box.innerHTML = state.dasarPemikiran.map(function (d, i) {
      return '<div class="pp-list-row"><div class="pp-list-idx">' + (i + 1) + '.</div>' +
        '<input type="text" data-i="' + i + '" value="' + esc(d) + '">' +
        '<button type="button" class="pp-btn-remove" data-i="' + i + '" title="Hapus">&times;</button></div>';
    }).join('');
    box.querySelectorAll('input').forEach(function (inp) {
      inp.addEventListener('input', function (e) { state.dasarPemikiran[+e.target.dataset.i] = e.target.value; });
    });
    box.querySelectorAll('.pp-btn-remove').forEach(function (btn) {
      btn.addEventListener('click', function (e) { state.dasarPemikiran.splice(+e.currentTarget.dataset.i, 1); renderDasarPemikiran(); });
    });
  }
  function renderTujuan() {
    var box = $('tjList');
    box.innerHTML = state.tujuanKegiatan.map(function (t, i) {
      return '<div class="pp-list-row"><div class="pp-list-idx">' + (i + 1) + '.</div>' +
        '<input type="text" data-i="' + i + '" value="' + esc(t) + '" placeholder="Misal: Meningkatkan kreativitas siswa">' +
        '<button type="button" class="pp-btn-remove" data-i="' + i + '" title="Hapus">&times;</button></div>';
    }).join('');
    box.querySelectorAll('input').forEach(function (inp) {
      inp.addEventListener('input', function (e) { state.tujuanKegiatan[+e.target.dataset.i] = e.target.value; });
    });
    box.querySelectorAll('.pp-btn-remove').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        if (state.tujuanKegiatan.length <= 1) return;
        state.tujuanKegiatan.splice(+e.currentTarget.dataset.i, 1); renderTujuan();
      });
    });
  }
  function renderPanitia() {
    var box = $('pnList');
    box.innerHTML = state.panitia.map(function (p, i) {
      return '<div class="pp-panitia-row">' +
        '<input type="text" class="pn-j" data-i="' + i + '" value="' + esc(p.jabatan) + '" placeholder="Jabatan">' +
        '<input type="text" class="pn-n" data-i="' + i + '" value="' + esc(p.nama) + '" placeholder="Nama lengkap">' +
        '<button type="button" class="pp-btn-remove" data-i="' + i + '" title="Hapus">&times;</button></div>';
    }).join('');
    box.querySelectorAll('.pn-j').forEach(function (inp) { inp.addEventListener('input', function (e) { state.panitia[+e.target.dataset.i].jabatan = e.target.value; }); });
    box.querySelectorAll('.pn-n').forEach(function (inp) { inp.addEventListener('input', function (e) { state.panitia[+e.target.dataset.i].nama = e.target.value; }); });
    box.querySelectorAll('.pp-btn-remove').forEach(function (btn) { btn.addEventListener('click', function (e) { state.panitia.splice(+e.currentTarget.dataset.i, 1); renderPanitia(); }); });
  }
  function renderAcara() {
    var box = $('acList');
    box.innerHTML = state.acara.map(function (a, i) {
      return '<div class="pp-acara-row">' +
        '<input type="text" class="ac-w" data-i="' + i + '" value="' + esc(a.waktu) + '" placeholder="Jam">' +
        '<input type="text" class="ac-k" data-i="' + i + '" value="' + esc(a.kegiatan) + '" placeholder="Kegiatan">' +
        '<input type="text" class="ac-p" data-i="' + i + '" value="' + esc(a.pj) + '" placeholder="Penanggung jawab">' +
        '<button type="button" class="pp-btn-remove" data-i="' + i + '" title="Hapus">&times;</button></div>';
    }).join('');
    box.querySelectorAll('.ac-w').forEach(function (inp) { inp.addEventListener('input', function (e) { state.acara[+e.target.dataset.i].waktu = e.target.value; }); });
    box.querySelectorAll('.ac-k').forEach(function (inp) { inp.addEventListener('input', function (e) { state.acara[+e.target.dataset.i].kegiatan = e.target.value; }); });
    box.querySelectorAll('.ac-p').forEach(function (inp) { inp.addEventListener('input', function (e) { state.acara[+e.target.dataset.i].pj = e.target.value; }); });
    box.querySelectorAll('.pp-btn-remove').forEach(function (btn) { btn.addEventListener('click', function (e) { state.acara.splice(+e.currentTarget.dataset.i, 1); renderAcara(); }); });
  }
  function renderLampiran() {
    var box = $('lpList');
    box.innerHTML = state.lampiran.map(function (l, i) {
      return '<div class="pp-check"><input type="checkbox" id="lp_' + i + '" data-i="' + i + '" ' + (l.checked ? 'checked' : '') + '>' +
        '<label for="lp_' + i + '">' + esc(l.label) + '</label></div>';
    }).join('');
    box.querySelectorAll('input[type=checkbox]').forEach(function (cb) {
      cb.addEventListener('change', function (e) { state.lampiran[+e.target.dataset.i].checked = e.target.checked; });
    });
  }

  // ── Unggah gambar (anggaran & rundown) ────────────────────────────────
  function renderImageGrid(key, gridId) {
    var grid = $(gridId);
    grid.innerHTML = state[key].map(function (img) {
      return '<div class="pp-img-card"><img src="' + img.dataUrl + '" alt="' + esc(img.name) + '">' +
        '<div class="pp-img-name">' + esc(img.name) + '</div>' +
        '<button type="button" class="pp-img-remove" data-id="' + img.id + '" title="Hapus">&times;</button></div>';
    }).join('');
    grid.querySelectorAll('.pp-img-remove').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        var id = e.currentTarget.dataset.id;
        state[key] = state[key].filter(function (im) { return im.id !== id; });
        renderImageGrid(key, gridId);
      });
    });
  }
  function readImageFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file.type.startsWith('image/')) { resolve(null); return; }
      var reader = new FileReader();
      reader.onerror = function () { reject(reader.error); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('Gagal memuat gambar')); };
        img.onload = function () {
          var MAX = 1400, w = img.naturalWidth, h = img.naturalHeight;
          if (w > MAX || h > MAX) { var s = Math.min(MAX / w, MAX / h); w = Math.round(w * s); h = Math.round(h * s); }
          var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
          cv.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve({ id: uid(), dataUrl: cv.toDataURL('image/png'), name: file.name, width: w, height: h });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
  function handleImageFiles(key, gridId, fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    var chain = Promise.resolve();
    files.forEach(function (file) {
      chain = chain.then(function () {
        return readImageFile(file).then(function (entry) { if (entry) state[key].push(entry); })
          .catch(function () { ppToast('Gagal memuat gambar: ' + file.name, true); });
      });
    });
    chain.then(function () { renderImageGrid(key, gridId); });
  }
  function wireImageUpload(key, dropId, inputId, gridId) {
    var drop = $(dropId), input = $(inputId);
    input.addEventListener('change', function (e) { handleImageFiles(key, gridId, e.target.files); input.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); drop.classList.add('dragover'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); drop.classList.remove('dragover'); }); });
    drop.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files) handleImageFiles(key, gridId, e.dataTransfer.files); });
  }

  // ── Tombol tambah baris ───────────────────────────────────────────────
  function wireAddButtons() {
    $('addDP').addEventListener('click', function () { state.dasarPemikiran.push(''); renderDasarPemikiran(); });
    $('addTJ').addEventListener('click', function () { state.tujuanKegiatan.push(''); renderTujuan(); });
    $('addPN').addEventListener('click', function () { state.panitia.push({ jabatan: '', nama: '' }); renderPanitia(); });
    $('addAC').addEventListener('click', function () { state.acara.push({ waktu: '', kegiatan: '', pj: '' }); renderAcara(); });
  }

  // ── Builder dokumen (HTML preview yang meniru template Word) ───────────
  function docH1(t) { return '<div class="doc-h1">' + esc(t) + '</div>'; }
  function docH2(t) { return '<div class="doc-h2">' + esc(t) + '</div>'; }
  function docP(t, cls) { return '<div class="doc-p ' + (cls || '') + '">' + esc(t || '—').replace(/\n/g, '<br>') + '</div>'; }
  function docCenter(t, cls) { return '<div class="doc-p doc-center ' + (cls || '') + '">' + esc(t) + '</div>'; }
  function docUl(items) { return '<ul>' + items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>'; }
  function docOl(items) { return '<ol>' + items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>'; }
  function docImg(dataUrl, name, maxMm) { return '<img class="doc-img" src="' + dataUrl + '" alt="' + esc(name || '') + '" style="max-width:' + (maxMm || 150) + 'mm;">'; }
  function docLabelValue(rows) {
    return '<table class="doc-table label-value"><tbody>' +
      rows.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1] || '—') + '</td></tr>'; }).join('') +
      '</tbody></table>';
  }
  function buildPanitiaRows(panitia) {
    // Jabatan sama & berurutan digabung (rowspan), meniru sel gabungan template.
    var out = [], i = 0;
    while (i < panitia.length) {
      var jab = panitia[i].jabatan, j = i, names = [];
      while (j < panitia.length && panitia[j].jabatan === jab) { names.push(panitia[j].nama || '[Nama Lengkap]'); j++; }
      out.push('<tr><td' + (names.length > 1 ? ' rowspan="' + names.length + '"' : '') + '>' + esc(jab || '[Jabatan]') + '</td><td>' + esc(names[0]) + '</td></tr>');
      for (var k = 1; k < names.length; k++) out.push('<tr><td>' + esc(names[k]) + '</td></tr>');
      i = j;
    }
    return out.join('');
  }
  function buildProposalHTML() {
    var waktuPelaksanaan = state.hariTanggal + (state.jamMulai ? ', ' + state.jamMulai + ' - ' + state.jamSelesai : '');

    var cover =
      '<div class="doc-section">' +
        docCenter('PROPOSAL KEGIATAN', 'doc-bold doc-cover-title') +
        docCenter((state.namaKegiatan || '[Nama Kegiatan]').toUpperCase(), 'doc-bold doc-cover-heading') +
        docCenter('Tahun Ajaran ' + (state.tahunAjaran || '[Tahun Ajaran]'), 'doc-bold doc-cover-heading') +
        docCenter(state.temaKegiatan ? '"' + state.temaKegiatan + '"' : '"[Tema Kegiatan]"', 'doc-bold doc-italic doc-cover-heading') +
        '<img class="doc-logo" src="' + LOGO_URL + '" alt="Logo" onerror="this.style.display=\'none\'">' +
        docCenter('Diajukan oleh PIC:', 'doc-bold doc-cover-pic') +
        docCenter(state.namaPIC || '[Nama PIC]', 'doc-bold doc-cover-pic') +
        docCenter(SCHOOL.name, 'doc-italic doc-cover-school') +
        docCenter(SCHOOL.address, 'doc-italic doc-cover-school') +
      '</div>';

    var pengesahan =
      '<div class="doc-section">' +
        docH1('LEMBAR PENGESAHAN') +
        docP('Sehubungan dengan rencana pelaksanaan kegiatan berikut, dengan ini kami mengajukan proposal untuk mendapatkan persetujuan dan dukungan dari pihak sekolah:') +
        docLabelValue([
          ['Nama Kegiatan', state.namaKegiatan], ['Tema Kegiatan', state.temaKegiatan],
          ['Waktu Pelaksanaan', waktuPelaksanaan], ['Tempat Pelaksanaan', state.tempatPelaksanaan],
          ['Perkiraan Anggaran', state.totalAnggaran]
        ]) +
        docP('Demikian proposal ini kami ajukan. Besar harapan kami agar kegiatan ini dapat disetujui dan terlaksana dengan baik.') +
        docP((state.kotaPengajuan || '[Kota]') + ', ' + (formatTanggal(state.tanggalPengajuan) || '[Tanggal Pengajuan]'), 'doc-italic') +
        '<table class="doc-table doc-sign"><tbody>' +
          '<tr><td class="doc-bold">Ketua Panitia</td><td class="doc-bold">Mengetahui,<br>Wakil Kepala Sekolah,</td></tr>' +
          '<tr class="sig-blank"><td>&nbsp;</td><td>&nbsp;</td></tr>' +
          '<tr class="sig-blank"><td>&nbsp;</td><td>&nbsp;</td></tr>' +
          '<tr><td class="doc-bold">' + esc(state.ketuaNama || '[Nama Ketua]') + '</td><td class="doc-bold">' + esc(state.wakilKepsekNama || '[Nama Wakil Kepala Sekolah]') + '</td></tr>' +
        '</tbody></table>' +
        docP('Menyetujui,') +
        '<table class="doc-table doc-sign"><tbody>' +
          '<tr><td class="doc-bold">Kepala Sekolah</td></tr>' +
          '<tr class="sig-blank"><td>&nbsp;</td></tr>' +
          '<tr class="sig-blank"><td>&nbsp;</td></tr>' +
          '<tr><td class="doc-bold">' + esc(state.kepsekNama || '[Nama Kepala Sekolah]') + '</td></tr>' +
        '</tbody></table>' +
      '</div>';

    var babI =
      '<div class="doc-section">' + docH1('BAB I. PENDAHULUAN') +
        docH2('A. Latar Belakang') + docP(state.latarBelakang) +
        docH2('B. Dasar Pemikiran') + docUl(state.dasarPemikiran.filter(function (d) { return d.trim(); })) +
        docH2('C. Tujuan Kegiatan') + docOl(state.tujuanKegiatan.filter(function (t) { return t.trim(); })) +
      '</div>';

    var babII =
      '<div class="doc-section">' + docH1('BAB II. DESKRIPSI KEGIATAN') +
        docLabelValue([
          ['Nama Kegiatan', state.namaKegiatan], ['Tema Kegiatan', state.temaKegiatan],
          ['Bentuk Kegiatan', state.bentukKegiatan], ['Sasaran/Peserta', state.sasaranPeserta],
          ['Hari, Tanggal', state.hariTanggal],
          ['Waktu', state.jamMulai ? state.jamMulai + ' - ' + state.jamSelesai : ''],
          ['Tempat', state.tempatPelaksanaan]
        ]) +
        docH2('Deskripsi Singkat') + docP(state.deskripsiSingkat) +
      '</div>';

    var babIII =
      '<div class="doc-section">' + docH1('BAB III. SUSUNAN PANITIA') +
        docP('Sesuaikan jumlah dan jenis seksi/koordinator dengan skala kegiatan. Untuk kegiatan kecil, seksi dapat digabung.') +
        '<table class="doc-table"><thead><tr><th>Jabatan</th><th>Nama</th></tr></thead><tbody>' + buildPanitiaRows(state.panitia) + '</tbody></table>' +
      '</div>';

    var babIV =
      '<div class="doc-section">' + docH1('BAB IV. RENCANA ANGGARAN') +
        docP('Rincian sumber dana dan kebutuhan biaya kegiatan disertakan dalam bentuk gambar berikut.') +
        (state.anggaranGambar.length ? state.anggaranGambar.map(function (im) { return docImg(im.dataUrl, im.name); }).join('') : docP('[Belum ada gambar anggaran]', 'doc-italic')) +
      '</div>';

    var acaraRows = state.acara.map(function (a) { return '<tr><td>' + esc(a.waktu || '[Jam]') + '</td><td>' + esc(a.kegiatan) + '</td><td>' + esc(a.pj || '[Nama PJ]') + '</td></tr>'; }).join('');
    var babV =
      '<div class="doc-section">' + docH1('BAB V. SUSUNAN ACARA') +
        docP('Rundown berikut dapat disesuaikan dengan jenis dan durasi kegiatan.') +
        '<table class="doc-table"><thead><tr><th>Waktu</th><th>Kegiatan</th><th>Penanggung Jawab</th></tr></thead><tbody>' + acaraRows + '</tbody></table>' +
        state.acaraGambar.map(function (im) { return docImg(im.dataUrl, im.name); }).join('') +
      '</div>';

    var lampiranChecked = state.lampiran.filter(function (l) { return l.checked; });
    var babVI =
      '<div class="doc-section">' + docH1('BAB VI. PENUTUP') +
        docP('Demikian proposal kegiatan ini kami susun sebagai acuan dan pedoman pelaksanaan. Besar harapan kami agar seluruh pihak dapat memberikan dukungan, baik moril maupun materiil, demi kelancaran dan keberhasilan kegiatan ini.') +
        docP('Atas perhatian dan kerja samanya, kami ucapkan terima kasih.') +
        docH2('Lampiran') +
        docUl(lampiranChecked.map(function (l, i) { return 'Lampiran ' + (i + 1) + ': ' + l.label; }).concat(['Lampiran Laporan'])) +
      '</div>';

    var rubrikHeader = '<tr><th>No</th><th>Tujuan Kegiatan</th><th>Indikator Keberhasilan</th><th>Target</th><th>Realisasi/Capaian</th><th>Status (T/BT)</th><th>Catatan</th></tr>';
    var rubrikRows = [1, 2, 3].map(function (n) { return '<tr><td>' + n + '</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>'; }).join('');
    var garis = '...................................................................................................................';
    var laporan =
      '<div class="doc-section">' +
        docH1('LAMPIRAN') + docH1('LAPORAN KEGIATAN') +
        docH2('Rubrik Pencapaian Tujuan') +
        docP('Petunjuk Pengisian', 'doc-bold doc-italic') +
        docP('Isilah kolom Realisasi/Capaian berdasarkan hasil pelaksanaan kegiatan. Tentukan status Tercapai (T) atau Belum Tercapai (BT) sesuai target yang telah ditetapkan pada proposal.') +
        '<table class="doc-table"><thead>' + rubrikHeader + '</thead><tbody>' + rubrikRows + '</tbody></table>' +
        docH2('Evaluasi dan Tindak Lanjut') +
        docP('Kendala yang Dihadapi', 'doc-bold') + docP(garis) +
        docP('Faktor Pendukung', 'doc-bold') + docP(garis) +
        docP('Solusi yang Dilakukan', 'doc-bold') + docP(garis) +
        docP('Rekomendasi untuk Kegiatan Berikutnya', 'doc-bold') + docP(garis) +
        docP('Kesimpulan', 'doc-bold') + docP(garis) +
        docH2('Pengesahan') +
        '<table class="doc-table doc-approval"><tbody><tr>' +
          '<td>' +
            '<div class="doc-center doc-bold">Disusun oleh</div>' +
            '<div class="doc-center doc-italic">PIC Kegiatan</div>' +
            '<div class="sign-gap">Nama: ' + esc(state.namaPIC || '[Nama Lengkap]') + '</div>' +
            '<div>Tanggal:</div>' +
            '<div class="sign-space">Tanda Tangan:</div>' +
          '</td>' +
          '<td>' +
            '<div class="doc-center doc-bold">Diperiksa oleh</div>' +
            '<div class="doc-center doc-italic">Wakil Kepala Sekolah</div>' +
            '<div class="sign-gap">Nama: Muhammad Al Imron</div>' +
            '<div>Tanggal:</div>' +
            '<div class="sign-space">Tanda Tangan:</div>' +
          '</td>' +
        '</tr></tbody></table>' +
      '</div>';

    return cover + pengesahan + babI + babII + babIII + babIV + babV + babVI + laporan;
  }

  // ── Pratinjau & unduh (print) ─────────────────────────────────────────
  function renderPreview() {
    if (!state.namaKegiatan.trim()) {
      ppToast('Nama Kegiatan wajib diisi', true);
      $('pp-sec-info').scrollIntoView({ behavior: 'smooth', block: 'center' });
      $('f_namaKegiatan').focus();
      return;
    }
    $('previewDoc').innerHTML = buildProposalHTML();
    var sec = $('pp-sec-preview');
    sec.style.display = '';
    sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    ppToast('Pratinjau dibuat. Teks bisa diedit langsung sebelum diunduh.');
  }
  function wirePreviewButtons() {
    $('previewBtn').addEventListener('click', renderPreview);
    $('refreshPreviewBtn').addEventListener('click', renderPreview);
    $('downloadPdfBtn').addEventListener('click', function () {
      document.body.classList.add('pp-printing');
      window.print();
      setTimeout(function () { document.body.classList.remove('pp-printing'); }, 500);
    });
  }

  // ── Isi ulang seluruh form dari `state` ───────────────────────────────
  function hydrateForm() {
    fillTextFields();
    renderDasarPemikiran(); renderTujuan(); renderPanitia(); renderAcara(); renderLampiran();
    renderImageGrid('anggaranGambar', 'anggaranImgGrid');
    renderImageGrid('acaraGambar', 'acaraImgGrid');
    var pv = $('pp-sec-preview'); if (pv) pv.style.display = 'none';
    $('previewDoc').innerHTML = '';
  }

  // ── Navigasi daftar ⇄ form ────────────────────────────────────────────
  function showList() {
    $('pp-form-view').style.display = 'none';
    $('pp-list-view').style.display = '';
    window.scrollTo(0, 0);
    loadProposals();
  }
  function enterForm() {
    $('pp-form-title').textContent = currentId ? 'Edit Proposal' : 'Buat Proposal';
    $('pp-list-view').style.display = 'none';
    $('pp-form-view').style.display = '';
    hydrateForm();
    window.scrollTo(0, 0);
  }
  function openNew() {
    state = freshState();
    currentId = null;
    enterForm();
  }
  function openEditProposal(id) {
    fetch('/api/teacher/proposal/' + id, { headers: authHeaders() })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.data) { ppToast('Gagal memuat proposal', true); return; }
        var parsed = {};
        try { parsed = JSON.parse(j.data.data || '{}'); } catch (e) { parsed = {}; }
        state = Object.assign(freshState(), parsed); // isi field baru pakai default
        currentId = id;
        enterForm();
      })
      .catch(function () { ppToast('Gagal memuat proposal', true); });
  }

  // ── Simpan / hapus ────────────────────────────────────────────────────
  function saveProposal() {
    if (!state.namaKegiatan.trim()) {
      ppToast('Nama Kegiatan wajib diisi', true);
      $('pp-sec-info').scrollIntoView({ behavior: 'smooth', block: 'center' });
      $('f_namaKegiatan').focus();
      return;
    }
    var payload = {
      judul: state.namaKegiatan.trim(),
      nama_pic: state.namaPIC || '',
      tahun_ajaran: state.tahunAjaran || '',
      data: JSON.stringify(state)
    };
    var url = currentId ? '/api/teacher/proposal/' + currentId : '/api/teacher/proposal';
    var method = currentId ? 'PUT' : 'POST';
    var btns = [$('ppSaveBtn'), $('ppSaveBtn2')];
    btns.forEach(function (b) { if (b) b.disabled = true; });
    fetch(url, { method: method, headers: authHeaders(), body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.success) { ppToast('❌ ' + (j.message || 'Gagal menyimpan'), true); return; }
        ppToast('✅ Proposal disimpan');
        showList();
      })
      .catch(function () { ppToast('❌ Gagal menyimpan (jaringan)', true); })
      .finally(function () { btns.forEach(function (b) { if (b) b.disabled = false; }); });
  }
  function deleteProposal(id) {
    var p = proposals.find(function (x) { return x.id === id; });
    if (!confirm('Hapus proposal "' + (p ? p.judul : '') + '"? Tindakan ini tidak bisa dibatalkan.')) return;
    fetch('/api/teacher/proposal/' + id, { method: 'DELETE', headers: authHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.success) { ppToast('🗑️ Proposal dihapus'); loadProposals(); }
        else ppToast('❌ ' + (j.message || 'Gagal menghapus'), true);
      })
      .catch(function () { ppToast('❌ Gagal menghapus (jaringan)', true); });
  }

  // ── Daftar proposal ───────────────────────────────────────────────────
  function loadProposals() {
    fetch('/api/teacher/proposal', { headers: authHeaders() })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { proposals = (j && j.data) || []; renderProposalList(); })
      .catch(function () { renderProposalList(); });
  }
  function filteredProposals() {
    var q = ppSearch.trim().toLowerCase();
    if (!q) return proposals;
    return proposals.filter(function (p) {
      return String(p.judul || '').toLowerCase().indexOf(q) >= 0
          || String(p.nama_pic || '').toLowerCase().indexOf(q) >= 0
          || String(p.tahun_ajaran || '').toLowerCase().indexOf(q) >= 0;
    });
  }
  function buildPPPager(totalPages) {
    if (totalPages <= 1) return '';
    var html = '<button class="pg-btn" data-pg="' + (ppPage - 1) + '"' + (ppPage <= 1 ? ' disabled' : '') + '>‹</button>';
    var pages = [];
    for (var p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= ppPage - 1 && p <= ppPage + 1)) pages.push(p);
      else if (pages[pages.length - 1] !== '…') pages.push('…');
    }
    pages.forEach(function (p) {
      if (p === '…') html += '<span class="pg-ellipsis">…</span>';
      else html += '<button class="pg-btn' + (p === ppPage ? ' on' : '') + '" data-pg="' + p + '">' + p + '</button>';
    });
    html += '<button class="pg-btn" data-pg="' + (ppPage + 1) + '"' + (ppPage >= totalPages ? ' disabled' : '') + '>›</button>';
    return html;
  }
  function renderProposalList() {
    var el = $('pp-list'), pager = $('pp-pager'), countEl = $('pp-count');
    if (pager) pager.innerHTML = '';
    if (!proposals.length) {
      if (countEl) countEl.textContent = '';
      el.innerHTML = '<div class="empty-docs"><div class="ei">📭</div><p>Belum ada proposal. Klik "Buat Proposal" untuk memulai.</p></div>';
      return;
    }
    var list = filteredProposals();
    if (countEl) countEl.textContent = ppSearch.trim() ? list.length + ' dari ' + proposals.length + ' proposal' : proposals.length + ' proposal';
    if (!list.length) {
      el.innerHTML = '<div class="empty-docs"><div class="ei">🔍</div><p>Tidak ada proposal yang cocok dengan pencarian.</p></div>';
      return;
    }
    var totalPages = Math.ceil(list.length / PP_PAGE_SIZE);
    if (ppPage > totalPages) ppPage = totalPages;
    if (ppPage < 1) ppPage = 1;
    var start = (ppPage - 1) * PP_PAGE_SIZE;
    var pageItems = list.slice(start, start + PP_PAGE_SIZE);
    var rows = pageItems.map(function (p, i) {
      return '<tr>' +
        '<td class="td-no">' + (start + i + 1) + '</td>' +
        '<td>' +
          '<div class="dt-title">📝 ' + esc(p.judul || '(Tanpa judul)') + '</div>' +
          (p.tahun_ajaran ? '<div class="dt-file">T.A. ' + esc(p.tahun_ajaran) + '</div>' : '') +
        '</td>' +
        '<td>' + esc(p.nama_pic || '—') + '</td>' +
        '<td class="dt-date">' + shortDate(p.updated_at || p.created_at) + '</td>' +
        '<td class="dt-act">' +
          '<button class="icon-btn" data-act="open" data-id="' + p.id + '">✏️ Buka</button>' +
          '<button class="icon-btn danger" data-act="del" data-id="' + p.id + '">🗑️ Hapus</button>' +
        '</td>' +
      '</tr>';
    }).join('');
    el.innerHTML = '<div class="td-table-wrap"><table class="td-table">' +
      '<thead><tr><th style="width:44px">No</th><th>Kegiatan</th><th style="width:150px">PIC</th><th style="width:110px">Diperbarui</th><th class="dt-th" style="white-space:nowrap;text-align:right">Aksi</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';
    el.querySelectorAll('button[data-act]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = +b.dataset.id;
        if (b.dataset.act === 'open') openEditProposal(id);
        else if (b.dataset.act === 'del') deleteProposal(id);
      });
    });
    if (pager) {
      pager.innerHTML = buildPPPager(totalPages);
      pager.querySelectorAll('button[data-pg]').forEach(function (b) {
        b.addEventListener('click', function () { ppPage = +b.dataset.pg; renderProposalList(); });
      });
    }
  }

  // ── Wire tombol navigasi & pencarian ──────────────────────────────────
  function wireNav() {
    $('ppNewBtn').addEventListener('click', openNew);
    $('ppBackBtn').addEventListener('click', showList);
    var back2 = $('ppBackBtn2'); if (back2) back2.addEventListener('click', showList);
    $('ppSaveBtn').addEventListener('click', saveProposal);
    var save2 = $('ppSaveBtn2'); if (save2) save2.addEventListener('click', saveProposal);
    var srch = $('pp-search');
    if (srch) srch.addEventListener('input', function () { ppSearch = srch.value; ppPage = 1; renderProposalList(); });
  }

  // ── Init ──────────────────────────────────────────────────────────────
  attachTextListeners();
  wireAddButtons();
  wireImageUpload('anggaranGambar', 'uploadDrop', 'anggaranFileInput', 'anggaranImgGrid');
  wireImageUpload('acaraGambar', 'acaraUploadDrop', 'acaraFileInput', 'acaraImgGrid');
  wirePreviewButtons();
  wireNav();
  showList(); // tampilan awal = daftar proposal
})();
