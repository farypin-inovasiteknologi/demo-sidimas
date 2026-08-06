


/* --- KONFIGURASI DATABASE BACKEND (MULTI-TENANT VIA URL) --- */
// Tambahkan daftar sekolah di sini. Kunci (sebelah kiri) harus huruf KECIL semua.
// Cara aksesnya nanti: domain.github.io/sidimas/?id=demo atau ?id=sman1
const DAFTAR_BACKEND = {
    "smkn1kotaternate": "https://script.google.com/a/macros/admin.sma.belajar.id/s/AKfycbyneiV8N_dRWSRy-xtw9q_7nE2dHnXHGzCaGFgiCzNT4DA8NM9TfX3_3Ro2u-Dt9NFP/exec",
    "sman9kotajambi": "https://script.google.com/macros/s/AKfycbzUVafWd_gjf01KnoIZOrMq4ECgsKrt2XlP5qj2p_YJgUr7_mFyuheGxYqECQGgT6zW/exec",
    "sman6tanjungjabungbarat": "https://script.google.com/macros/s/AKfycbzRhyVACgeQrfunoYn44PW77IFakBiI2DR6-VBalwpgzYlhzDe94LXMR8pBpjqoPGlGsQ/exec",
    "demo": "https://script.google.com/macros/s/AKfycbwmjBKvzk4JNJyQvAcnJ8-htm7NlcpoY8XbRT2SC_fh6a0jNzamXRDafKIzM_a8atIk/exec"
};

let API_URL = "";

// Fungsi untuk membaca parameter '?id=' dari URL browser
function initTenantRouting() {
    const urlParams = new URLSearchParams(window.location.search);
    let tenantId = urlParams.get('id');

    if (tenantId) {
        tenantId = tenantId.toLowerCase();
        if (DAFTAR_BACKEND[tenantId]) {
            API_URL = DAFTAR_BACKEND[tenantId];
            // Simpan ke memori agar kalau di-refresh tanpa ?id= tetap tidak error
            localStorage.setItem('sidimas_api_url', API_URL);
        } else {
            showInvalidTenantError(); return false;
        }
    } else {
        // Jika URL tidak ada ?id=, cek apakah sebelumnya sudah pernah masuk
        API_URL = localStorage.getItem('sidimas_api_url');

        // Cek apakah URL yang tersimpan masih ada di dalam DAFTAR_BACKEND yang baru
        let isValid = Object.values(DAFTAR_BACKEND).includes(API_URL);

        // Jika belum ada URL API atau URL sudah usang (tidak ada di daftar), beri nilai default "demo"
        if (!API_URL || !isValid) {
            API_URL = DAFTAR_BACKEND["demo"] || "";
            if (API_URL) {
                localStorage.setItem('sidimas_api_url', API_URL);
            }
        }
    }
    return true;
}

// Tampilan jika link salah dengan parameter ID yang tidak terdaftar
function showInvalidTenantError() {
    $('#view-login').html('<div class="text-center text-white" style="width:100%;"><h3 class="fw-bold">Akses Ditolak</h3><p>Link aplikasi tidak valid atau ID Instansi tidak ditemukan.</p></div>');
}

/* --- FUNGSI JEMBATAN PENGHUBUNG (FETCH API) --- */
function downloadBase64File(dataUri) {
    try {
        const arr = dataUri.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
        let ext = mime.split('/')[1] || 'bin';
        if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') ext = 'docx';
        else if (mime === 'application/pdf') ext = 'pdf';
        const link = document.createElement('a');
        link.href = dataUri;
        link.download = "Dokumen_Surat." + ext;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) { console.error("Gagal download:", e); }
}

async function apiCall(actionName, payloadData = {}) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: actionName, payload: payloadData }),
            redirect: 'follow'
        });
        return await response.json();
    } catch (error) {
        console.error("Koneksi API Gagal:", error);
        throw error;
    }
}



/* ==========================================
     PWA, DYNAMIC MANIFEST & INSTALL PROMPT
     ========================================== */

// 1. FUNGSI PEMBUAT MANIFEST DINAMIS (Anti Tabrakan ID)
function loadDynamicManifest() {
    const urlParams = new URLSearchParams(window.location.search);
    // Ambil ID dari URL, atau dari memori jika URL kosong
    const currentId = urlParams.get('id') || localStorage.getItem('sidimas_tenant_id');

    if (currentId) {
        // Simpan ID agar tidak hilang
        localStorage.setItem('sidimas_tenant_id', currentId);

        // Bentuk JSON Manifest lengkap
        const manifestJSON = {
            "name": `SiDiMAS - ${currentId.toUpperCase()}`,
            "short_name": "SiDiMAS",
            "description": "Sistem Digital Manajemen Arsip Surat",
            "start_url": `./?id=${currentId}`, // Link khusus untuk ID ini
            "display": "standalone",
            "background_color": "#f0f2f5",
            "theme_color": "#0d6efd",
            "orientation": "portrait-primary",
            "icons": [
                {
                    "src": "./imgsidimas.png",
                    "sizes": "192x192",
                    "type": "image/png",
                    "purpose": "any maskable"
                },
                {
                    "src": "./imgsidimas.png",
                    "sizes": "512x512",
                    "type": "image/png",
                    "purpose": "any maskable"
                }
            ]
        };

        // Ubah JSON menjadi Blob (file virtual) dan sisipkan ke <head> browser
        const stringManifest = JSON.stringify(manifestJSON);
        const blob = new Blob([stringManifest], { type: 'application/json' });
        const manifestURL = URL.createObjectURL(blob);

        const link = document.createElement('link');
        link.rel = 'manifest';
        link.href = manifestURL;
        document.head.appendChild(link);
    }
}

// Panggil fungsi pembuat manifest sesegera mungkin
loadDynamicManifest();

// 2. REGISTRASI SERVICE WORKER & POP-UP INSTALL
let deferredPrompt;

// Daftarkan Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker terdaftar!', reg.scope))
            .catch(err => console.error('Service Worker gagal terdaftar:', err));
    });
}

// Tangkap event saat browser siap menginstal aplikasi
window.addEventListener('beforeinstallprompt', (e) => {
    // Cegah pop-up bawaan browser yang muncul tiba-tiba
    e.preventDefault();
    // Simpan event-nya untuk dipicu nanti
    deferredPrompt = e;

    // Cek apakah user sudah pernah menolak/menutup pop-up sebelumnya
    const hasSeenPrompt = localStorage.getItem('sidimas_pwa_prompt');

    // Jika belum pernah menolak, munculkan SweetAlert setelah 2 detik
    if (!hasSeenPrompt) {
        setTimeout(() => {
            showInstallPopup();
        }, 2000);
    }
});

// Fungsi menampilkan SweetAlert untuk Install
function showInstallPopup() {
    Swal.fire({
        title: 'Install Aplikasi?',
        text: 'Tambahkan SiDiMAS ke Layar Utama (Home Screen) HP Anda untuk akses cepat tanpa header browser.',
        icon: 'info',
        imageUrl: './imgsidimas.png', // Pastikan file gambar ini ada di folder yang sama
        imageWidth: 80,
        showCancelButton: true,
        confirmButtonColor: '#0d6efd',
        cancelButtonColor: '#6c757d',
        confirmButtonText: '<i class="fas fa-download"></i> Ya, Install',
        cancelButtonText: 'Nanti Saja'
    }).then((result) => {
        if (result.isConfirmed) {
            // Jika user klik Ya, jalankan prompt instalasi bawaan browser
            if (deferredPrompt) {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                        console.log('User menginstal aplikasi');
                        // Tandai sudah diinstal agar tidak ditanya lagi
                        localStorage.setItem('sidimas_pwa_prompt', 'installed');
                    }
                    deferredPrompt = null;
                });
            }
        } else {
            // Jika user klik 'Nanti Saja', simpan ke memori agar tidak ditanya lagi setiap buka
            localStorage.setItem('sidimas_pwa_prompt', 'dismissed');
        }
    });
}

/* --- GLOBAL VARIABLES --- */
let dbMasuk = [];
let dbKeluar = [];

// INIT DEXIE LOKAL UNTUK CACHE (MODE ONLINE)
const localDB = new Dexie("SiDiMAS_DB");
localDB.version(1).stores({
    suratMasuk: "id, tglTerima, pengirim, tglSurat, noSurat, perihal, ditujukan, uraian, keterangan, fileUrl, waktuInput, pembuat, sync_status, fileInfoRaw",
    suratKeluar: "id, tglSurat, klasifikasi, noSurat, perihal, tujuan, uraian, keterangan, fileUrl, waktuInput, pembuat, sync_status, fileInfoRaw",
    antrianSync: "++id, action, payload, status"
});
localDB.version(2).stores({
    kodeCustom: "id, kode, uraian"
});
localDB.version(3).stores({
    suratEksternal: "id, namaPengirim, emailPengirim, noHpPengirim, lembagaPengirim, noSurat, sifatSurat, halSurat, tujuanSurat, tglSurat, keterangan, fileInfoRaw, status, waktuInput, sync_status"
});

/* --- INIT DATA & DASHBOARD --- */
$(document).ready(function () {
    // JALANKAN CEK URL PERTAMA KALI
    if (!initTenantRouting()) return; // Stop loading jika link salah

    renderSettingsFromCache();
    checkSession();

    // Sembunyikan tombol sinkronisasi karena online version real-time
    $('#btnSyncMain').hide();
    $('.offline-only').hide();
    $('.online-only').show();

    const dateNow = new Date();
    const offset = dateNow.getTimezoneOffset() * 60000;
    const today = (new Date(dateNow - offset)).toISOString().slice(0, 10);

    // Event listener untuk Crop Logo
    $('#fLogo1').on('change', function () {
        $('#delLogo1').val('0'); // Batal hapus jika admin memilih file baru
        cropImageSquare(this.files[0], '#previewLogo1').then(() => { $('#btnHapusLogo1').removeClass('hide'); });
    });
    $('#fLogo2').on('change', function () {
        $('#delLogo2').val('0');
        cropImageSquare(this.files[0], '#previewLogo2').then(() => { $('#btnHapusLogo2').removeClass('hide'); });
    });

    $('#filterM_Start, #filterM_End, #filterK_Start, #filterK_End, #inpTglSurat, #inpTglSaja').val(today);
    $('#selKodeArsip').select2({ theme: "bootstrap-5", width: '100%', dropdownParent: $('#formGen').parent() });
    $('#inpNoUrut').on('change blur', function () { formatNomorUrut(this); updatePreview(); });
    $(window).scroll(function () { if ($(this).scrollTop() > 100) $('#btnScrollTop').fadeIn(); else $('#btnScrollTop').fadeOut(); });

    updateTanggalSaja();

    $('#fileMasuk, #fileKeluar').on('change', function () {
        const file = this.files[0];
        if (file) {
            if (!file.type.match(/image.*/)) {
                if (file.size > 500 * 1024) {
                    this.value = '';
                    Swal.fire({ icon: 'warning', title: 'File Terlalu Besar', text: 'Maksimal ukuran file dokumen adalah 500KB.', target: '#modalSurat' });
                }
            }
        }
    });

    loadInitData();
});

function renderAppAttributes(s) {
    if (!s) return;
    localStorage.setItem('sidimas_settings', JSON.stringify(s));
    if (s.app_color) document.documentElement.style.setProperty('--main-color', s.app_color);
    if (s.app_color2) document.documentElement.style.setProperty('--main-color2', s.app_color2);
    if (s.app_color3) document.documentElement.style.setProperty('--main-color3', s.app_color3);

    // Untuk Logo 1 (Instansi)
    if (s.logo_instansi && s.logo_instansi.length > 50) {
        $('#logLogo1, #logoKiri').attr('src', s.logo_instansi).show();
        // Tampilkan juga di menu Pengaturan
        $('#previewLogo1').attr('src', s.logo_instansi).removeClass('hide');
        $('#btnHapusLogo1').removeClass('hide');
        $('#delLogo1').val('0');
    } else {
        $('#logLogo1, #logoKiri').hide();
        // Sembunyikan dari menu Pengaturan jika tidak ada
        $('#previewLogo1').addClass('hide');
        $('#btnHapusLogo1').addClass('hide');
    }

    // Untuk Logo 2 (Sekolah)
    if (s.logo_sekolah && s.logo_sekolah.length > 50) {
        $('#logLogo2, #logoKanan').attr('src', s.logo_sekolah).show();
        // Tampilkan juga di menu Pengaturan
        $('#previewLogo2').attr('src', s.logo_sekolah).removeClass('hide');
        $('#btnHapusLogo2').removeClass('hide');
        $('#delLogo2').val('0');
    } else {
        $('#logLogo2, #logoKanan').hide();
        // Sembunyikan dari menu Pengaturan jika tidak ada
        $('#previewLogo2').addClass('hide');
        $('#btnHapusLogo2').addClass('hide');
    }
    // Menampilkan Instansi
    $('#logInstansi').text(s.nama_instansi || '');

    // Menampilkan OPD secara dinamis (menggunakan removeClass alih-alih .show)
    if (s.nama_opd && s.nama_opd.trim() !== '') {
        $('#logOpd').text(s.nama_opd).removeClass('hide');
    } else {
        $('#logOpd').addClass('hide');
    }

    // Menampilkan Nama Sekolah
    $('#logSekolah').text(s.nama_sekolah || 'LOADING...');

    // Menampilkan Nama Sekolah
    $('#logSekolah').text(s.nama_sekolah || 'LOADING...');
    $('#txtInstansi').text(s.nama_instansi); $('#txtOpd').text(s.nama_opd); $('#txtSekolah').text(s.nama_sekolah);
    $('#txtAlamat').text(s.alamat_sekolah); $('#txtEmail').text(s.email_sekolah); $('#txtWeb').text(s.website_sekolah);

    $('#inInstansi').val(s.nama_instansi); $('#inOpd').val(s.nama_opd); $('#inSekolah').val(s.nama_sekolah);
    $('#inAlamat').val(s.alamat_sekolah); $('#inEmail').val(s.email_sekolah); $('#inWeb').val(s.website_sekolah);
    $('#inTelp').val(s.telp_sekolah); $('#inWaAdmin').val(s.wa_admin);
    $('#inWarna').val(s.app_color || '#0d6efd'); $('#inWarna2').val(s.app_color2 || '#004085'); $('#inWarna3').val(s.app_color3 || '#001b3a');
    $('#inKepsekNama').val(s.kepsek_nama); $('#inKepsekNip').val(s.kepsek_nip);
    $('#inKepsekPangkat').val(s.kepsek_pangkat); $('#inKotaSurat').val(s.kota_surat); $('#inKodeLembaga').val(s.kode_lembaga);

    // -- BAGIAN BARU: Tempel Link ke Form Pengaturan & Tombol Login --
    $('#inLinkWin').val(s.link_windows || "");
    $('#inLinkAnd').val(s.link_android || "");

    if (s.link_windows && s.link_windows.trim() !== "") { $('#btnUnduhWin').attr('href', s.link_windows).show(); } else { $('#btnUnduhWin').hide(); }
    if (s.link_android && s.link_android.trim() !== "") { $('#btnUnduhAnd').attr('href', s.link_android).show(); } else { $('#btnUnduhAnd').hide(); }
    // ------------------------------------------------------------------

    if (!$('input[name="ttdNama"]').val()) $('input[name="ttdNama"]').val(s.kepsek_nama);

    if (!$('input[name="ttdNip"]').val()) $('input[name="ttdNip"]').val(s.kepsek_nip);
    if (!$('input[name="ttdPangkat"]').val()) $('input[name="ttdPangkat"]').val(s.kepsek_pangkat);
    $('#inpKodeSekolah').val(s.kode_lembaga);
}

function renderSettingsFromCache() {
    const cached = localStorage.getItem('sidimas_settings');
    if (cached) { try { renderAppAttributes(JSON.parse(cached)); } catch (e) { } }
}

