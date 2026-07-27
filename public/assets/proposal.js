/* ============================================================================
   proposal.js — Generator Proposal Kegiatan (tab di Teacher Manager)
   Form → pratinjau dokumen (bisa diedit) → unduh PDF (via print browser).
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
    'Bagian Acara', 'Bagian Acara', 'Bagian Acara',
    'Bagian Perlengkapan', 'Bagian Perlengkapan', 'Bagian Perlengkapan',
    'Bagian Konsumsi', 'Bagian Konsumsi', 'Bagian Konsumsi',
    'Bagian Humas & Publikasi', 'Bagian Humas & Publikasi', 'Bagian Humas & Publikasi',
    'Bagian Dokumentasi', 'Bagian Dokumentasi', 'Bagian Dokumentasi',
    'Bagian Keamanan', 'Bagian Keamanan', 'Bagian Keamanan'
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
  ].map(function (t) { return { label: t, checked: true }; });

  // ── State ─────────────────────────────────────────────────────────────
  var state = {
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
  state.dasarPemikiran = [
    'Program Kerja Tahun Ajaran ' + state.tahunAjaran,
    'Kalender Pendidikan Sekolah ' + state.tahunAjaran,
    'Hasil rapat panitia tanggal [Tanggal Rapat]'
  ];

  // ── Helpers ───────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function uid() { return 'img_' + Math.random().toString(36).slice(2, 10); }
  function $(id) { return document.getElementById(id); }
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

  // ── Bind field teks sederhana ─────────────────────────────────────────
  var TEXT_FIELDS = [
    'namaKegiatan', 'temaKegiatan', 'tahunAjaran', 'namaPIC', 'kotaPengajuan', 'tanggalPengajuan',
    'hariTanggal', 'jamMulai', 'jamSelesai', 'tempatPelaksanaan', 'bentukKegiatan', 'sasaranPeserta',
    'latarBelakang', 'deskripsiSingkat',
    'totalAnggaran', 'ketuaNama', 'wakilKepsekNama', 'kepsekNama'
  ];
  function bindTextFields() {
    TEXT_FIELDS.forEach(function (key) {
      var el = $('f_' + key); if (!el) return;
      el.value = state[key];
      el.addEventListener('input', function () { state[key] = el.value; });
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
        '<table class="doc-table"><tbody>' +
          '<tr><td class="doc-bold">Ketua Panitia</td><td class="doc-bold">Mengetahui,<br>Wakil Kepala Sekolah,</td></tr>' +
          '<tr class="sig-blank"><td>&nbsp;</td><td>&nbsp;</td></tr>' +
          '<tr class="sig-blank"><td>&nbsp;</td><td>&nbsp;</td></tr>' +
          '<tr><td class="doc-bold">' + esc(state.ketuaNama || '[Nama Ketua]') + '</td><td class="doc-bold">' + esc(state.wakilKepsekNama || '[Nama Wakil Kepala Sekolah]') + '</td></tr>' +
        '</tbody></table>' +
        docP('Menyetujui,') +
        '<table class="doc-table"><tbody>' +
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
        '<table class="doc-table"><tbody>' +
          '<tr><td class="doc-bold">Disusun oleh</td><td class="doc-bold">Diperiksa oleh</td></tr>' +
          '<tr><td class="doc-italic">PIC Kegiatan</td><td class="doc-italic">Wakil Kepala Sekolah</td></tr>' +
          '<tr><td>Nama: ' + esc(state.namaPIC || '[Nama Lengkap]') + '</td><td>Nama: Muhammad Al Imron</td></tr>' +
          '<tr><td>Tanggal:</td><td>Tanggal:</td></tr>' +
          '<tr><td>Tanda Tangan:</td><td>Tanda Tangan:</td></tr>' +
        '</tbody></table>' +
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

  // ── Init ──────────────────────────────────────────────────────────────
  bindTextFields();
  renderDasarPemikiran(); renderTujuan(); renderPanitia(); renderAcara(); renderLampiran();
  renderImageGrid('anggaranGambar', 'anggaranImgGrid');
  renderImageGrid('acaraGambar', 'acaraImgGrid');
  wireAddButtons();
  wireImageUpload('anggaranGambar', 'uploadDrop', 'anggaranFileInput', 'anggaranImgGrid');
  wireImageUpload('acaraGambar', 'acaraUploadDrop', 'acaraFileInput', 'acaraImgGrid');
  wirePreviewButtons();
})();