function loadInitData() {
    apiCall('getSettings').then(s => renderAppAttributes(s));

    if ($('#selKodeArsip').children('option').length <= 1) {
        loadKodeKlasifikasi();
    }
    if ($('#pilihJenisSurat').children('option').length <= 1) {
        const staticTemplates = [
            { id: '1. Surat Dinas Umum.docx', name: '1. Surat Dinas Umum' },
            { id: '2. Surat Keputusan (SK).docx', name: '2. Surat Keputusan (SK)' },
            { id: '3. Surat Perjalanan Dinas (SPD).docx', name: '3. Surat Perjalanan Dinas (SPD)' },
            { id: '4. Surat Keterangan.docx', name: '4. Surat Keterangan' },
            { id: '5. Nota Dinas.docx', name: '5. Nota Dinas' },
            { id: '6. Surat Tugas (ST).docx', name: '6. Surat Tugas (ST)' },
            { id: '7. Surat Keterangan Siswa.docx', name: '7. Surat Keterangan Siswa' },
            { id: '8. Surat Pengantar.docx', name: '8. Surat Pengantar' },
            { id: '9. Surat Undangan.docx', name: '9. Surat Undangan' },
            { id: '10. Surat Izin.docx', name: '10. Surat Izin' },
            { id: '11. Surat Pernyataan Melaksanakan Tugas (SPMT).docx', name: '11. Surat SPMT' },
            { id: '12. Lampiran Surat.docx', name: '12. Lampiran Surat' }
        ];
        let o = '<option value="">-- Pilih Template --</option>';
        staticTemplates.forEach(t => o += `<option value="${t.id}">${t.name}</option>`);
        $('#pilihJenisSurat').html(o);
    }
    apiCall('getRefLembaga').then(l => { let opts = ''; l.forEach(x => opts += `<option value="${x.k}">${x.n}</option>`); $('#listLembaga').html(opts); });
}

function setBtnLoading(btnId, isLoading, defaultText) {
    const btn = $(btnId);
    if (isLoading) {
        btn.prop('disabled', true);
        if (btn.find('.spinner-border').length > 0) { btn.find('.spinner-border').removeClass('hide'); if (defaultText) btn.find('span:not(.spinner-border)').text(defaultText); } else { btn.html('<span class="spinner-border spinner-border-sm"></span> Loading...'); }
    } else {
        btn.prop('disabled', false);
        if (btn.find('.spinner-border').length > 0) { btn.find('.spinner-border').addClass('hide'); btn.find('span:not(.spinner-border)').text(defaultText); } else { btn.text(defaultText); }
    }
}

/* --- FUNGSI LOADING DENGAN TIMER MUNDUR --- */
function showLoadingTimer(judul) {
    let timerInterval;
    Swal.fire({
        title: judul,
        html: 'Waktu tunggu: <b>5</b> detik...',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
            const b = Swal.getHtmlContainer().querySelector('b');
            let timeLeft = 5;
            timerInterval = setInterval(() => {
                timeLeft--;
                if (timeLeft > 0) {
                    if (b) b.textContent = timeLeft;
                } else {
                    Swal.getHtmlContainer().innerHTML = 'Sedang proses, mohon tunggu sebentar...';
                    clearInterval(timerInterval);
                }
            }, 1000);
        },
        willClose: () => {
            clearInterval(timerInterval);
        }
    });
}

function showLoadingTimer2(judul) {
    let timerInterval;
    Swal.fire({
        title: judul,
        html: 'Waktu tunggu: <b>10</b> detik...',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
            const b = Swal.getHtmlContainer().querySelector('b');
            let timeLeft = 10;
            timerInterval = setInterval(() => {
                timeLeft--;
                if (timeLeft > 0) {
                    if (b) b.textContent = timeLeft;
                } else {
                    Swal.getHtmlContainer().innerHTML = 'Sedang proses, mohon tunggu sebentar...';
                    clearInterval(timerInterval);
                }
            }, 1000);
        },
        willClose: () => {
            clearInterval(timerInterval);
        }
    });
}

function formatNomorUrut(input) { let val = input.value; if (val === "") return; input.value = String(val).padStart(3, '0'); }

/* --- AUTHENTICATION & SESSION --- */
function checkSession() {
    const user = localStorage.getItem('sidimas_user');
    const role = localStorage.getItem('sidimas_role');
    const nama = localStorage.getItem('sidimas_nama');
    if (user && role) {
        $('.modal-backdrop').remove(); $('body').removeClass('modal-open');
        $('#view-login').addClass('hide').css('display', 'none');
        $('#view-dashboard').removeClass('hide');
        $('#lblRole').text(role); $('#lblNama').text(nama);
        if (role !== 'Admin') $('.admin-only').hide(); else $('.admin-only').show();
        if ($('#view-dashboard').is(':visible') && $('.nav-link.active').length === 0) { nav('home'); }
    } else {
        $('#view-dashboard').addClass('hide');
        $('#view-login').removeClass('hide').css('display', 'flex');
    }
}

function prosesLogin(e) {
    e.preventDefault();
    setBtnLoading('#btnLogin', true, 'Memverifikasi...');

    apiCall('checkLogin', { u: $('#u').val(), p: $('#p').val() })
        .then(r => {
            setBtnLoading('#btnLogin', false, 'Masuk Aplikasi');
            if (r.status) {
                localStorage.setItem('sidimas_user', $('#u').val());
                localStorage.setItem('sidimas_role', r.role);
                localStorage.setItem('sidimas_nama', r.nama);

                $('#view-login').fadeOut(300, function () { $(this).addClass('hide').css('display', 'none'); $('#view-dashboard').removeClass('hide').hide().fadeIn(300); checkSession(); });
            } else { Swal.fire('Login Gagal', r.message, 'error'); }
        })
        .catch(() => { setBtnLoading('#btnLogin', false, 'Masuk Aplikasi'); Swal.fire('Error', 'Gagal memanggil Server', 'error'); });
}

function doLogout() {
    Swal.fire({ title: 'Logout?', text: 'Keluar dari aplikasi?', icon: 'question', showCancelButton: true, confirmButtonText: 'Ya, Keluar' }).then(r => {
        if (r.isConfirmed) {
            // HANYA hapus data user, JANGAN hapus sidimas_api_url agar halaman login sekolah tidak error
            localStorage.removeItem('sidimas_user');
            localStorage.removeItem('sidimas_role');
            localStorage.removeItem('sidimas_nama');

            $('#view-dashboard').addClass('hide');
            $('#view-login').removeClass('hide').css('display', 'flex').hide().fadeIn(300);
            $('#u').val(''); $('#p').val(''); dbMasuk = []; dbKeluar = [];
        }
    });
}

function togglePass() { const x = document.getElementById("p"); x.type = (x.type === "password") ? "text" : "password"; }

// VARIABEL GLOBAL CROPPER
let cropperInstance = null;
let currentLogoTarget = 1; // Untuk membedakan logo instansi (1) atau sekolah (2)

// MUNCULKAN MODAL CROPPER SAAT FILE DIPILIH
$('#fLogo1').on('change', function (e) {
    if (e.target.files && e.target.files.length > 0) {
        currentLogoTarget = 1;
        $('#delLogo1').val('0');
        siapkanCropper(e.target.files[0]);
    }
});
$('#fLogo2').on('change', function (e) {
    if (e.target.files && e.target.files.length > 0) {
        currentLogoTarget = 2;
        $('#delLogo2').val('0');
        siapkanCropper(e.target.files[0]);
    }
});

// FUNGSI UNTUK MEMBACA GAMBAR DAN MEMBUKA MODAL
function siapkanCropper(file) {
    const reader = new FileReader();
    reader.onload = function (event) {
        $('#imageToCrop').attr('src', event.target.result);
        new bootstrap.Modal(document.getElementById('modalCrop')).show();
    };
    reader.readAsDataURL(file);
}

// INISIALISASI CROPPER SAAT MODAL TERBUKA
document.getElementById('modalCrop').addEventListener('shown.bs.modal', function () {
    const image = document.getElementById('imageToCrop');
    if (cropperInstance) cropperInstance.destroy(); // Bersihkan cropper lama jika ada

    cropperInstance = new Cropper(image, {
        aspectRatio: 1 / 1, // Kunci rasio crop 1:1 (Kotak sempurna)
        viewMode: 1,        // Jangan biarkan kotak crop keluar dari batas gambar
        background: false,  // Penting agar PNG dengan background transparan mudah dilihat
    });
});

// HANCURKAN CROPPER SAAT MODAL DITUTUP
document.getElementById('modalCrop').addEventListener('hidden.bs.modal', function () {
    if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
    $('#imageToCrop').attr('src', '');
    // Reset input file jika user batal nge-crop
    if ($('#b64Logo' + currentLogoTarget).val() === "") {
        $('#fLogo' + currentLogoTarget).val('');
    }
});

// AKSI TOMBOL POTONG & SIMPAN DI DALAM MODAL
$('#btnCropSave').on('click', function () {
    if (!cropperInstance) return;

    // KOMPRESI: Kita perkecil resolusi kanvas menjadi 100x100 piksel.
    // Ini akan menurunkan jumlah karakter Base64 secara drastis (aman untuk masuk ke database)
    const canvas = cropperInstance.getCroppedCanvas({
        width: 200,
        height: 200,
        fillColor: 'transparent' // Mempertahankan background transparan PNG
    });

    // Ekspor ke format PNG
    const base64Data = canvas.toDataURL('image/png');

    // Validasi ditiadakan atas permintaan user (bebas warna)

    // Lempar data ke form pengaturan
    if (currentLogoTarget === 1) {
        $('#previewLogo1').attr('src', base64Data).removeClass('hide').show();
        $('#btnHapusLogo1').removeClass('hide');
        $('#b64Logo1').val(base64Data); // Simpan Base64 ke hidden input
    } else {
        $('#previewLogo2').attr('src', base64Data).removeClass('hide').show();
        $('#btnHapusLogo2').removeClass('hide');
        $('#b64Logo2').val(base64Data); // Simpan Base64 ke hidden input
    }

    // Tutup modal
    bootstrap.Modal.getInstance(document.getElementById('modalCrop')).hide();
});

// SESUAIKAN FUNGSI HAPUS PREVIEW
function hapusPreview(no) {
    $('#fLogo' + no).val('');
    $('#b64Logo' + no).val(''); // Kosongkan data crop
    $('#previewLogo' + no).addClass('hide').attr('src', '');
    $('#btnHapusLogo' + no).addClass('hide');
    $('#delLogo' + no).val('1');
}

// UBAH FUNGSI simpanSetting AGAR MENGGUNAKAN DATA CROP MANUAL
function simpanSetting(e) {
    e.preventDefault();
    showLoadingTimer('Menyimpan Pengaturan...');

    const fd = new FormData(e.target);
    const d = Object.fromEntries(fd);

    // Ambil base64 hasil crop manual
    const b64_1 = $('#b64Logo1').val();
    const b64_2 = $('#b64Logo2').val();

    // Jika ada hasil crop, kirim. Jika tidak, cek apakah admin minta hapus logo
    if (b64_1) { d.b64_instansi = b64_1; } else if ($('#delLogo1').val() === '1') { d.b64_instansi = "DEL"; }
    if (b64_2) { d.b64_sekolah = b64_2; } else if ($('#delLogo2').val() === '1') { d.b64_sekolah = "DEL"; }

    apiCall('saveSettings', d).then(r => {
        Swal.close();
        if (r && r.success === false) { Swal.fire('Error', r.message, 'error'); }
        else {
            Swal.fire('Sukses', 'Pengaturan diterapkan', 'success');
            // Kosongkan inputan crop untuk sesi berikutnya
            $('#b64Logo1').val(''); $('#b64Logo2').val('');
            loadInitData();
        }
    });
}

function compressImageForUpload(file) {
    return new Promise(res => {
        if (!file) res(null);
        const r = new FileReader();
        r.onload = e => {
            const i = new Image();
            i.onload = () => {
                const canvas = document.createElement('canvas');
                let width = i.width; let height = i.height; const maxDim = 1000;
                if (width > height) { if (width > maxDim) { height *= maxDim / width; width = maxDim; } } else { if (height > maxDim) { width *= maxDim / height; height = maxDim; } }
                canvas.width = width; canvas.height = height; canvas.getContext('2d').drawImage(i, 0, 0, width, height);
                res(canvas.toDataURL('image/jpeg', 0.7));
            }; i.src = e.target.result;
        }; r.readAsDataURL(file);
    });
}

function processFile(id) {
    return new Promise(resolve => {
        const input = document.getElementById(id); const file = input.files[0]; if (!file) { resolve(null); return; }
        if (!file.type.match(/image.*/)) {
            if (file.size > 500 * 1024) {
                Swal.fire({ icon: 'warning', title: 'File Terlalu Besar', text: 'Maksimal 500KB', target: '#modalSurat' });
                resolve(null); return;
            }
            const r = new FileReader(); r.onload = e => resolve({ name: file.name, mimeType: file.type, data: e.target.result.split(',')[1] }); r.readAsDataURL(file);
        } else {
            compressImageForUpload(file).then(base64 => { resolve({ name: file.name.replace(/\.[^/.]+$/, "") + ".jpg", mimeType: "image/jpeg", data: base64.split(',')[1] }); });
        }
    });
}



function doBackup() {
    Swal.fire({ title: 'Backup Database?', text: "Data akan disalin ke Spreadsheet baru di folder Arsip.", icon: 'info', showCancelButton: true, confirmButtonText: 'Ya, Backup', cancelButtonText: 'Batal' }).then((result) => {
        if (result.isConfirmed) {
            setBtnLoading('#btnBackup', true, 'Memproses...');
            apiCall('backupDatabase').then(r => {
                setBtnLoading('#btnBackup', false, 'Backup Sekarang');
                if (r.success) { Swal.fire({ title: 'Backup Berhasil!', html: `File tersimpan di folder Arsip.<br><a href="${r.url}" target="_blank" class="btn btn-sm btn-primary mt-2">Buka File Backup</a>`, icon: 'success' }); } else { Swal.fire('Gagal Backup', r.message, 'error'); }
            }).catch(e => { setBtnLoading('#btnBackup', false, 'Backup Sekarang'); Swal.fire('Error Server', e.toString(), 'error'); });
        }
    });
}

/* --- GENERATOR SURAT --- */
function gantiFormSurat() {
    const t = $('#pilihJenisSurat option:selected').text().toLowerCase() || "";
    $('.form-box').addClass('hide').find('input,textarea,select').prop('disabled', true);
    let aid = '#box-umum';
    if (t.includes('melaksanakan tugas') || t.includes('spmt') || t.includes('skmt')) { aid = '#box-spmt'; } else if (t.includes('keterangan siswa') || t.includes('siswa')) { aid = '#box-sis'; } else if (t.includes('tugas') || t.includes('spt')) { aid = '#box-spt'; } else if (t.includes('sk') || t.includes('keputusan')) { aid = '#box-sk'; } else if (t.includes('perjalanan')) { aid = '#box-sppd'; } else if (t.includes('surat izin') || t.includes('izin')) { aid = '#box-izin'; } else if (t.includes('keterangan')) { aid = '#box-suket'; } else if (t.includes('nota')) { aid = '#box-nota'; } else if (t.includes('pengantar')) { aid = '#box-pengantar'; } else if (t.includes('undangan')) { aid = '#box-undangan'; } else if (t.includes('lampiran')) { aid = '#box-lampiran'; }
    $(aid).removeClass('hide').find('input,textarea,select').prop('disabled', false);

    // Logika memunculkan Tembusan untuk jenis surat tertentu
    const showTembusan = ['umum', 'dinas', 'undangan', 'keputusan', 'sk', 'tugas', 'spmt', 'skmt', 'nota', 'izin'].some(k => t.includes(k));
    if (showTembusan) {
        $('#box-tembusan').removeClass('hide').find('textarea').prop('disabled', false);
    } else {
        $('#box-tembusan').addClass('hide').find('textarea').prop('disabled', true);
    }

    // Auto-fill Kode Klasifikasi
    let keywords = '';
    if (t.includes('undangan')) keywords = 'undangan';
    else if (t.includes('keputusan') || t.includes('sk')) keywords = 'keputusan';
    else if (t.includes('perjalanan') || t.includes('sppd')) keywords = 'perjalanan';
    else if (t.includes('tugas') || t.includes('spt')) keywords = 'tugas';
    else if (t.includes('keterangan') || t.includes('suket')) keywords = 'keterangan';
    else if (t.includes('izin')) keywords = 'izin';
    else if (t.includes('nota')) keywords = 'nota';
    else if (t.includes('pengantar')) keywords = 'pengantar';

    if (keywords) {
        let found = false;
        $('#selKodeArsip option').each(function () {
            if ($(this).text().toLowerCase().includes(keywords)) {
                $('#selKodeArsip').val($(this).val()).trigger('change');
                found = true;
                return false;
            }
        });
        if (!found) $('#selKodeArsip').val('').trigger('change');
    } else {
        $('#selKodeArsip').val('').trigger('change');
    }

    toggleModeSpt();
    toggleModeSuket();
    toggleModeSis();

    loadAutoNumber();
}


function loadAutoNumber() { apiCall('getAutoNumberData').then(r => { if (r.success) { if ($('#inpNoUrut').val() === "") { $('#inpNoUrut').val(r.nextNo); } $('#inpKodeSekolah').val(r.kodeSekolah); updatePreview(); } }); }
function updatePreview() {
    const d = new Date();
    const romawi = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][d.getMonth()];
    const format = $('input[name="formatNomor"]:checked').val();
    const kode = $('#selKodeArsip').val() || '...';
    const noUrut = $('#inpNoUrut').val() || '...';
    const kodeLembaga = $('#inpKodeSekolah').val() || '...';
    const tahun = d.getFullYear();
    let f = '';
    if (format === 'format2') {
        f = `${noUrut}/${kode}/${kodeLembaga}/${romawi}/${tahun}`;
    } else {
        f = `${kode}/${noUrut}/${kodeLembaga}/${romawi}/${tahun}`;
    }
    $('#previewNomor').text(f);
    $('#nomorFull').val(f);
}
function updateTanggalSurat() { if ($('#inpTglSurat').val()) { const tgl = new Date($('#inpTglSurat').val()).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); const kota = $('#inpTempatTitimangsa').val() || "Tempat"; $('#tanggalSuratFull').val(kota + ", " + tgl); } }
function updateTanggalSaja() { const v = $('#inpTglSaja').val(); if (v) { const d = new Date(v); $('#valHariSaja').val(d.toLocaleDateString('id-ID', { weekday: 'long' })); $('#valTglSaja').val(d.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })); } }
function updateHariAcara() {
    const v = $('#inpTglAcara').val();
    const v2 = $('#inpTglAcaraSelesai').val();
    if (v) {
        $('#valHariAcara').val(formatHariRentangIndo(v, v2));
        $('#valTglAcaraIndo').val(formatRentangTglIndo(v, v2));
    }
}


function formatTglIndo(rawDate) {
    if (!rawDate) return '';
    // Tambahkan 'T00:00:00' agar tidak terjadi offset timezone
    const d = new Date(rawDate + 'T00:00:00');
    if (isNaN(d)) return rawDate; // Kembalikan apa adanya jika tidak valid
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

/**
 * Mengonversi string tanggal yyyy-mm-dd menjadi nama hari dalam Bahasa Indonesia.
 * Contoh: '2026-07-02' → 'Kamis'
 */
function formatHariIndo(rawDate) {
    if (!rawDate) return '';
    const d = new Date(rawDate + 'T00:00:00');
    if (isNaN(d)) return '';
    return d.toLocaleDateString('id-ID', { weekday: 'long' });
}

/**
 * Menghasilkan format rentang tanggal Indonesia yang cerdas.
 * - 1 hari  : '6 Juli 2026'
 * - Bln sama: '6-9 Juli 2026'
 * - Bln beda: '6 Juli - 9 Agustus 2026'
 */
function formatRentangTglIndo(tglMulai, tglSelesai) {
    if (!tglMulai) return '';
    const dMulai = new Date(tglMulai + 'T00:00:00');
    if (isNaN(dMulai)) return tglMulai;

    const optsHari = { day: 'numeric' };
    const optsBln = { month: 'long' };
    const optsThn = { year: 'numeric' };
    const optsLengkap = { day: 'numeric', month: 'long', year: 'numeric' };

    // Jika tidak ada tanggal selesai atau sama dengan tanggal mulai
    if (!tglSelesai || tglSelesai === tglMulai) {
        return dMulai.toLocaleDateString('id-ID', optsLengkap);
    }

    const dSelesai = new Date(tglSelesai + 'T00:00:00');
    if (isNaN(dSelesai)) return dMulai.toLocaleDateString('id-ID', optsLengkap);

    const bulanMulai = dMulai.getMonth();
    const bulanSelesai = dSelesai.getMonth();
    const tahunMulai = dMulai.getFullYear();
    const tahunSelesai = dSelesai.getFullYear();

    if (tahunMulai === tahunSelesai && bulanMulai === bulanSelesai) {
        // Bulan & tahun sama: '6 s.d. 9 Juli 2026'
        const tgl1 = dMulai.toLocaleDateString('id-ID', optsHari);
        const tgl2 = dSelesai.toLocaleDateString('id-ID', optsHari);
        const bln = dMulai.toLocaleDateString('id-ID', optsBln);
        const thn = dMulai.toLocaleDateString('id-ID', optsThn);
        return `${tgl1} s.d. ${tgl2} ${bln} ${thn}`;
    } else {
        // Beda bulan atau tahun: '6 Juli s.d. 9 Agustus 2026'
        return `${dMulai.toLocaleDateString('id-ID', optsLengkap)} s.d. ${dSelesai.toLocaleDateString('id-ID', optsLengkap)}`;
    }
}

/**
 * Menghasilkan format rentang hari Indonesia.
 * - 1 hari  : 'Selasa'
 * - Beda hari: 'Selasa s.d. Kamis'
 */
function formatHariRentangIndo(tglMulai, tglSelesai) {
    if (!tglMulai) return '';
    const dMulai = new Date(tglMulai + 'T00:00:00');
    if (isNaN(dMulai)) return '';
    const h1 = dMulai.toLocaleDateString('id-ID', { weekday: 'long' });

    if (!tglSelesai || tglSelesai === tglMulai) {
        return h1;
    }

    const dSelesai = new Date(tglSelesai + 'T00:00:00');
    if (isNaN(dSelesai)) return h1;
    const h2 = dSelesai.toLocaleDateString('id-ID', { weekday: 'long' });

    return `${h1} s.d. ${h2}`;
}

/* ── INJEKSI KOP SURAT OFFLINE (Tanpa library, murni DOCX XML) ── */
function injectKopSuratOffline(zip, s) {
    const EMU = 685800; // 75px * 9144 EMU/pixel

    // Konversi base64 ke Uint8Array untuk dimasukkan ke zip
    function b64ToBytes(b64) {
        const clean = b64.replace(/^data:image\/(png|jpg|jpeg|gif|webp);base64,/i, '');
        const bs = atob(clean);
        const bytes = new Uint8Array(bs.length);
        for (let i = 0; i < bs.length; i++) bytes[i] = bs.charCodeAt(i);
        return bytes;
    }

    // Buat XML elemen <w:drawing> untuk menempatkan gambar inline
    function makeDrawXml(rId, picId) {
        return `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="${EMU}" cy="${EMU}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${picId}" name="KopImg${picId}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${picId}" name="KopImg${picId}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${EMU}" cy="${EMU}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`;
    }

    // Baca rels sekali, tambahkan kedua relasi, lalu tulis kembali
    const relsFile = zip.file('word/_rels/document.xml.rels');
    if (!relsFile) return;
    let relsStr = relsFile.asText();

    let logo1Xml = '';
    let logo2Xml = '';

    if (s.logo_instansi && s.logo_instansi.length > 50) {
        try {
            zip.file('word/media/kop_logo1.png', b64ToBytes(s.logo_instansi));
            relsStr = relsStr.replace('</Relationships>',
                '<Relationship Id="rIdKopL1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/kop_logo1.png"/></Relationships>');
            logo1Xml = makeDrawXml('rIdKopL1', 901);
        } catch (e) { console.warn('Logo1 gagal:', e); }
    }

    if (s.logo_sekolah && s.logo_sekolah.length > 50) {
        try {
            zip.file('word/media/kop_logo2.png', b64ToBytes(s.logo_sekolah));
            relsStr = relsStr.replace('</Relationships>',
                '<Relationship Id="rIdKopL2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/kop_logo2.png"/></Relationships>');
            logo2Xml = makeDrawXml('rIdKopL2', 902);
        } catch (e) { console.warn('Logo2 gagal:', e); }
    }

    zip.file('word/_rels/document.xml.rels', relsStr);

    // Helper: paragraf tengah dengan teks
    function pTxt(text, bold, sz) {
        if (!text) return '';
        const b = bold ? '<w:b/>' : '';
        return `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0" w:before="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>${b}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</w:t></w:r></w:p>`;
    }

    // Susun konten teks kop
    let tengah = '';
    if (s.nama_instansi) tengah += pTxt((s.nama_instansi).toUpperCase(), false, 22);
    if (s.nama_opd) tengah += pTxt((s.nama_opd).toUpperCase(), true, 26);
    if (s.nama_sekolah) tengah += pTxt((s.nama_sekolah).toUpperCase(), true, 30);
    if (s.alamat_sekolah) tengah += pTxt(s.alamat_sekolah, false, 20);
    const kontak = [s.email_sekolah && ('Email: ' + s.email_sekolah), s.website_sekolah && ('Website: ' + s.website_sekolah)].filter(Boolean).join(' | ');
    if (kontak) tengah += pTxt(kontak, false, 18);

    // Paragraf logo (Drawing atau kosong)
    const cell1 = logo1Xml
        ? `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0" w:before="0"/></w:pPr><w:r>${logo1Xml}</w:r></w:p>`
        : `<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`;
    const cell3 = logo2Xml
        ? `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0" w:before="0"/></w:pPr><w:r>${logo2Xml}</w:r></w:p>`
        : `<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`;

    // Tabel kop surat: 3 kolom [Logo Instansi | Teks | Logo Sekolah]
    const kopXml =
        `<w:tbl>` +
        `<w:tblPr>` +
        `<w:tblW w:w="5000" w:type="pct"/>` +
        `<w:tblBorders><w:bottom w:val="single" w:sz="18" w:space="0" w:color="000000"/></w:tblBorders>` +
        `<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/></w:tblCellMar>` +
        `</w:tblPr>` +
        `<w:tr>` +
        `<w:tc><w:tcPr><w:tcW w:w="15" w:type="pct"/><w:vAlign w:val="center"/></w:tcPr>${cell1}</w:tc>` +
        `<w:tc><w:tcPr><w:tcW w:w="70" w:type="pct"/><w:vAlign w:val="center"/></w:tcPr>${tengah || '<w:p/>'}` + `</w:tc>` +
        `<w:tc><w:tcPr><w:tcW w:w="15" w:type="pct"/><w:vAlign w:val="center"/></w:tcPr>${cell3}</w:tc>` +
        `</w:tr></w:tbl>` +
        `<w:p><w:pPr><w:spacing w:after="60" w:before="0"/></w:pPr></w:p>`;

    // Suntikkan di awal <w:body>
    let xmlStr = zip.file('word/document.xml').asText();
    const bodyMatch = xmlStr.match(/<w:body[^>]*>/);
    if (bodyMatch) {
        const idx = xmlStr.indexOf(bodyMatch[0]) + bodyMatch[0].length;
        xmlStr = xmlStr.slice(0, idx) + kopXml + xmlStr.slice(idx);
        zip.file('word/document.xml', xmlStr);
    }
}

function submitGenerate(e) {
    e.preventDefault();
    if (!$('#inpTglSurat').val()) { Swal.fire('Info', 'Tgl Surat wajib diisi', 'warning'); return; }

    const templateName = $('#pilihJenisSurat').val();
    if (!templateName) { Swal.fire('Info', 'Pilih jenis surat/template terlebih dahulu', 'warning'); return; }

    setBtnLoading('#btnGen', true, 'Memproses...');
    updatePreview(); updateTanggalSurat(); updateTanggalSaja(); updateHariAcara();
    const fd = new FormData(e.target);
    const dataObj = {};
    for (let [key, value] of fd.entries()) {
        if (dataObj[key] !== undefined) {
            if (!Array.isArray(dataObj[key])) dataObj[key] = [dataObj[key]];
            dataObj[key].push(value);
        } else {
            dataObj[key] = value;
        }
    }

    // Baca tabel dinamis jika form box-lampiran sedang aktif
    if (!$('#box-lampiran').hasClass('hide')) {
        let tableData = [];
        let headers = [];
        $('#tblDynamicLampiran thead input').each(function () { headers.push($(this).val()); });
        tableData.push(headers);
        $('#tblDynamicLampiran tbody tr').each(function () {
            let row = [];
            $(this).find('input').each(function () { row.push($(this).val()); });
            tableData.push(row);
        });
        dataObj.dataTabelLampiran = JSON.stringify(tableData);
    }

    showLoadingTimer2('Membuat Dokumen Secara Offline...');

    // Fetch file .docx dari folder templates user (di AppData, bisa diedit sekolah)
    const loadTemplatePromise = fetch(`user-templates/${templateName}`).then(res => {
        if (!res.ok) throw new Error(`Template ${templateName} tidak ditemukan. Pastikan folder templates di AppData sudah ada.`);
        return res.arrayBuffer();
    });

    loadTemplatePromise
        .then(content => {
            const zip = new PizZip(content);

            // Ambil data Pengaturan lebih awal untuk injeksi kop
            const sStrKop = localStorage.getItem('sidimas_settings');
            let sKop = {};
            if (sStrKop) { try { sKop = JSON.parse(sStrKop); } catch (e) { } }

            // ── INJEKSI KOP SURAT OTOMATIS (Tanpa library tambahan) ──
            if (dataObj.tanpaKop !== 'ya') {
                try { injectKopSuratOffline(zip, sKop); } catch (e) { console.error("Gagal injeksi kop", e); }
            }

            const doc = new window.docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true,
                nullGetter: function (part) {
                    if (!part.module) { return ""; }
                    if (part.module === "rawxml") { return ""; }
                    return "";
                }
            });

            // Siapkan tag-tag replacement
            const tags = { ...dataObj };

            // 1. Ambil data Pengaturan (Kop Surat & Kepsek) dari localStorage
            const sStr = localStorage.getItem('sidimas_settings');
            let s = {};
            if (sStr) { try { s = JSON.parse(sStr); } catch (e) { } }

            tags['NAMA_INSTANSI'] = (s.nama_instansi || "").toUpperCase();
            tags['NAMA_OPD'] = (s.nama_opd || "").toUpperCase();
            tags['NAMA_SEKOLAH'] = (s.nama_sekolah || "").toUpperCase();
            tags['ALAMAT_SEKOLAH'] = s.alamat_sekolah || "";
            tags['EMAIL_SEKOLAH'] = s.email_sekolah || "";
            tags['WEBSITE_SEKOLAH'] = s.website_sekolah || "";
            tags['KOTA_SURAT'] = s.kota_surat || "";
            tags['KODE_LEMBAGA'] = s.kode_lembaga || "";


            // Data Kepala Surat
            tags['NOMOR_SURAT'] = dataObj.nomorFull || '';
            tags['SIFAT'] = dataObj.sifatSurat || '';
            tags['LAMPIRAN'] = dataObj.lampiranSurat || '';
            tags['PERIHAL'] = dataObj.perihal || '';
            tags['TANGGAL_SURAT'] = $('#tanggalSuratFull').val() || '';
            tags['TANGGAL_SAJA'] = $('#valTglSaja').val() || '';
            tags['TEMPAT_TITIMANGSA'] = s.kota_surat || 'Tempat';

            // Tujuan
            tags['TUJUAN_NAMA'] = dataObj.tujuanNama || '';
            tags['TUJUAN_BIDANG'] = dataObj.tujuanBidang || dataObj.tujuanJabatan || '';
            tags['TUJUAN_TEMPAT'] = dataObj.tujuanTempat || dataObj.tujuanAlamat || '';

            // Isi Surat
            tags['ISI_UMUM'] = dataObj.isiUmum || dataObj.isiSurat || '';
            tags['ISI_PENUTUP'] = dataObj.isiPenutup || '';
            tags['SK_MENIMBANG'] = dataObj.skMenimbang || '';
            tags['SK_MENGINGAT'] = dataObj.skMengingat || '';
            tags['SK_MENETAPKAN'] = dataObj.skMenetapkan || '';

            // Tanda Tangan
            const isAn = dataObj.useAtasNama === 'on';
            tags['TTD_NAMA'] = isAn ? (dataObj.anNama || '') : (dataObj.ttdNama || s.kepsek_nama || '');
            tags['TTD_NIP'] = isAn ? (dataObj.anNip || '') : (dataObj.ttdNip || s.kepsek_nip || '');
            tags['TTD_PANGKAT'] = isAn ? (dataObj.anPangkat || '') : (dataObj.ttdPangkat || s.kepsek_pangkat || '');
            tags['TTD_DINAMIS'] = '###TTD_DINAMIS###';
            tags['TTD_DINAMIS_TANGGAL'] = '###TTD_DINAMIS_TANGGAL###';
            tags['QR_TTE'] = '';

            tags['TEMBUSAN'] = dataObj.tembusanSurat || '';

            // ── TAG SURAT UNDANGAN / ACARA ──
            tags['HARI_ACARA'] = dataObj.hariAcara || '';
            tags['TANGGAL_ACARA'] = dataObj.tglAcaraIndo || '';
            tags['HARI_ACARA_RENTANG'] = formatHariRentangIndo(dataObj.undanganTglMulai, dataObj.undanganTglSelesai);
            tags['TANGGAL_ACARA_RENTANG'] = formatRentangTglIndo(dataObj.undanganTglMulai, dataObj.undanganTglSelesai);
            tags['WAKTU_ACARA'] = dataObj.waktuAcara || '';
            tags['TEMPAT_ACARA'] = dataObj.tempatAcara || '';
            tags['ACARA_DETAIL'] = dataObj.acaraDetail || '';
            tags['TUJUAN_JABATAN'] = dataObj.tujuanJabatan || dataObj.tujuanBidang || '';

            // ── TAG LAMPIRAN SURAT ──
            tags['JUDUL_TABEL'] = dataObj.judulTabel || '';

            // Konversi data tabel JSON → teks terformat (TAB-separated agar terbaca rapi)
            if (dataObj.dataTabelLampiran) {
                tags['TABLE_LAMPIRAN'] = '###TABEL_LAMPIRAN###';
            } else {
                tags['TABLE_LAMPIRAN'] = '';
            }

            // ── TAG PENGANTAR ──
            if (dataObj.pengantarIsi) {
                tags['TABLE_PENGANTAR'] = '###TABEL_PENGANTAR###';
            } else {
                tags['TABLE_PENGANTAR'] = '';
            }

            // ── TAG SPD (Surat Perjalanan Dinas) ──
            tags['SPPD_ANGKUTAN'] = dataObj.sppdAngkutan || '';
            tags['SPPD_TUJUAN'] = dataObj.sppdTujuan || '';
            tags['SPPD_TGL_MULAI'] = formatTglIndo(dataObj.sppdTglMulai);
            tags['SPPD_TGL_SELESAI'] = formatTglIndo(dataObj.sppdTglSelesai);
            tags['SPPD_TGL_RENTANG'] = formatRentangTglIndo(dataObj.sppdTglMulai, dataObj.sppdTglSelesai);
            tags['SPPD_HARI_RENTANG'] = formatHariRentangIndo(dataObj.sppdTglMulai, dataObj.sppdTglSelesai);
            tags['SPPD_HARI_MULAI'] = formatHariIndo(dataObj.sppdTglMulai);
            tags['SPPD_HARI_SELESAI'] = formatHariIndo(dataObj.sppdTglSelesai);
            tags['SPPD_LAMA'] = dataObj.sppdLama || '';

            // ── TAG SURAT KETERANGAN (Suket Umum & Suket Siswa) ──
            tags['SUKET_ISI'] = dataObj.suketIsi || '';
            tags['SISWA_NAMA'] = dataObj.siswaNama || '';
            tags['SISWA_NIS'] = dataObj.siswaNis || '';
            tags['SISWA_TTL'] = dataObj.siswaTtl || '';
            tags['SISWA_JK'] = dataObj.siswaJk || '';
            tags['SISWA_KELAS'] = dataObj.siswaKelas || '';
            tags['SISWA_ORTU'] = dataObj.siswaOrtu || '';
            tags['SISWA_KET'] = dataObj.siswaKet || '';

            // ── TAG SURAT TUGAS (SPT) ──
            tags['SPT_HARI'] = formatHariIndo(dataObj.sptMulai);
            tags['SPT_TANGGAL'] = formatTglIndo(dataObj.sptMulai);
            tags['SPT_TGL_RENTANG'] = formatRentangTglIndo(dataObj.sptMulai, dataObj.sptSelesai);
            tags['SPT_HARI_RENTANG'] = formatHariRentangIndo(dataObj.sptMulai, dataObj.sptSelesai);
            tags['SPT_HARI_SELESAI'] = formatHariIndo(dataObj.sptSelesai);
            tags['SPT_TANGGAL_SELESAI'] = formatTglIndo(dataObj.sptSelesai);
            tags['SPT_TEMPAT'] = dataObj.sptTempat || '';
            tags['SPT_WAKTU'] = dataObj.sptWaktu || '';

            // ── TAG SURAT IZIN ──
            tags['IZIN_ALASAN'] = dataObj.izinAlasan || '';
            tags['IZIN_TGL_MULAI'] = formatTglIndo(dataObj.sppdTglMulai);
            tags['IZIN_TGL_SELESAI'] = formatTglIndo(dataObj.sppdTglSelesai);
            tags['IZIN_TGL_RENTANG'] = formatRentangTglIndo(dataObj.sppdTglMulai, dataObj.sppdTglSelesai);
            tags['IZIN_HARI_RENTANG'] = formatHariRentangIndo(dataObj.sppdTglMulai, dataObj.sppdTglSelesai);
            tags['IZIN_HARI_MULAI'] = formatHariIndo(dataObj.sppdTglMulai);

            // ── TAG SURAT PERNYATAAN (SPMT) ──
            tags['SPMT_JABATAN_BARU'] = dataObj.spmtJabatanBaru || '';
            tags['SPMT_TGL_MULAI'] = formatTglIndo(dataObj.spmtTglMulai);
            tags['SPMT_TGL_SELESAI'] = formatTglIndo(dataObj.spmtTglSelesai);
            tags['SPMT_TGL_RENTANG'] = formatRentangTglIndo(dataObj.spmtTglMulai, dataObj.spmtTglSelesai);
            tags['SPMT_HARI_RENTANG'] = formatHariRentangIndo(dataObj.spmtTglMulai, dataObj.spmtTglSelesai);
            tags['SPMT_HARI_MULAI'] = formatHariIndo(dataObj.spmtTglMulai);

            // Tag-tag tambahan lain (pastikan tidak ada yang terlewat dari form)
            tags['TUJUAN_NIP'] = dataObj.tujuanNip || '';
            tags['TUJUAN_PANGKAT'] = dataObj.tujuanPangkat || '';
            tags['TUJUAN_BIDANG'] = dataObj.tujuanBidang || dataObj.tujuanJabatan || '';
            tags['TUJUAN_ALAMAT'] = dataObj.tujuanAlamat || '';
            tags['DASAR_HUKUM'] = dataObj.dasarHukum || '';
            tags['NAMA_SEKOLAH'] = tags['NAMA_SEKOLAH'] || (s.nama_sekolah || '').toUpperCase();

            // ── RENDER DOCXTEMPLATER (ini akan menyatukan tag yang terpecah) ──
            // --- LOGIKA MODE SURAT (Sendirian, Kolektif, Lampiran) ---
            tags['isSendirian'] = true;
            tags['isKolektif'] = false;
            tags['isLampiran'] = false;
            tags['tabelKolektif'] = '';

            let xmlKolektif = '';

            function buildXmlTabelKolektif(headers, rows, widths) {
                let xml = '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/><w:jc w:val="center"/><w:tblBorders>';
                xml += '<w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
                xml += '<w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
                xml += '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
                xml += '<w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
                xml += '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
                xml += '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
                xml += '</w:tblBorders></w:tblPr><w:tblGrid>';
                for (let i = 0; i < headers.length; i++) xml += '<w:gridCol/>';
                xml += '</w:tblGrid>';

                const parseCell = (val) => {
                    let parts = String(val).split('<br/>');
                    return parts.map(p => `<w:t>${p}</w:t>`).join('<w:br/>');
                };

                // Header
                xml += '<w:tr><w:trPr><w:trHeight w:val="400"/><w:jc w:val="center"/></w:trPr>';
                headers.forEach((h, i) => {
                    let w = widths && widths[i] ? widths[i] : 1000;
                    xml += `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="pct"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr>${parseCell(h)}</w:r></w:p></w:tc>`;
                });
                xml += '</w:tr>';

                // Rows
                rows.forEach((row, idx) => {
                    xml += '<w:tr><w:trPr><w:trHeight w:val="400"/></w:trPr>';
                    row.forEach((cell, cidx) => {
                        let jc = cidx === 0 ? 'center' : 'left';
                        let w = widths && widths[cidx] ? widths[cidx] : 1000;
                        xml += `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="pct"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="${jc}"/></w:pPr><w:r>${parseCell(cell)}</w:r></w:p></w:tc>`;
                    });
                    xml += '</w:tr>';
                });
                xml += '</w:tbl>';
                return xml;
            }

            // Helper: baca data kolektif langsung dari tabel DOM (lebih andal daripada FormData)
            function readKolektifFromTable(tableId, colNames) {
                let result = {};
                colNames.forEach(col => result[col] = []);
                $(`#${tableId} tbody tr`).each(function () {
                    let cells = $(this).find('input, select');
                    colNames.forEach((col, i) => {
                        result[col].push($(cells[i]).val() || '');
                    });
                });
                return result;
            }

            if (templateName === '6. Surat Tugas (ST).docx') {
                let modeSpt = dataObj.modeSpt || 'sendirian';
                tags['isSendirian'] = modeSpt === 'sendirian';
                tags['isKolektif'] = modeSpt === 'kolektif';
                tags['isLampiran'] = modeSpt === 'lampiran';

                if (modeSpt === 'kolektif') {
                    tags['tabelKolektif'] = '{TABEL_KOLEKTIF}';
                    const kData = readKolektifFromTable('tblSptKolektif', ['nama', 'nip', 'pangkat', 'jabatan', 'ket']);
                    let headers = ['No', 'Nama Pegawai<br/>NIP', 'Pangkat / Gol', 'Jabatan', 'Keterangan'];
                    let widths = [300, 1800, 1000, 1100, 800];
                    let rows = [];
                    for (let i = 0; i < kData.nama.length; i++) {
                        rows.push([i + 1, (kData.nama[i] || '-') + '<br/>' + (kData.nip[i] || '-'), kData.pangkat[i] || '-', kData.jabatan[i] || '-', kData.ket[i] || '-']);
                    }
                    if (rows.length > 0) xmlKolektif = buildXmlTabelKolektif(headers, rows, widths);
                }
            } else if (templateName === '4. Surat Keterangan.docx') {
                let modeSuket = dataObj.modeSuket || 'sendirian';
                tags['isSendirian'] = modeSuket === 'sendirian';
                tags['isKolektif'] = modeSuket === 'kolektif';
                tags['isLampiran'] = modeSuket === 'lampiran';

                if (modeSuket === 'kolektif') {
                    tags['tabelKolektif'] = '{TABEL_KOLEKTIF}';
                    const kData = readKolektifFromTable('tblSuketKolektif', ['nama', 'nip', 'pangkat', 'jabatan', 'ket']);
                    let headers = ['No', 'Nama Pegawai<br/>NIP', 'Pangkat / Gol', 'Jabatan', 'Keterangan'];
                    let widths = [300, 1800, 1000, 1100, 800];
                    let rows = [];
                    for (let i = 0; i < kData.nama.length; i++) {
                        rows.push([i + 1, (kData.nama[i] || '-') + '<br/>' + (kData.nip[i] || '-'), kData.pangkat[i] || '-', kData.jabatan[i] || '-', kData.ket[i] || '-']);
                    }
                    if (rows.length > 0) xmlKolektif = buildXmlTabelKolektif(headers, rows, widths);
                }
            } else if (templateName === '7. Surat Keterangan Siswa.docx') {
                let modeSis = dataObj.modeSis || 'sendirian';
                tags['isSendirian'] = modeSis === 'sendirian';
                tags['isKolektif'] = modeSis === 'kolektif';
                tags['isLampiran'] = modeSis === 'lampiran';

                if (modeSis === 'kolektif') {
                    tags['tabelKolektif'] = '{TABEL_KOLEKTIF}';
                    const kData = readKolektifFromTable('tblSisKolektif', ['nama', 'nis', 'ttl', 'jk', 'kelas', 'ortu', 'ket']);
                    let headers = ['No', 'Nama Siswa<br/>NIS/NISN', 'Tempat, Tanggal Lahir', 'JK', 'Kelas', 'Nama Ortu', 'Keterangan'];
                    let widths = [250, 1250, 1000, 400, 500, 800, 800];
                    let rows = [];
                    for (let i = 0; i < kData.nama.length; i++) {
                        rows.push([i + 1, (kData.nama[i] || '-') + '<br/>' + (kData.nis[i] || '-'), kData.ttl[i] || '-', kData.jk[i] || '-', kData.kelas[i] || '-', kData.ortu[i] || '-', kData.ket[i] || '-']);
                    }
                    if (rows.length > 0) xmlKolektif = buildXmlTabelKolektif(headers, rows, widths);
                }
            }

            doc.render(tags);

            // ── INJEKSI TABEL XML DAN ORIENTASI SETELAH RENDER ──
            // Ambil XML yang sudah bersih dari docxtemplater
            let finalXmlDoc = doc.getZip().file('word/document.xml').asText();

            // Fungsi Bantuan untuk mereplace paragraf secara aman tanpa Regex yang rawan gagal
            function replaceParagraph(xmlStr, marker, replacement) {
                let idx = xmlStr.indexOf(marker);
                while (idx !== -1) {
                    let before = xmlStr.substring(0, idx);
                    let after = xmlStr.substring(idx + marker.length);
                    let startTag = Math.max(before.lastIndexOf('<w:p '), before.lastIndexOf('<w:p>'));
                    let endTag = after.indexOf('</w:p>');

                    if (startTag !== -1 && endTag !== -1) {
                        xmlStr = xmlStr.substring(0, startTag) + replacement + after.substring(endTag + 6);
                        idx = xmlStr.indexOf(marker, startTag + replacement.length);
                    } else {
                        // Fallback jika anehnya tidak ada di dalam paragraf
                        xmlStr = before + replacement + after;
                        idx = xmlStr.indexOf(marker, before.length + replacement.length);
                    }
                }
                return xmlStr;
            }

            // Injeksi Tabel Kolektif (Jika ada)
            if (xmlKolektif) {
                finalXmlDoc = replaceParagraph(finalXmlDoc, '{TABEL_KOLEKTIF}', xmlKolektif);
            }

            // 1. Injeksi Tabel Lampiran
            if (dataObj.dataTabelLampiran) {
                try {
                    const tabelData = JSON.parse(dataObj.dataTabelLampiran);
                    let tblXml = '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/><w:jc w:val="center"/><w:tblBorders>';
                    tblXml += '<w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
                    tblXml += '<w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
                    tblXml += '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
                    tblXml += '<w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
                    tblXml += '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
                    tblXml += '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
                    tblXml += '</w:tblBorders></w:tblPr>';

                    // Tambahkan tblGrid agar Word tidak menganggap file korup
                    if (tabelData.length > 0) {
                        tblXml += '<w:tblGrid>';
                        for (let c = 0; c < tabelData[0].length; c++) {
                            tblXml += '<w:gridCol w:w="3000"/>';
                        }
                        tblXml += '</w:tblGrid>';
                    }

                    tabelData.forEach((row, ri) => {
                        const isBold = ri === 0;
                        tblXml += '<w:tr>';
                        row.forEach(cell => {
                            const safe = (cell || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                            const shade = isBold ? '<w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="D0E4FF"/></w:tcPr>' : '';
                            const bold = isBold ? '<w:b/>' : '';
                            tblXml += `<w:tc>${shade}<w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>${bold}<w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${safe}</w:t></w:r></w:p></w:tc>`;
                        });
                        tblXml += '</w:tr>';
                    });
                    tblXml += '</w:tbl>';

                    finalXmlDoc = replaceParagraph(finalXmlDoc, '###TABEL_LAMPIRAN###', tblXml);
                } catch (e) { console.warn("Tabel Lampiran Error", e); }
            } else {
                finalXmlDoc = finalXmlDoc.replace(/###TABEL_LAMPIRAN###/g, '');
            }

            // 2. Injeksi Tabel Pengantar
            if (dataObj.pengantarIsi) {
                try {
                    let tblXml = '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>';
                    tblXml += '<w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
                    tblXml += '<w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
                    tblXml += '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
                    tblXml += '<w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
                    tblXml += '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
                    tblXml += '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
                    tblXml += '</w:tblBorders></w:tblPr>';

                    // Grid khusus 4 kolom
                    tblXml += '<w:tblGrid><w:gridCol w:w="1000"/><w:gridCol w:w="4000"/><w:gridCol w:w="2000"/><w:gridCol w:w="3000"/></w:tblGrid>';

                    tblXml += '<w:tr><w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="D0E4FF"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:sz w:val="20"/></w:rPr><w:t>No</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="D0E4FF"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:sz w:val="20"/></w:rPr><w:t>Jenis yang dikirim</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="D0E4FF"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:sz w:val="20"/></w:rPr><w:t>Banyaknya</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="D0E4FF"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:sz w:val="20"/></w:rPr><w:t>Keterangan</w:t></w:r></w:p></w:tc></w:tr>';
                    const safeIsi = (dataObj.pengantarIsi || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    const safeJml = (dataObj.pengantarJml || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    const safeKet = (dataObj.pengantarKet || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    tblXml += `<w:tr><w:tc><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="20"/></w:rPr><w:t>1</w:t></w:r></w:p></w:tc><w:tc><w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${safeIsi}</w:t></w:r></w:p></w:tc><w:tc><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${safeJml}</w:t></w:r></w:p></w:tc><w:tc><w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${safeKet}</w:t></w:r></w:p></w:tc></w:tr>`;
                    tblXml += '</w:tbl>';

                    finalXmlDoc = replaceParagraph(finalXmlDoc, '###TABEL_PENGANTAR###', tblXml);
                } catch (e) { }
            } else {
                finalXmlDoc = finalXmlDoc.replace(/###TABEL_PENGANTAR###/g, '');
            }

            // 3. Injeksi Tanda Tangan Dinamis
            if (finalXmlDoc.includes('###TTD_DINAMIS###') || finalXmlDoc.includes('###TTD_DINAMIS_TANGGAL###')) {
                try {
                    const safeTgl = ($('#tanggalSuratFull').val() || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    const safeNama = (isAn ? (dataObj.anNama || '') : (dataObj.ttdNama || s.kepsek_nama || '')).toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    const safePangkat = (isAn ? (dataObj.anPangkat || '') : (dataObj.ttdPangkat || s.kepsek_pangkat || '')).toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    const safeNip = (isAn ? (dataObj.anNip || '') : (dataObj.ttdNip || s.kepsek_nip || '')).toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    const safeJabatanAn = (dataObj.anJabatan || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

                    let buildTtdXml = (withTanggal) => {
                        let ttdXml = '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:jc w:val="center"/><w:tblBorders><w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/></w:tblBorders></w:tblPr>';
                        ttdXml += '<w:tblGrid><w:gridCol w:w="6000"/><w:gridCol w:w="4000"/></w:tblGrid>';
                        ttdXml += '<w:tr><w:tc><w:tcPr><w:tcW w:w="3000" w:type="pct"/></w:tcPr><w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="2000" w:type="pct"/></w:tcPr>';

                        if (withTanggal) {
                            ttdXml += `<w:p><w:pPr><w:jc w:val="left"/><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">${safeTgl}</w:t></w:r></w:p>`;
                        }

                        if (isAn) {
                            ttdXml += `<w:p><w:pPr><w:jc w:val="left"/><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">a.n. Kepala Sekolah,</w:t></w:r></w:p>`;
                            ttdXml += `<w:p><w:pPr><w:jc w:val="left"/><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">${safeJabatanAn}</w:t></w:r></w:p>`;
                        } else {
                            ttdXml += `<w:p><w:pPr><w:jc w:val="left"/><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">Kepala Sekolah,</w:t></w:r></w:p>`;
                        }

                        ttdXml += `<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p><w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p><w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`;
                        ttdXml += `<w:p><w:pPr><w:jc w:val="left"/><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">${safeNama}</w:t></w:r></w:p>`;
                        ttdXml += `<w:p><w:pPr><w:jc w:val="left"/><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">${safePangkat}</w:t></w:r></w:p>`;
                        ttdXml += `<w:p><w:pPr><w:jc w:val="left"/><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">NIP. ${safeNip}</w:t></w:r></w:p>`;

                        ttdXml += '</w:tc></w:tr></w:tbl>';
                        return ttdXml;
                    };

                    if (finalXmlDoc.includes('###TTD_DINAMIS###')) {
                        finalXmlDoc = replaceParagraph(finalXmlDoc, '###TTD_DINAMIS###', buildTtdXml(false));
                    }
                    if (finalXmlDoc.includes('###TTD_DINAMIS_TANGGAL###')) {
                        finalXmlDoc = replaceParagraph(finalXmlDoc, '###TTD_DINAMIS_TANGGAL###', buildTtdXml(true));
                    }
                } catch (e) { }
            }

            // 4. Injeksi Orientasi Halaman
            if (dataObj.orientasiHalaman) {
                try {
                    const targetOrient = dataObj.orientasiHalaman; // 'portrait' atau 'landscape'
                    finalXmlDoc = finalXmlDoc.replace(/<w:pgSz\b[^>]*>/g, function (match) {
                        let w = match.match(/w:w="([0-9]+)"/);
                        let h = match.match(/w:h="([0-9]+)"/);
                        let currOrient = match.match(/w:orient="([^"]+)"/);
                        currOrient = currOrient ? currOrient[1] : 'portrait';

                        if (w && h && currOrient !== targetOrient) {
                            return `<w:pgSz w:w="${h[1]}" w:h="${w[1]}" w:orient="${targetOrient}"/>`;
                        } else if (currOrient !== targetOrient && (!w || !h)) {
                            return match.replace(/>$/, ` w:orient="${targetOrient}"/>`);
                        }
                        return match;
                    });
                } catch (errOrient) { console.warn('Gagal mengubah orientasi halaman:', errOrient); }
            }

            // Kembalikan XML yang sudah diinjeksi tabel dan orientasi ke ZIP
            doc.getZip().file('word/document.xml', finalXmlDoc);

            const out = doc.getZip().generate({
                type: "arraybuffer",
            });

            // Cek apakah berjalan di dalam Electron (Node.js tersedia)
            if (typeof require !== 'undefined') {
                try {
                    const fs = require('fs');
                    const path = require('path');
                    const os = require('os');

                    // Pastikan folder Hasil Surat ada di dalam folder Documents pengguna
                    const documentsDir = path.join(os.homedir(), 'Documents');
                    const dir = path.join(documentsDir, 'Hasil Surat SiDiMAS');
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }

                    // Penamaan file unik
                    const baseName = templateName.replace('.docx', '');
                    const fileName = `Generate_${baseName}_${new Date().getTime()}.docx`;
                    const fullPath = path.join(dir, fileName);

                    // Simpan file ke direktori "database" dokumen
                    fs.writeFileSync(fullPath, Buffer.from(out));

                    // SEKALIGUS unduh file untuk pengguna (trigger browser download)
                    const outBlob = doc.getZip().generate({
                        type: "blob",
                        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    });
                    saveAs(outBlob, `Generate_${templateName}`);
                    setBtnLoading('#btnGen', false, 'GENERATE DOKUMEN');
                    window.promptSaveArsipKeluar(dataObj, outBlob, `Generate_${templateName}`, true);
                } catch (e) {
                    setBtnLoading('#btnGen', false, 'GENERATE DOKUMEN');
                    Swal.fire('Error Penyimpanan', `Gagal menyimpan: ${e.toString()}`, 'error');
                }
            } else {
                // Jika bukan Electron, kembalikan mode saveAs browser
                const outBlob = doc.getZip().generate({
                    type: "blob",
                    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                });
                saveAs(outBlob, `Generate_${templateName}`);
                setBtnLoading('#btnGen', false, 'GENERATE DOKUMEN');
                window.promptSaveArsipKeluar(dataObj, outBlob, `Generate_${templateName}`, true);
            }

            $('#hasilGenerate').addClass('hide');
        })
        .catch(err => {
            setBtnLoading('#btnGen', false, 'GENERATE DOKUMEN');
            Swal.fire('Error', err.toString(), 'error');
        });
}

/* --- FUNGSI TABEL DINAMIS UNTUK LAMPIRAN --- */
function addColLampiran() {
    $('#tblDynamicLampiran thead tr').append('<th><input type="text" class="form-control form-control-sm fw-bold" placeholder="Header Baru"></th>');
    $('#tblDynamicLampiran tbody tr').each(function () {
        $(this).append('<td><input type="text" class="form-control form-control-sm"></td>');
    });
}

function addRowLampiran() {
    let cols = $('#tblDynamicLampiran thead th').length;
    let tr = '<tr>';
    let rowCount = $('#tblDynamicLampiran tbody tr').length + 1;
    for (let i = 0; i < cols; i++) {
        if (i === 0) {
            tr += `<td><input type="text" class="form-control form-control-sm text-center" value="${rowCount}"></td>`;
        } else {
            tr += '<td><input type="text" class="form-control form-control-sm"></td>';
        }
    }
    tr += '</tr>';
    $('#tblDynamicLampiran tbody').append(tr);
}


function resetGenerator() { $('#formGen')[0].reset(); $('#hasilGenerate').addClass('hide'); $('#selKodeArsip').val('').trigger('change'); const dateNow = new Date(); const offset = dateNow.getTimezoneOffset() * 60000; const today = (new Date(dateNow - offset)).toISOString().slice(0, 10); $('#inpTglSurat').val(today); gantiFormSurat(); updatePreview(); $('html,body').animate({ scrollTop: 0 }, 500); }

/* --- NAVIGATION & TABLES --- */
function nav(p, el) {
    $('.modal-backdrop').remove(); $('body').removeClass('modal-open'); $('body').css('overflow', 'auto'); Swal.close();
    $('.page-view').addClass('hide'); $('#page-' + p).removeClass('hide');

    /* Bagian yang diubah: Reset active class untuk desktop dan mobile */
    $('.sidebar .nav-link, .nav-item-mobile').removeClass('active');
    if (el) {
        $(el).addClass('active');
    } else {
        $(`.sidebar .nav-link[onclick="nav('${p}', this)"]`).addClass('active');
        $(`.nav-item-mobile[onclick="nav('${p}', this)"]`).addClass('active');
    }

    // Sisa fungsinya tetap sama...
    if (p === 'home') { loadInitData(); loadDashboardStats(); }
    if (p === 'agenda') {
        refreshTable('masuk');
        refreshTable('keluar');
        $('a[data-bs-toggle="tab"]').on('shown.bs.tab', function (e) {
            $.fn.dataTable.tables({ visible: true, api: true }).columns.adjust();
        });
        const triggerEl = document.querySelector('#masuk-tab');
        if (triggerEl) {
            const tab = bootstrap.Tab.getOrCreateInstance(triggerEl);
            tab.show();
        }
    }
    if (p === 'buat') { loadAutoNumber(); }
    if (p === 'inbox') { loadInboxTable(); }

    // FIX: Reset tab Bootstrap di halaman Pengaturan agar tidak perlu klik 2x
    if (p === 'setting') {
        if (typeof loadUserInfoPage === 'function') loadUserInfoPage();
        if (typeof loadKodeCustomTable === 'function') loadKodeCustomTable();
        if (typeof loadUsers === 'function') loadUsers();

        // Aktifkan ulang tab pertama (Pengaturan Sistem) secara paksa
        const triggerEl = document.querySelector('#sistem-tab');
        if (triggerEl) {
            const tab = bootstrap.Tab.getOrCreateInstance(triggerEl);
            tab.show();
        }
    }
}


function loadDashboardStats() {
    apiCall('getDashboardData').then(d => {
        $('#statMasuk').text(d.totalMasuk);
        $('#statKeluar').text(d.totalKeluar);
        renderCharts(d);
    });
}

function refreshAllTables() { loadDashboardStats(); }

let chartBln = null;
let chartJns = null;

function renderCharts(data) {
    if (chartBln) chartBln.destroy();
    if (chartJns) chartJns.destroy();

    chartBln = new Chart(document.getElementById('chartBulanan'), {
        type: 'bar',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'],
            datasets: [
                { label: 'Surat Masuk', data: data.bulanMasuk, backgroundColor: '#0d6efd' },
                { label: 'Surat Keluar', data: data.bulanKeluar, backgroundColor: '#198754' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: 'Jumlah Surat' } } } }
    });

    const jenisLabels = [];
    const jenisVals = [];
    if (data.jenisKeluar) {
        for (const [key, value] of Object.entries(data.jenisKeluar)) {
            jenisLabels.push(key); jenisVals.push(value);
        }
    }

    chartJns = new Chart(document.getElementById('chartJenis'), {
        type: 'pie',
        data: { labels: jenisLabels, datasets: [{ data: jenisVals }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
}

function refreshTable(j) {
    const tid = (j === 'masuk') ? '#tMasuk' : '#tKeluar';
    if ($.fn.DataTable.isDataTable(tid)) { $(tid).DataTable().destroy(); }
    $(tid).html('<tbody><tr><td colspan="12" class="text-center p-5"><div class="spinner-border text-primary" role="status"></div><div class="mt-2 text-muted">Mengambil data terbaru...</div></td></tr></tbody>');

    apiCall('ambilData', { jenis: j }).then(d => {
        if (j === 'masuk') { dbMasuk = d || []; } else { dbKeluar = d || []; }
        const r = (j === 'masuk') ? dbMasuk : dbKeluar;
        const cm = [
            { title: "ID", visible: false },
            { title: "Tgl Terima", visible: false },
            { title: "Pengirim" },
            { title: "Tgl Surat" },
            { title: "No Surat" },
            { title: "Perihal" },
            { title: "Tujuan", visible: false },
            { title: "Uraian" },
            { title: "Ket", visible: false },
            { title: "File", render: btnFile },
            { title: "Aksi", render: (d, t, row, meta) => renderAksi(meta.row, 'masuk') }];
        const ck = [
            { title: "ID", visible: false },
            { title: "Tgl Surat" },
            { title: "Klasifikasi", visible: false },
            { title: "No Surat" },
            { title: "Perihal" },
            { title: "Tujuan" },
            { title: "Uraian" },
            { title: "Ket", visible: false },
            { title: "File", render: btnFile },
            { title: "Aksi", render: (d, t, row, meta) => renderAksi(meta.row, 'keluar') }];

        $(tid).DataTable({ data: r, columns: (j === 'masuk') ? cm : ck, scrollX: true, destroy: true, language: { url: "//cdn.datatables.net/plug-ins/1.13.4/i18n/id.json" }, order: [[0, 'desc']] });
    });
}

function renderAksi(index, jenis) {
    const row = getDataByIndex(jenis, index);
    const currentUser = localStorage.getItem('sidimas_user');
    const currentRole = localStorage.getItem('sidimas_role') || 'admin';
    const isAdmin = (currentRole === 'admin' || currentRole === 'Admin');
    const creator = row[row.length - 2];

    // Jika bukan Admin dan surat ini dibuat oleh orang lain
    const isLocked = !isAdmin && creator && creator !== currentUser;

    if (isLocked) {
        return `<div class="btn-group" role="group">
            <button class="btn btn-sm btn-info text-white" onclick="viewSurat('${jenis}', ${index})" title="Lihat"><i class="fas fa-eye"></i></button>
            <span class="btn btn-sm btn-secondary disabled" title="Terkunci"><i class="fas fa-lock"></i></span>
        </div>`;
    } else {
        let btnHtml = `<div class="btn-group" role="group">
            <button class="btn btn-sm btn-info text-white" onclick="viewSurat('${jenis}', ${index})" title="Lihat"><i class="fas fa-eye"></i></button>
            <button class="btn btn-sm btn-warning" onclick="editSurat('${jenis}', ${index})" title="Edit"><i class="fas fa-edit"></i></button>`;

        // Hapus hanya untuk admin
        if (isAdmin) {
            btnHtml += `<button class="btn btn-sm btn-danger" onclick="delSurat('${jenis}', ${index})" title="Hapus"><i class="fas fa-trash"></i></button>`;
        }

        btnHtml += `</div>`;
        return btnHtml;
    }
}

function btnFile(d) { return (!d || d.length < 5) ? '-' : `<a href="${d}" target="_blank" class="btn btn-sm btn-primary"><i class="fas fa-download"></i></a>`; }

/* ================= EXPORT & CRUD ================= */
function downloadPDF(j) {
    const s = (j === 'masuk') ? $('#filterM_Start').val() : $('#filterK_Start').val();
    const e = (j === 'masuk') ? $('#filterM_End').val() : $('#filterK_End').val();
    if (!s || !e) { Swal.fire('Info', 'Pilih tanggal', 'warning'); return; }

    // Gunakan loading timer baru!
    showLoadingTimer('Menyiapkan PDF...');

    apiCall('getLaporanRawHTML', { jenis: j, tglAwal: s, tglAkhir: e }).then(r => {
        if (r.success) {
            // Kita proses HTML menjadi PDF secara instan di HP/Laptop pengguna
            const element = document.createElement('div');
            element.innerHTML = r.html;

            const opt = {
                margin: 0.5,
                filename: 'Laporan_Surat_' + j.toUpperCase() + '.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
            };

            html2pdf().set(opt).from(element).save().then(() => {
                Swal.close();
            });
        } else {
            Swal.fire('Error', r.message || 'Gagal memuat laporan', 'error');
        }
    }).catch(err => {
        Swal.fire('Error', 'Terjadi kesalahan sistem', 'error');
    });
}

function downloadExcel(j) { const s = (j === 'masuk') ? $('#filterM_Start').val() : $('#filterK_Start').val(); const e = (j === 'masuk') ? $('#filterM_End').val() : $('#filterK_End').val(); if (!s || !e) { Swal.fire('Info', 'Pilih tanggal', 'warning'); return; } showLoadingTimer('Memproses Excel...'); apiCall('generateLaporanExcel', { jenis: j, tglAwal: s, tglAkhir: e }).then(r => { Swal.close(); if (r.success) window.open(r.url, '_blank'); else Swal.fire('Err', r.message, 'error'); }); }

function modalInput(j, mode) {
    $('#fSurat')[0].reset(); $('#fSurat').removeClass('was-validated'); $('#mJenis').val(j); $('#mMode').val(mode); $('#divMasuk,#divKeluar').addClass('hide'); $('#btnSimpan').show(); setBtnLoading('#btnSimpan', false, 'SIMPAN DATA');
    $('input,textarea,select').prop('disabled', false); $('#divMasuk').find('input,textarea,select').prop('disabled', true); $('#divKeluar').find('input,textarea,select').prop('disabled', true);
    if (mode === 'view') { $('#judulModal').text('Detail Data'); $('#btnSimpan').hide(); $('.modal-body').find('input,textarea,select').prop('disabled', true); } else { $('#judulModal').text(mode === 'add' ? 'Input Baru' : 'Edit Data'); }
    if (j === 'masuk') { $('#divMasuk').removeClass('hide'); if (mode !== 'view') { $('#divMasuk').find('input,textarea,select').prop('disabled', false); $('.req-in').prop('required', true); } } else { $('#divKeluar').removeClass('hide'); if (mode !== 'view') { $('#divKeluar').find('input,textarea,select').prop('disabled', false); $('.req-out').prop('required', true); } }
    new bootstrap.Modal('#modalSurat').show();
}
function getDataByIndex(jenis, index) { return (jenis === 'masuk') ? dbMasuk[index] : dbKeluar[index]; }
function viewSurat(jenis, index) { const row = getDataByIndex(jenis, index); modalInput(jenis, 'view'); fillForm(jenis, row); }
function editSurat(jenis, index) { const row = getDataByIndex(jenis, index); modalInput(jenis, 'edit'); $('#mId').val(row[0]); fillForm(jenis, row); }
function fillForm(jenis, row) { if (jenis === 'masuk') { $('#inTglTerima').val(row[1]); $('#inPengirim').val(row[2]); $('#inTglSuratM').val(row[3]); $('#inNoSuratM').val(row[4]); $('#inPerihalM').val(row[5]); $('#inTujuanM').val(row[6]); $('#inUraianM').val(row[7]); $('#inKetM').val(row[8]); $('#mFileLama').val(row[9]); } else { $('#inTglSuratK').val(row[1]); $('#inJenisK').val(row[2]); $('#inNoSuratK').val(row[3]); $('#inPerihalK').val(row[4]); $('#inTujuanK').val(row[5]); $('#inUraianK').val(row[6]); $('#inKetK').val(row[7]); $('#mFileLama').val(row[8]); } }
function delSurat(jenis, index) { const row = getDataByIndex(jenis, index); const id = row[0]; const u = localStorage.getItem('sidimas_user'); const r = localStorage.getItem('sidimas_role'); Swal.fire({ title: 'Hapus Data?', text: "Data tidak bisa dikembalikan!", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Ya, Hapus' }).then((res) => { if (res.isConfirmed) { Swal.showLoading(); apiCall('deleteSurat', { id: id, jenis: jenis, user: u, role: r }).then(resp => { if (resp.success) { Swal.fire('Terhapus', '', 'success'); refreshTable(jenis); refreshAllTables(); } else Swal.fire('Gagal', resp.message, 'error'); }); } }); }


function submitSurat(e) {
    e.preventDefault();
    if (!document.getElementById('fSurat').checkValidity()) {
        e.stopPropagation(); document.getElementById('fSurat').classList.add('was-validated'); return;
    }

    // Loading di tombol tetap berjalan
    setBtnLoading('#btnSimpan', true, 'Menyimpan...');

    const j = $('#mJenis').val();
    processFile(j === 'masuk' ? 'fileMasuk' : 'fileKeluar').then(f => {
        if (document.getElementById(j === 'masuk' ? 'fileMasuk' : 'fileKeluar').files.length > 0 && f === null) {
            setBtnLoading('#btnSimpan', false, 'SIMPAN DATA'); return;
        }
        const fd = new FormData(e.target);
        const dataObj = {};
        for (let [key, value] of fd.entries()) {
            if (dataObj[key] !== undefined) {
                if (!Array.isArray(dataObj[key])) dataObj[key] = [dataObj[key]];
                dataObj[key].push(value);
            } else {
                dataObj[key] = value;
            }
        }
        dataObj.currentUser = localStorage.getItem('sidimas_user');
        dataObj.currentRole = localStorage.getItem('sidimas_role');

        // --- INI BARIS TAMBAHANNYA: Memunculkan Pop-up Timer Mundur ---
        showLoadingTimer('Menyimpan Data...');

        apiCall('simpanData', { data: dataObj, fileInfo: f })
            .then(r => {
                setBtnLoading('#btnSimpan', false, 'SIMPAN DATA');
                // Notifikasi Swal di bawah ini akan otomatis menggantikan/menutup pop-up timer
                if (r.success) {
                    Swal.fire('Berhasil', 'Data tersimpan', 'success');
                    bootstrap.Modal.getInstance('#modalSurat').hide();
                    refreshTable(j); refreshAllTables();
                } else {
                    Swal.fire('Akses Ditolak', r.message, 'error');
                }
            })
            .catch(err => {
                setBtnLoading('#btnSimpan', false, 'SIMPAN DATA');
                Swal.fire('Error Server', err.toString(), 'error');
            });
    });
}

/* --- FUNGSI ANIMASI KOTAK LOGIN DI HP --- */
function toggleMobileLogin(action) {
    if (action === 'show') {
        // Sembunyikan kotak kiri, munculkan kotak kanan
        $('#boxLeft').hide();
        $('#boxRight').fadeIn(300);
    } else {
        // Sembunyikan kotak kanan, kembali ke kotak kiri
        $('#boxRight').hide();
        $('#boxLeft').fadeIn(300);
    }
}

/* --- MANAJEMEN USER --- */
function modalUser(m, u, p, r, n) { $('#uMode').val(m); if (m === 'add') { $('#uName').val('').prop('readonly', false); $('#uPass,#uFull').val(''); } else { $('#uOld').val(u); $('#uName').val(u).prop('readonly', true); $('#uPass').val(p); $('#uRole').val(r); $('#uFull').val(n); } new bootstrap.Modal('#modalUser').show(); }
function submitUser(e) { e.preventDefault(); showLoadingTimer('Menyimpan User...'); apiCall('saveUser', Object.fromEntries(new FormData(e.target))).then(r => { if (r.success) { Swal.fire('OK', 'Disimpan', 'success'); bootstrap.Modal.getInstance('#modalUser').hide(); loadUsers(); } else Swal.fire('Err', r.message, 'error'); }); }

/*--KHUSUS DEMO DINONAKTIFKAN EDIT DAN HAPUS--*/
function loadUsers() {
    apiCall('getUsersList')
        .then(r => {
            let h = ''; let i = 1;
            if (Array.isArray(r)) {
                if (r.length === 0) {
                    h = `<tr><td colspan="6" class="text-center text-muted">Belum ada akun.</td></tr>`;
                } else {
                    r.forEach(u => {
                        let roleStr = (u[2] || '').toString();
                        let badgeClass = roleStr.toLowerCase() === 'admin' ? 'bg-danger' : 'bg-info text-dark';
                        h += `<tr>
                            <td class="text-center">${i++}</td>
                            <td><span class="badge bg-dark fs-6 px-3 py-2 font-monospace">${u[0]}</span></td>
                            <td>
                                <div class="input-group input-group-sm" style="width: 200px;">
                                    <input type="password" class="form-control font-monospace" value="${u[1]}" readonly style="background-color: var(--bs-secondary); color: white; border: none; font-size: 1rem;">
                                    <button class="btn btn-secondary border-0" type="button" onclick="togglePassword(this)"><i class="fas fa-eye"></i></button>
                                </div>
                            </td>
                            <td><span class="badge ${badgeClass} px-3 py-2">${roleStr}</span></td>
                            <td class="text-muted small">${u[3] || '-'}</td>
                            <td class="online-only">
                                <button class="btn btn-sm btn-warning" onclick="modalUser('edit','${u[0]}','','${u[2]}','${u[3]}')" title="Edit"><i class="fas fa-edit"></i></button>
                                <button class="btn btn-sm btn-danger" onclick="delUser('${u[0]}')" title="Hapus"><i class="fas fa-trash"></i></button>
                            </td>
                        </tr>`;
                    });
                }
            } else if (r && r.message) {
                h = `<tr><td colspan="6" class="text-center text-danger">${r.message}</td></tr>`;
            } else {
                h = `<tr><td colspan="6" class="text-center text-danger">Gagal memuat data dari server (Respons tidak valid).</td></tr>`;
            }
            $('#tbody-users').html(h);
            $('.online-only').show(); // Make sure aksi column is shown
        })
        .catch(e => {
            $('#tbody-users').html(`<tr><td colspan="6" class="text-center text-danger">Error koneksi: ${e.message}</td></tr>`);
        });
}

function togglePassword(btn) {
    const input = $(btn).prev('input');
    const icon = $(btn).find('i');
    if (input.attr('type') === 'password') {
        input.attr('type', 'text');
        icon.removeClass('fa-eye').addClass('fa-eye-slash');
    } else {
        input.attr('type', 'password');
        icon.removeClass('fa-eye-slash').addClass('fa-eye');
    }
}


function delUser(u) { if (confirm('Hapus User ini?')) apiCall('deleteUser', { u: u }).then(loadUsers); }
function modalPrivasi() { new bootstrap.Modal(document.getElementById('modalPrivasi')).show(); }

function modalHelpdesk() {
    let email = $('#txtEmail').text() || "info@sekolah.sch.id";
    let web = $('#txtWeb').text() || "www.sekolah.sch.id";
    let telp = $('#inTelp').val() || "-";
    let wa = $('#inWaAdmin').val() || "";

    let waText = wa ? `<a href="https://wa.me/${wa.replace(/[^0-9]/g, '')}" target="_blank">${wa}</a>` : "Silakan hubungi Admin Sekolah";

    Swal.fire({
        title: 'Helpdesk Sekolah',
        html: `
            <div class="text-start mt-3" style="font-size: 0.95rem;">
                <p><i class="fas fa-phone-alt text-secondary me-2"></i> <strong>No Telp:</strong><br> <a href="tel:${telp}">${telp}</a></p>
                <p><i class="fab fa-whatsapp text-success me-2"></i> <strong>WhatsApp Admin:</strong><br> ${waText}</p>
                <p><i class="fas fa-envelope text-primary me-2"></i> <strong>Email:</strong><br> <a href="mailto:${email}">${email}</a></p>
                <p><i class="fas fa-globe text-info me-2"></i> <strong>Website:</strong><br> <a href="http://${web}" target="_blank">${web}</a></p>
            </div>
        `,
        icon: 'info',
        confirmButtonText: 'Tutup',
        confirmButtonColor: 'var(--main-color)'
    });
}

function modalInstal() {
    if (deferredPrompt) {
        showInstallPopup();
    } else {
        Swal.fire({
            title: 'Instal Aplikasi',
            html: `
                <div class="d-grid gap-3 mt-3">
                    <button class="btn btn-primary rounded-pill shadow-sm py-2 fw-bold" onclick="Swal.fire('Info PWA', 'Browser Anda mungkin tidak mendukung instalasi otomatis, atau aplikasi sudah terinstal. Anda bisa menginstalnya secara manual melalui menu browser (Add to Home Screen / Install App).', 'info')">
                        <i class="fas fa-info-circle me-2"></i> Info Instalasi
                    </button>
                    <button class="btn btn-dark rounded-pill shadow-sm py-2 fw-bold" onclick="Swal.fire('Info iOS', 'Untuk pengguna iPhone/iPad, silakan buka halaman ini di Safari, tekan tombol Share (Bagikan), lalu pilih Tambahkan ke Layar Utama (Add to Home Screen).', 'info')">
                        <i class="fab fa-apple me-2"></i> Petunjuk Instal iOS
                    </button>
                </div>
            `,
            showConfirmButton: false,
            showCloseButton: true
        });
    }
}



/* --- KODE KLASIFIKASI CUSTOM --- */
async function loadKodeKlasifikasi() {
    const sumber = $('input[name="sumberKode"]:checked').val() || 'permendagri';
    let o = '<option value="">-- Pilih Kode (Ketik untuk mencari...) --</option>';

    if (sumber === 'permendagri') {
        if (typeof KODE_KLASIFIKASI_LOKAL !== 'undefined') {
            KODE_KLASIFIKASI_LOKAL.forEach(k => o += `<option value="${k.c}">${k.l}</option>`);
        } else {
            o = '<option value="">-- Gagal Memuat Kode Permendagri --</option>';
        }
    } else {
        try {
            const customCodes = await localDB.kodeCustom.toArray();
            if (customCodes && customCodes.length > 0) {
                customCodes.forEach(k => o += `<option value="${k.kode}">${k.kode} - ${k.uraian}</option>`);
            } else {
                o = '<option value="">-- Belum Ada Kode Klasifikasi Daerah --</option>';
            }
        } catch (e) {
            console.error('Gagal meload kode custom:', e);
            o = '<option value="">-- Gagal Memuat Kode Daerah --</option>';
        }
    }
    $('#selKodeArsip').html(o);
}

async function loadKodeCustomTable() {
    let tbody = '';
    try {
        if (API_URL) {
            const res = await apiCall('getKodeCustom');
            if (res && (res.status === 'success' || res.success)) {
                await localDB.kodeCustom.clear();
                if (res.data && res.data.length > 0) {
                    await localDB.kodeCustom.bulkPut(res.data);
                }
            } else if (res && res.message) {
                tbody = `<tr><td colspan="4" class="text-center text-danger">Server Error: ${res.message}</td></tr>`;
                $('#tbody-kodecustom').html(tbody);
                return;
            }
        }

        const customCodes = await localDB.kodeCustom.toArray();
        if (customCodes && customCodes.length > 0) {
            customCodes.forEach((k, index) => {
                tbody += `<tr>
                    <td class="text-center">${index + 1}</td>
                    <td class="fw-bold">${k.kode}</td>
                    <td>${k.uraian}</td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="editKodeCustom('${k.id}', '${k.kode}', '${k.uraian}')"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="hapusKodeCustom('${k.id}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;
            });
        } else {
            tbody = '<tr><td colspan="4" class="text-center text-muted">Belum ada data kode klasifikasi daerah.</td></tr>';
        }
    } catch (e) {
        tbody = `<tr><td colspan="4" class="text-center text-danger">Error memuat data: ${e.message || e}</td></tr>`;
    }
    $('#tbody-kodecustom').html(tbody);
}

function editKodeCustom(id, kode, uraian) {
    $('#kc_id').val(id);
    $('#kc_kode').val(kode);
    $('#kc_uraian').val(uraian);
    $('#kc_kode').focus();
}

async function simpanKodeCustom(e) {
    e.preventDefault();
    let id = $('#kc_id').val();
    if (!id) {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            id = crypto.randomUUID();
        } else {
            id = 'kc_' + new Date().getTime() + Math.random().toString(36).substring(2);
        }
    }
    const kode = $('#kc_kode').val();
    const uraian = $('#kc_uraian').val();

    try {
        if (API_URL) {
            const res = await apiCall('saveKodeCustom', { id: id, kode: kode, uraian: uraian });
            if (res && !res.success) throw new Error(res.message || "Gagal menyimpan ke server");
        }
        await localDB.kodeCustom.put({ id: id, kode: kode, uraian: uraian });
        $('#kc_id').val('');
        $('#kc_kode').val('');
        $('#kc_uraian').val('');
        loadKodeCustomTable();
        Swal.fire({ icon: 'success', title: 'Tersimpan', text: 'Kode klasifikasi daerah berhasil disimpan.', timer: 1500, showConfirmButton: false });

        if ($('#page-buat').hasClass('hide') === false) {
            loadKodeKlasifikasi();
        }
    } catch (err) {
        Swal.fire('Error', 'Gagal menyimpan kode: ' + err.message, 'error');
    }
}

async function hapusKodeCustom(id) {
    Swal.fire({
        title: 'Hapus Kode?',
        text: "Kode ini akan dihapus dari sistem.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Hapus!'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                if (API_URL) {
                    const res = await apiCall('deleteKodeCustom', { id: id });
                    if (res && !res.success) throw new Error(res.message || "Gagal menghapus di server");
                }
                await localDB.kodeCustom.delete(id);
                loadKodeCustomTable();
                Swal.fire({ icon: 'success', title: 'Terhapus', text: 'Kode klasifikasi daerah berhasil dihapus.', timer: 1500, showConfirmButton: false });

                if ($('#page-buat').hasClass('hide') === false) {
                    loadKodeKlasifikasi();
                }
            } catch (err) {
                Swal.fire('Error', 'Gagal menghapus kode: ' + err.message, 'error');
            }
        }
    });
}


/* --- KODE KLASIFIKASI CUSTOM EXCEL IMPORT & FILTER --- */

function filterKodeCustom() {
    const term = $('#cariKodeCustom').val().toLowerCase();
    $('#tbody-kodecustom tr').each(function () {
        const text = $(this).text().toLowerCase();
        if (text.indexOf(term) > -1) {
            $(this).show();
        } else {
            $(this).hide();
        }
    });
}

function modalImportExcel() {
    $('#fImportExcel')[0].reset();
    const m = document.getElementById('modalImportExcel');
    if (m) {
        let modal = bootstrap.Modal.getInstance(m);
        if (!modal) modal = new bootstrap.Modal(m);
        modal.show();
    }
}

function downloadTemplateExcel() {
    if (typeof XLSX === 'undefined') {
        Swal.fire('Error', 'Library Excel (XLSX) tidak ditemukan.', 'error');
        return;
    }
    const data = [
        ["kode", "uraian"],
        ["000", "UMUM"],
        ["001", "LAMBANG"],
        ["002", "TANDA KEHORMATAN/PENGHARGAAN"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_Kode");
    XLSX.writeFile(wb, "Template_Kode_Klasifikasi.xlsx");
}

async function prosesImportExcel() {
    const file = $('#fileExcelImport').prop('files')[0];
    if (!file) {
        Swal.fire('Error', 'Silakan pilih file Excel terlebih dahulu!', 'warning');
        return;
    }

    if (typeof XLSX === 'undefined') {
        Swal.fire('Error', 'Library Excel (XLSX) tidak ditemukan.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

            if (json.length === 0) {
                Swal.fire('Error', 'File Excel kosong atau format tidak sesuai.', 'error');
                return;
            }

            const firstRow = json[0];
            if (!firstRow.hasOwnProperty('kode') || !firstRow.hasOwnProperty('uraian')) {
                Swal.fire('Error', 'Format header salah! Pastikan ada kolom "kode" dan "uraian" pada baris pertama (header).', 'error');
                return;
            }

            let importCount = 0;
            for (let i = 0; i < json.length; i++) {
                const row = json[i];
                if (row.kode !== "" && row.uraian !== "") {
                    let id;
                    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                        id = crypto.randomUUID();
                    } else {
                        id = 'kc_' + new Date().getTime() + Math.random().toString(36).substring(2);
                    }
                    const payload = {
                        id: id,
                        kode: row.kode.toString(),
                        uraian: row.uraian.toString()
                    };
                    if (API_URL) {
                        await apiCall('saveKodeCustom', payload);
                    }
                    await localDB.kodeCustom.put(payload);
                    importCount++;
                }
            }

            loadKodeCustomTable();
            if ($('#page-buat').hasClass('hide') === false) {
                loadKodeKlasifikasi();
            }

            const m = document.getElementById('modalImportExcel');
            if (m) {
                let modal = bootstrap.Modal.getInstance(m);
                if (modal) modal.hide();
            }

            Swal.fire('Berhasil', importCount + ' data kode klasifikasi berhasil diimport.', 'success');
        } catch (err) {
            Swal.fire('Error', 'Gagal memproses file Excel: ' + err.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

/* ==========================================
   FITUR SURAT MASUK EKSTERNAL (INBOX) - ONLINE
========================================== */

function showModalKirimSurat() {
    $('#fKirimSurat')[0].reset();
    new bootstrap.Modal(document.getElementById('modalKirimSurat')).show();
}

async function submitSuratEksternal(e) {
    e.preventDefault();
    if (!API_URL) {
        Swal.fire('Error', 'Link tenant tidak valid.', 'error');
        return;
    }

    $('#btnSubmitEksternal').prop('disabled', true);
    $('#spinSubmitEksternal').removeClass('hide');

    const file = $('#extFile').prop('files')[0];
    let fileInfoRaw = null;

    if (file) {
        if (file.size > 2000000) {
            Swal.fire('Error', 'Ukuran file maksimal 2MB!', 'warning');
            $('#btnSubmitEksternal').prop('disabled', false);
            $('#spinSubmitEksternal').addClass('hide');
            return;
        }

        try {
            if (file.type.startsWith('image/')) {
                fileInfoRaw = await compressImageForUpload(file);
            } else {
                fileInfoRaw = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (ev) => resolve({
                        name: file.name.replace(/\.[^/.]+$/, "") + ".pdf",
                        mimeType: "application/pdf",
                        data: ev.target.result.split(',')[1]
                    });
                    reader.readAsDataURL(file);
                });
            }
        } catch (err) {
            Swal.fire('Error', 'Gagal memproses file.', 'error');
            $('#btnSubmitEksternal').prop('disabled', false);
            $('#spinSubmitEksternal').addClass('hide');
            return;
        }
    }

    let id;
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        id = crypto.randomUUID();
    } else {
        id = 'ext_' + new Date().getTime() + Math.random().toString(36).substring(2);
    }

    const data = {
        id: id,
        namaPengirim: $('#extNama').val(),
        emailPengirim: $('#extEmail').val(),
        noHpPengirim: $('#extNoHp').val(),
        lembagaPengirim: $('#extLembaga').val(),
        noSurat: $('#extNoSurat').val(),
        tglSurat: $('#extTglSurat').val(),
        halSurat: $('#extHalSurat').val(),
        tujuanSurat: $('#extTujuanSurat').val(),
        sifatSurat: $('#extSifatSurat').val(),
        keterangan: $('#extKeterangan').val(),
        fileInfoRaw: fileInfoRaw ? JSON.stringify(fileInfoRaw) : null,
        status: 'PENDING',
        waktuInput: new Date().toISOString()
    };

    try {
        const response = await apiCall('insertSuratEksternal', data);
        if (response.status === 'success') {
            generateBuktiKirim(data);
            bootstrap.Modal.getInstance(document.getElementById('modalKirimSurat')).hide();
            Swal.fire('Berhasil', 'Surat Anda telah terkirim. Bukti pengiriman sedang diunduh.', 'success');
        } else {
            Swal.fire('Error', response.message, 'error');
        }
    } catch (err) {
        Swal.fire('Error', 'Koneksi gagal. Pastikan internet Anda stabil: ' + err.message, 'error');
    } finally {
        $('#btnSubmitEksternal').prop('disabled', false);
        $('#spinSubmitEksternal').addClass('hide');
    }
}

function generateBuktiKirim(data) {
    $('#pkId').text(data.id);
    $('#pkWaktu').text(new Date(data.waktuInput).toLocaleString('id-ID'));
    $('#pkNama').text(data.namaPengirim);
    $('#pkLembaga').text(data.lembagaPengirim);
    $('#pkNoSurat').text(data.noSurat);
    $('#pkTglSurat').text(data.tglSurat);
    $('#pkHal').text(data.halSurat);

    const element = document.getElementById('printBuktiKirim');
    element.style.display = 'block';
    const opt = {
        margin: 10,
        filename: 'Bukti_Kirim_Surat_' + data.namaPengirim.replace(/\s+/g, '_') + '.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
        element.style.display = 'none';
    });
}

let cacheInbox = [];

async function loadInboxTable() {
    try {
        const tbody = $('#tbody-inbox-eksternal');

        // Tampilkan indikator loading sementara
        if (!$.fn.DataTable.isDataTable('#tInboxEksternal')) {
            tbody.html('<tr><td colspan="7" class="text-center">Memuat data dari server...</td></tr>');
        }

        const response = await apiCall('getSuratEksternal');
        let inbox = [];
        if (response.status === 'success') {
            inbox = response.data || [];
        } else {
            console.error(response.message);
        }

        cacheInbox = inbox;

        if ($.fn.DataTable.isDataTable('#tInboxEksternal')) {
            $('#tInboxEksternal').DataTable().destroy();
        }
        tbody.empty();

        inbox.sort((a, b) => new Date(b.waktuInput) - new Date(a.waktuInput));

        let no = 1;
        inbox.forEach(item => {
            let statusBadge = '<span class="badge bg-warning text-dark">PENDING</span>';
            if (item.status === 'DITERIMA') statusBadge = '<span class="badge bg-success">DITERIMA</span>';
            if (item.status === 'DITOLAK') statusBadge = '<span class="badge bg-danger">DITOLAK</span>';

            let btnAksi = `<button class="btn btn-sm btn-info text-white me-1" title="Lihat Detail" onclick="lihatEksternal('${item.id}')"><i class="fas fa-eye"></i></button>`;

            tbody.append(`
                <tr>
                    <td class="text-center">${no++}</td>
                    <td>${new Date(item.waktuInput).toLocaleString('id-ID')}</td>
                    <td><b>${item.namaPengirim}</b><br><small class="text-muted">${item.lembagaPengirim}</small></td>
                    <td>${item.noSurat}<br><small class="text-muted">${item.tglSurat}</small></td>
                    <td>${item.halSurat}</td>
                    <td class="text-center">${statusBadge}</td>
                    <td class="text-center">${btnAksi}</td>
                </tr>
            `);
        });

        $('#tInboxEksternal').DataTable({
            "language": { "url": "https://cdn.datatables.net/plug-ins/1.10.25/i18n/Indonesian.json" },
            "pageLength": 10
        });
    } catch (err) {
        console.error(err);
        Swal.fire('Error', 'Gagal memuat surat masuk eksternal', 'error');
    }
}

async function lihatEksternal(id) {
    const item = cacheInbox.find(x => x.id === id);
    if (!item) return;

    $('#vExtNama').text(item.namaPengirim);
    $('#vExtEmail').text(item.emailPengirim);
    $('#vExtNoHp').text(item.noHpPengirim);
    $('#vExtLembaga').text(item.lembagaPengirim);
    $('#vExtNoSurat').text(item.noSurat);
    $('#vExtTglSurat').text(item.tglSurat);
    $('#vExtHalSurat').text(item.halSurat);
    $('#vExtTujuan').text(item.tujuanSurat);
    $('#vExtSifat').text(item.sifatSurat);
    $('#vExtKeterangan').text(item.keterangan || '-');

    const fileContainer = $('#vExtFileContainer');
    fileContainer.empty();

    if (item.fileInfoRaw) {
        let fObj = item.fileInfoRaw;
        if (typeof fObj === 'string') {
            try { fObj = JSON.parse(fObj); } catch (e) { }
        }
        if (fObj && fObj.data) {
            const dataUrl = `data:${fObj.mimeType};base64,${fObj.data}`;
            if (fObj.mimeType.startsWith('image/')) {
                fileContainer.html(`<img src="${dataUrl}" style="max-width:100%; max-height:70vh; object-fit:contain;">`);
            } else {
                fileContainer.html(`<iframe src="${dataUrl}" width="100%" height="600px" style="border:none;"></iframe>`);
            }
        }
    } else if (item.fileUrl && item.fileUrl !== '-' && item.fileUrl.trim() !== '') {
        const pUrl = item.fileUrl.replace('/view', '/preview');
        fileContainer.html(`<iframe src="${pUrl}" width="100%" height="600px" style="border:none;"></iframe>`);
    } else {
        fileContainer.html('<div class="text-muted">Tidak ada lampiran file.</div>');
    }

    if (item.status === 'PENDING') {
        $('#btnTerimaEksternal').show().attr('onclick', `terimaEksternal('${id}')`);
        $('#btnTolakEksternal').show().attr('onclick', `tolakEksternal('${id}')`);
    } else {
        $('#btnTerimaEksternal').hide();
        $('#btnTolakEksternal').hide();
    }

    new bootstrap.Modal(document.getElementById('modalDetailEksternal')).show();
}

async function terimaEksternal(id) {
    const item = cacheInbox.find(x => x.id === id);
    if (!item) return;

    Swal.fire({
        title: 'Menerima Surat...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const response = await apiCall('updateStatusEksternal', { id: id, status: 'DITERIMA' });
        if (response.status === 'success') {
            bootstrap.Modal.getInstance(document.getElementById('modalDetailEksternal')).hide();
            loadInboxTable();

            const currentUser = localStorage.getItem('sidimas_user') || 'Admin';
            const currentRole = localStorage.getItem('sidimas_role') || 'Admin';
            const idBaru = 'ONLINE_' + new Date().getTime();

            const dataObj = {
                jenisForm: 'masuk',
                idSurat: idBaru,
                tglTerima: new Date().toISOString().split('T')[0],
                pengirim: item.lembagaPengirim || item.namaPengirim,
                tglSuratMasuk: item.tglSurat,
                noSuratMasuk: item.noSurat,
                perihalMasuk: item.halSurat,
                ditujukan: item.tujuanSurat,
                uraianMasuk: item.keterangan || '-',
                keteranganMasuk: 'Otomatis dari Surat Eksternal',
                fileLama: item.fileUrl || '-', // pass the uploaded url
                currentUser: currentUser,
                currentRole: currentRole
            };

            // Kita sudah memiliki URL file di item.fileUrl karena ini versi online (di backend sudah ter-upload)
            // Jadi kita tidak perlu mengirim fileInfo lagi
            const resSimpan = await apiCall('simpanData', { data: dataObj, fileInfo: null });

            if (resSimpan.success) {
                Swal.fire('Surat Diterima', 'Surat masuk telah diarsipkan ke dalam sistem secara otomatis.', 'success');
                refreshTable('masuk');
                refreshAllTables();
            } else {
                Swal.fire('Warning', 'Status berhasil diupdate, tetapi gagal menyimpan otomatis ke arsip: ' + resSimpan.message, 'warning');
            }
        } else {
            Swal.fire('Error', response.message, 'error');
        }
    } catch (err) {
        Swal.fire('Error', 'Gagal memproses ke server.', 'error');
    }
}

async function tolakEksternal(id) {
    Swal.fire({
        title: 'Tolak Surat?',
        text: "Anda akan menolak surat ini. Status akan diubah menjadi DITOLAK.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Tolak!'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: 'Menolak Surat...',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });
            try {
                const response = await apiCall('updateStatusEksternal', { id: id, status: 'DITOLAK' });
                if (response.status === 'success') {
                    bootstrap.Modal.getInstance(document.getElementById('modalDetailEksternal')).hide();
                    loadInboxTable();
                    Swal.fire('Ditolak!', 'Surat masuk telah ditolak.', 'success');
                } else {
                    Swal.fire('Error', response.message, 'error');
                }
            } catch (err) {
                Swal.fire('Error', 'Gagal memproses ke server.', 'error');
            }
        }
    });
}


window.promptSaveArsipKeluar = function (dataObj, outBlob, fileName, isOnline) {
    Swal.fire({
        title: 'Dokumen Berhasil Dibuat!',
        text: 'Apakah Anda ingin memasukkan data surat ini ke dalam Arsip Surat Keluar secara otomatis?',
        icon: 'success',
        showCancelButton: true,
        confirmButtonText: 'Ya, Masukkan',
        cancelButtonText: 'Tidak',
        reverseButtons: true
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });

            let fData = null;
            if (outBlob) {
                fData = await new Promise(res => {
                    const r = new FileReader();
                    r.onload = e => res({
                        name: fileName + '.docx',
                        mimeType: outBlob.type,
                        data: e.target.result.split(',')[1]
                    });
                    r.readAsDataURL(outBlob);
                });
            }

            const currentUser = localStorage.getItem('sidimas_user') || 'Admin';
            const idBaru = (isOnline ? 'ONLINE_' : 'LOCAL_') + new Date().getTime();

            let perihalAuto = dataObj.perihal || dataObj.isiUmum || dataObj.acaraDetail || dataObj.namaBarang || dataObj.namaPejabatLama || dataObj.suketHal || dataObj.isiSk || '-';
            let uraianAuto = 'Otomatis digenerate dari form Buat Surat';
            if (dataObj.pilihJenisSurat) {
                let temp = dataObj.pilihJenisSurat.toLowerCase();
                if (temp.includes('sppd') || temp.includes('perjalanan')) uraianAuto = 'Untuk mengikuti: ' + (dataObj.perihal || '-');
                else if (temp.includes('tugas') || temp.includes('spt')) uraianAuto = 'Pelaksanaan tugas: ' + (dataObj.isiUmum || '-');
                else if (temp.includes('undangan')) uraianAuto = 'Undangan: ' + (dataObj.perihal || '-');
                else if (temp.includes('keterangan')) uraianAuto = 'Surat Keterangan: ' + (dataObj.suketHal || dataObj.perihal || '-');
                else if (temp.includes('keputusan') || temp.includes('sk')) uraianAuto = 'Keputusan tentang: ' + (dataObj.isiSk || '-');
            }
            let tujuanAuto = dataObj.tujuanNama || dataObj.tujuanJabatan || dataObj.tujuanTempat || dataObj.namaPihakKedua || 'Kepada Yth.';

            let dataSimpan = {
                jenisForm: 'keluar',
                idSurat: idBaru,
                tglSuratKeluar: dataObj.inpTglSaja || dataObj.tanggalSuratFull || dataObj.tglSuratSaja || dataObj.tglSelesai || new Date().toISOString().split('T')[0],
                kodeKlasifikasi: dataObj.kodeKlasifikasi || '-',
                noSuratKeluar: dataObj.nomorFull || '-',
                perihalKeluar: perihalAuto,
                tujuan: tujuanAuto,
                uraianKeluar: uraianAuto,
                keteranganKeluar: dataObj.pilihJenisSurat || '-',
                fileLama: '-',
                currentUser: currentUser,
                currentRole: localStorage.getItem('sidimas_role') || 'Admin'
            };

            if (isOnline) {
                apiCall('simpanData', { data: dataSimpan, fileInfo: fData })
                    .then(res => {
                        if (res.success) {
                            Swal.fire('Berhasil', 'Disimpan ke Arsip Surat Keluar', 'success');
                            if (typeof refreshAllTables === 'function') refreshAllTables();
                        } else {
                            Swal.fire('Gagal', res.message, 'error');
                        }
                    }).catch(e => Swal.fire('Error', e.toString(), 'error'));
            } else {
                try {
                    let fUrl = "-";
                    if (fData) fUrl = "data:" + fData.mimeType + ";base64," + fData.data;
                    const record = {
                        id: idBaru,
                        waktuInput: new Date().toISOString(),
                        pembuat: currentUser,
                        sync_status: 'pending',
                        fileUrl: fUrl,
                        fileInfoRaw: fData ? JSON.stringify(fData) : null,
                        tglSurat: dataSimpan.tglSuratKeluar,
                        klasifikasi: dataSimpan.kodeKlasifikasi,
                        noSurat: dataSimpan.noSuratKeluar,
                        perihal: dataSimpan.perihalKeluar,
                        tujuan: dataSimpan.tujuan,
                        uraian: dataSimpan.uraianKeluar,
                        keterangan: dataSimpan.keteranganKeluar
                    };
                    await localDB.suratKeluar.put(record);
                    await localDB.antrianSync.add({
                        action: 'simpanData',
                        payload: JSON.stringify({ data: dataSimpan, fileInfo: fData }),
                        status: 'pending'
                    });
                    Swal.fire('Berhasil', 'Disimpan ke Arsip Surat Keluar Lokal', 'success');
                    if (typeof loadAgendaSurat === 'function') loadAgendaSurat();
                } catch (e) {
                    Swal.fire('Error', e.toString(), 'error');
                }
            }
        }
    });
}


window.scanImageAndAutofill = async function (fileInputId, formType) {
    const fileInput = document.getElementById(fileInputId);
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        Swal.fire('Info', 'Pilih file gambar surat terlebih dahulu pada form upload!', 'info');
        return;
    }
    const file = fileInput.files[0];
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
        Swal.fire('Info', 'Saat ini Auto-Isi (OCR) hanya mendukung file gambar (JPG/JPEG/PNG).', 'warning');
        return;
    }

    if (typeof Tesseract === 'undefined') {
        Swal.fire('Error', 'Library OCR belum termuat. Pastikan koneksi internet aktif.', 'error');
        return;
    }

    Swal.fire({
        title: 'Membaca Dokumen...',
        html: 'AI sedang memproses teks pada gambar. Proses ini memakan waktu beberapa detik...',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        const result = await Tesseract.recognize(file, 'ind', {
            logger: m => {
                if (m.status === 'recognizing text') {
                    // Update progress if possible
                }
            }
        });

        const text = result.data.text;
        console.log("=== HASIL OCR ===");
        console.log(text);

        let nomor = "";
        let tanggal = "";
        let perihal = "";
        let pengirimAtauTujuan = "";

        // 1. Cari Nomor
        const noMatch = text.match(/(?:nomor|no)\s*[:\.;]?\s*([^\n]+)/i);
        if (noMatch) nomor = noMatch[1].trim();

        // 2. Cari Perihal/Hal
        const halMatch = text.match(/(?:perihal|hal)\s*[:\.;]?\s*([^\n]+)/i);
        if (halMatch) perihal = halMatch[1].trim();

        // 3. Cari Tanggal (Pola: dd Bulan yyyy)
        const tglMatch = text.match(/\b(\d{1,2}\s+(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|mei|jun|jul|agu|sep|okt|nov|des)\s+\d{4})\b/i);
        if (tglMatch) {
            const months = {
                'januari': '01', 'jan': '01',
                'februari': '02', 'feb': '02',
                'maret': '03', 'mar': '03',
                'april': '04', 'apr': '04',
                'mei': '05',
                'juni': '06', 'jun': '06',
                'juli': '07', 'jul': '07',
                'agustus': '08', 'agu': '08',
                'september': '09', 'sep': '09',
                'oktober': '10', 'okt': '10',
                'november': '11', 'nov': '11',
                'desember': '12', 'des': '12'
            };
            let parts = tglMatch[1].toLowerCase().replace(/\s+/g, ' ').split(' ');
            if (parts.length === 3) {
                let d = parts[0].padStart(2, '0');
                let m = months[parts[1]] || '01';
                let y = parts[2];
                tanggal = `${y}-${m}-${d}`;
            }
        }

        // 4. Cari Instansi Pengirim (Baris paling atas sebelum kata-kata spesifik)
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3);
        if (lines.length > 0) {
            // Biasanya baris pertama/kedua adalah nama instansi/pemerintah daerah
            pengirimAtauTujuan = lines[0];
            if (lines.length > 1 && lines[0].toLowerCase().includes("pemerintah")) {
                pengirimAtauTujuan = lines[0] + " " + lines[1];
            }
        }

        // Isi form
        if (formType === 'masuk') {
            if (nomor) document.getElementById('inNoSuratM').value = nomor;
            if (perihal) document.getElementById('inPerihalM').value = perihal;
            if (tanggal) document.getElementById('inTglSuratM').value = tanggal;
            if (pengirimAtauTujuan && document.getElementById('inPengirim')) {
                document.getElementById('inPengirim').value = pengirimAtauTujuan;
            }
        } else {
            if (nomor) document.getElementById('inNoSuratK').value = nomor;
            if (perihal) document.getElementById('inPerihalK').value = perihal;
            if (tanggal) document.getElementById('inTglSuratK').value = tanggal;
            if (pengirimAtauTujuan && document.getElementById('inTujuanK')) {
                document.getElementById('inTujuanK').value = pengirimAtauTujuan;
            }
        }

        Swal.fire({
            title: 'Selesai!',
            text: 'Beberapa kolom telah terisi otomatis. Harap PERIKSA KEMBALI apakah teks hasil deteksi sudah benar dan tidak ada salah ejaan (typo).',
            icon: 'success'
        });

    } catch (error) {
        console.error(error);
        Swal.fire('Error', 'Gagal memproses gambar. Detail: ' + error.message, 'error');
    }
};


if (document.getElementById('appVersionText')) { document.getElementById('appVersionText').innerText = APP_CONFIG.APP_VERSION || ''; }

function toggleModeSpt() {
    let mode = $('input[name="modeSpt"]:checked').val();
    $('#sptAreaSendirian, #sptAreaKolektif, #sptAreaLampiran').addClass('hide');
    if (mode === 'sendirian') $('#sptAreaSendirian').removeClass('hide');
    else if (mode === 'kolektif') $('#sptAreaKolektif').removeClass('hide');
    else if (mode === 'lampiran') $('#sptAreaLampiran').removeClass('hide');
}

function toggleModeSuket() {
    let mode = $('input[name="modeSuket"]:checked').val();
    $('#suketAreaSendirian, #suketAreaKolektif, #suketAreaLampiran').addClass('hide');
    if (mode === 'sendirian') $('#suketAreaSendirian').removeClass('hide');
    else if (mode === 'kolektif') $('#suketAreaKolektif').removeClass('hide');
    else if (mode === 'lampiran') $('#suketAreaLampiran').removeClass('hide');
}

function toggleModeSis() {
    let mode = $('input[name="modeSis"]:checked').val();
    $('#sisAreaSendirian, #sisAreaKolektif, #sisAreaLampiran').addClass('hide');
    if (mode === 'sendirian') $('#sisAreaSendirian').removeClass('hide');
    else if (mode === 'kolektif') $('#sisAreaKolektif').removeClass('hide');
    else if (mode === 'lampiran') $('#sisAreaLampiran').removeClass('hide');
}

function addRowKolektif(tableId) {
    let tID = tableId.replace('tbl', '').replace('Kolektif', '');
    let tr = `<tr>
        <td><input type="text" class="form-control form-control-sm" name="kol${tID}Nama[]"></td>
        <td><input type="text" class="form-control form-control-sm" name="kol${tID}Nip[]"></td>
        <td><input type="text" class="form-control form-control-sm" name="kol${tID}Pangkat[]"></td>
        <td><input type="text" class="form-control form-control-sm" name="kol${tID}Jabatan[]"></td><td><input type="text" class="form-control form-control-sm" name="kol${tID}Ket[]"></td><td><button type="button" class="btn btn-sm btn-danger" onclick="this.closest('tr').remove()"><i class="fas fa-times"></i></button></td>
    </tr>`;
    $(`#${tableId} tbody`).append(tr);
}

function addRowKolektifSis(tableId) {
    let tr = `<tr>
        <td><input type="text" class="form-control form-control-sm" name="kolSisNama[]"></td>
        <td><input type="text" class="form-control form-control-sm" name="kolSisNis[]"></td>
        <td><input type="text" class="form-control form-control-sm" name="kolSisTtl[]"></td>
        <td><select class="form-select form-select-sm" name="kolSisJk[]"><option>Laki-laki</option><option>Perempuan</option></select></td>
        <td><input type="text" class="form-control form-control-sm" name="kolSisKelas[]"></td>
        <td><input type="text" class="form-control form-control-sm" name="kolSisOrtu[]"></td><td><input type="text" class="form-control form-control-sm" name="kolSisKet[]"></td><td><button type="button" class="btn btn-sm btn-danger" onclick="this.closest('tr').remove()"><i class="fas fa-times"></i></button></td>
    </tr>`;
    $(`#${tableId} tbody`).append(tr);
}

function toggleAtasNama() {
    if ($('#switchAtasNama').is(':checked')) {
        $('#boxAtasNama').removeClass('hide');
    } else {
        $('#boxAtasNama').addClass('hide');
    }
}

// Sembunyikan tombol Sinkronisasi di versi Online
$(document).ready(function () {
    $('#btnSyncMain').hide().addClass('hide d-none');
});

$(document).ready(function () {
    // Perbaikan DataTables yang menciut/tidak rapi saat berada di dalam Bootstrap Tabs
    $('button[data-bs-toggle="tab"]').on('shown.bs.tab', function (e) {
        $.fn.dataTable.tables({ visible: true, api: true }).columns.adjust();
    });
});
