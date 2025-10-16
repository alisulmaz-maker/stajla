// ===================================================================================
//                                  STAJLA - main.js (NİHAİ KARARLI VERSİYON)
// ===================================================================================

let currentUser = null; // Giriş yapan kullanıcının bilgilerini burada saklayacağız

/* --- Güvenlik için Yardımcı Fonksiyon --- */
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;', '/': '&#47;', '=': '&#61;' };
    return text.replace(/[&<>"'`=/]/g, s => map[s]);
}

/* --- Arayüz Güncelleme Fonksiyonları --- */
async function renderResultsOnHome() {
    const container = document.getElementById('results-container');
    if (!container) return;
    container.innerHTML = 'Yükleniyor...';
    try {
        const response = await fetch('/api/ogrenci-ilanlari');
        const ilanlar = await response.json();
        container.innerHTML = '';
        if (!ilanlar || ilanlar.length === 0) {
            container.innerHTML = '<p>Henüz eklenmiş bir öğrenci ilanı yok.</p>';
            return;
        }
        ilanlar.forEach(s => {
            const el = document.createElement('div');
            el.className = 'card';
            el.innerHTML = `<h4>${escapeHtml(s.name)}</h4><p><strong>${escapeHtml(s.area)}</strong> — ${escapeHtml(s.city)}</p><p>${escapeHtml(s.dept||'')}</p><p>${escapeHtml(s.desc)}</p>${s.cvPath ? `<p><a href="${s.cvPath.replace(/\\/g, '/')}" target="_blank" class="cv-link">CV Görüntüle</a></p>` : ''}<p>İletişim: <strong>${escapeHtml(s.contact)}</strong></p><a href="#" class="report-link" data-id="${s._id}" data-type="student">Bu ilanı şikayet et</a>`;
            container.appendChild(el);
        });
    } catch (err) { console.error('Sonuçlar yüklenirken hata:', err); container.innerHTML = '<p>İlanlar yüklenirken bir sorun oluştu.</p>'; }
}

async function fetchMyListings() {
    const studentContainer = document.getElementById('my-student-listings');
    const employerContainer = document.getElementById('my-employer-listings');
    if (!studentContainer || !employerContainer) return;

    const handleContainerClick = async (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const id = e.target.dataset.id;
            const type = e.target.dataset.type;
            if (confirm('Bu ilanı kalıcı olarak silmek istediğinize emin misiniz?')) {
                try {
                    const response = await fetch('/api/delete-listing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, type }) });
                    const result = await response.json();
                    alert(result.message);
                    if (result.success) { e.target.closest('.card').remove(); }
                } catch (err) { alert('İlan silinirken bir hata oluştu.'); }
            }
        }
    };
    studentContainer.addEventListener('click', handleContainerClick);
    employerContainer.addEventListener('click', handleContainerClick);

    studentContainer.innerHTML = "Yükleniyor...";
    employerContainer.innerHTML = "Yükleniyor...";
    try {
        const response = await fetch('/api/my-listings');
        if (!response.ok) throw new Error('Giriş yapmamış olabilirsiniz.');
        const data = await response.json();
        studentContainer.innerHTML = '';
        if (data.student.length > 0) {
            data.student.forEach(s => {
                const el = document.createElement('div');
                el.className = 'card';
                el.innerHTML = `<div class="card-content"><h4>${escapeHtml(s.name)}</h4><p>${escapeHtml(s.area)}</p></div><div class="card-actions"><a href="/edit-listing.html?type=student&id=${s._id}" class="edit-btn">Düzenle</a><button class="delete-btn" data-id="${s._id}" data-type="student">Sil</button></div>`;
                studentContainer.appendChild(el);
            });
        } else { studentContainer.innerHTML = '<p>Henüz oluşturduğunuz bir stajyer ilanı yok.</p>'; }
        employerContainer.innerHTML = '';
        if (data.employer.length > 0) {
            data.employer.forEach(j => {
                const el = document.createElement('div');
                el.className = 'card';
                el.innerHTML = `<div class="card-content"><h4>${escapeHtml(j.company)}</h4><p>${escapeHtml(j.area)}</p></div><div class="card-actions"><a href="/edit-listing.html?type=employer&id=${j._id}" class="edit-btn">Düzenle</a><button class="delete-btn" data-id="${j._id}" data-type="employer">Sil</button></div>`;
                employerContainer.appendChild(el);
            });
        } else { employerContainer.innerHTML = '<p>Henüz oluşturduğunuz bir işveren ilanı yok.</p>'; }
    } catch (err) { const errorMessage = '<p>İlanlarınızı görmek için giriş yapmalısınız.</p>'; studentContainer.innerHTML = errorMessage; employerContainer.innerHTML = errorMessage; }
}

function updateUIAfterLogin() {
    if (!currentUser) return;
    const studentLinks = document.querySelectorAll('a[href="/ogrenci-ilan.html"]');
    const employerLinks = document.querySelectorAll('a[href="/isveren-ilan.html"]');
    if (currentUser.role === 'student') {
        employerLinks.forEach(link => link.style.display = 'none');
    } else if (currentUser.role === 'employer') {
        studentLinks.forEach(link => link.style.display = 'none');
    }
}

/* --- Form Gönderme İşlemleri --- */
const studentForm = document.getElementById('student-form');
if (studentForm) {
    studentForm.addEventListener('submit', async function(e) { e.preventDefault(); const formData = new FormData(); formData.append('name', document.getElementById('s-name').value.trim()); formData.append('dept', document.getElementById('s-dept').value.trim()); formData.append('city', document.getElementById('s-city').value); formData.append('area', document.getElementById('s-area').value); formData.append('desc', document.getElementById('s-desc').value.trim()); formData.append('contact', document.getElementById('s-contact').value.trim()); const cvFile = document.getElementById('s-cv').files[0]; if (cvFile) { formData.append('cv', cvFile); } try { const response = await fetch('/api/ogrenci-ilan', { method: 'POST', body: formData }); const result = await response.json(); alert(result.message); if (result.success) studentForm.reset(); } catch (err) { alert('Sunucuya bağlanırken bir hata oluştu.'); } });
}
const jobForm = document.getElementById('job-form');
if (jobForm) {
    jobForm.addEventListener('submit', async function(e){ e.preventDefault(); const j = { company: document.getElementById('j-company').value.trim(), sector: document.getElementById('j-sector').value.trim(), city: document.getElementById('j-city').value, area: document.getElementById('j-area').value, req: document.getElementById('j-req').value.trim(), contact: document.getElementById('j-contact').value.trim() }; try { const response = await fetch('/api/isveren-ilan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(j) }); const result = await response.json(); alert(result.message); if (result.success) jobForm.reset(); } catch (err) { alert('Sunucuya bağlanırken bir hata oluştu.'); } });
}

/* --- Kullanıcı Kayıt ve Giriş İşlemleri --- */
const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async function(e) { e.preventDefault(); const userData = { name: document.getElementById('reg-name').value, email: document.getElementById('reg-email').value, pass: document.getElementById('reg-pass').value, role: document.getElementById('reg-role').value }; try { const response = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(userData) }); const result = await response.json(); alert(result.message); if (result.success) { window.location.href = '/giris.html'; } } catch (err) { alert('Sunucuya bağlanırken bir hata oluştu.'); } });
}
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const loginData = {
            email: document.getElementById('login-email').value,
            pass: document.getElementById('login-pass').value,
            remember: document.getElementById('login-remember').checked
        };
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loginData)
                credentials: 'include'
            });
            const result = await response.json();
            if (result.success) {
                window.location.href = '/index.html';
            } else {
                alert(result.message);
            }
        } catch (err) {
            alert('Sunucuya bağlanırken bir hata oluştu.');
        }
    });
}

/* --- Şifre Sıfırlama İşlemleri --- */
const forgotPasswordForm = document.getElementById('forgot-password-form');
if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async function(e) { e.preventDefault(); const email = document.getElementById('forgot-email').value; const button = this.querySelector('button'); button.textContent = 'Gönderiliyor...'; try { const response = await fetch('/api/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }); const result = await response.json(); alert(result.message); button.textContent = 'Sıfırlama Linki Gönder'; } catch (err) { alert('Bir hata oluştu. Lütfen tekrar deneyin.'); button.textContent = 'Sıfırlama Linki Gönder'; } });
}
if (window.location.pathname.endsWith('/reset-password.html')) {
    const resetPasswordForm = document.getElementById('reset-password-form');
    resetPasswordForm.addEventListener('submit', async function(e) { e.preventDefault(); const pass1 = document.getElementById('reset-pass1').value; const pass2 = document.getElementById('reset-pass2').value; if (pass1 !== pass2) { alert('Girdiğiniz şifreler uyuşmuyor.'); return; } const params = new URLSearchParams(window.location.search); const token = params.get('token'); try { const response = await fetch('/api/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token, newPassword: pass1 }) }); const result = await response.json(); alert(result.message); if (result.success) { window.location.href = '/giris.html'; } } catch (err) { alert('Bir hata oluştu.'); } });
}

/* --- İlan Düzenleme Sayfası İşlemleri --- */
if (window.location.pathname.endsWith('/edit-listing.html')) {
    const params = new URLSearchParams(window.location.search);
    const listingId = params.get('id');
    const listingType = params.get('type');
    const studentFormEdit = document.getElementById('student-form-edit');
    const jobFormEdit = document.getElementById('job-form-edit');
    if (studentFormEdit && jobFormEdit) {
        async function loadListingData() { try { const response = await fetch(`/api/listing/${listingId}?type=${listingType}`); const data = await response.json(); if (listingType === 'student') { studentFormEdit.style.display = 'block'; document.getElementById('s-name').value = data.name; document.getElementById('s-dept').value = data.dept; document.getElementById('s-desc').value = data.desc; document.getElementById('s-contact').value = data.contact; } else { jobFormEdit.style.display = 'block'; document.getElementById('j-company').value = data.company; document.getElementById('j-sector').value = data.sector; document.getElementById('j-req').value = data.req; document.getElementById('j-contact').value = data.contact; } } catch (err) { alert('İlan bilgileri yüklenemedi.'); } }
        loadListingData();
        studentFormEdit.addEventListener('submit', async (e) => { e.preventDefault(); const updatedData = { name: document.getElementById('s-name').value, dept: document.getElementById('s-dept').value, desc: document.getElementById('s-desc').value, contact: document.getElementById('s-contact').value, }; await saveChanges(listingId, listingType, updatedData); });
        jobFormEdit.addEventListener('submit', async (e) => { e.preventDefault(); const updatedData = { company: document.getElementById('j-company').value, sector: document.getElementById('j-sector').value, req: document.getElementById('j-req').value, contact: document.getElementById('j-contact').value, }; await saveChanges(listingId, listingType, updatedData); });
        async function saveChanges(id, type, data) { try { const response = await fetch('/api/update-listing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, type, data }) }); const result = await response.json(); alert(result.message); if (result.success) { window.location.href = '/profil.html'; } } catch (err) { alert('Güncelleme sırasında bir hata oluştu.'); } }
    }
}

/* --- Oturum, Bildirim ve Sayfa Yükleme İşlemleri --- */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/current-user');
        currentUser = await response.json();
        const userNav = document.getElementById('user-nav');
        if (currentUser && userNav) {
            const userInitial = currentUser.name.charAt(0).toUpperCase();
            userNav.innerHTML = `<div class="profile-dropdown"><div class="profile-avatar">${userInitial}</div><div class="dropdown-content"><a href="/profil.html">Profilim</a><a id="logout-btn" href="#">Çıkış Yap</a></div></div>`;
            document.getElementById('logout-btn').addEventListener('click', async (e) => { e.preventDefault(); await fetch('/api/logout'); window.location.href = '/index.html'; });
        }
        updateUIAfterLogin();
        if (currentUser && currentUser.role === 'employer') {
            await setupNotifications();
        }
    } catch (err) { console.error('Kullanıcı durumu kontrol edilirken hata:', err); }
    if (document.getElementById('results-container')) { renderResultsOnHome(); }
    if (window.location.pathname.endsWith('/profil.html')) { fetchMyListings(); }
});

/* --- Arama, Şikayet ve Başvuru İşlemleri --- */
document.body.addEventListener('click', async function(e) {
    if (e.target.id === 'search-btn') {
        const searchType = document.getElementById('search-type').value;
        const searchArea = document.getElementById('search-area').value;
        const searchCity = document.getElementById('search-city').value;
        const query = `?type=${searchType}&area=${searchArea}&city=${searchCity}`;
        const container = document.getElementById('results-container');
        container.innerHTML = 'Aranıyor...';
        try {
            const response = await fetch(`/api/search${query}`);
            const results = await response.json();
            container.innerHTML = '';
            if (results.length === 0) { container.innerHTML = '<p>Aradığınız kriterlere uygun bir sonuç bulunamadı.</p>'; return; }
            if (searchType === 'students') {
                results.forEach(s => { const el = document.createElement('div'); el.className = 'card'; el.innerHTML = `<h4>${escapeHtml(s.name)}</h4><p><strong>${escapeHtml(s.area)}</strong> — ${escapeHtml(s.city)}</p><p>${escapeHtml(s.dept || '')}</p><p>${escapeHtml(s.desc)}</p>${s.cvPath ? `<p><a href="${s.cvPath.replace(/\\/g, '/')}" target="_blank" class="cv-link">CV Görüntüle</a></p>` : ''}<p>İletişim: <strong>${escapeHtml(s.contact)}</strong></p><a href="#" class="report-link" data-id="${s._id}" data-type="student">Bu ilanı şikayet et</a>`; container.appendChild(el); });
            } else { // jobs
                results.forEach(j => { const el = document.createElement('div'); el.className = 'card'; const applyButtonHTML = (currentUser && currentUser.role === 'student') ? `<div class="card-actions"><button class="apply-btn" data-id="${j._id}">Başvur</button></div>` : ''; el.innerHTML = `<div class="card-content"><h4>${escapeHtml(j.company)}</h4><p><strong>${escapeHtml(j.area)}</strong> — ${escapeHtml(j.city)}</p><p>${escapeHtml(j.sector)}</p><p>${escapeHtml(j.req)}</p><p>İletişim: <strong>${escapeHtml(j.contact)}</strong></p><a href="#" class="report-link" data-id="${j._id}" data-type="employer">Bu ilanı şikayet et</a></div>${applyButtonHTML}`; container.appendChild(el); });
            }
        } catch (err) { console.error('Arama sırasında hata:', err); container.innerHTML = '<p>Arama sırasında bir sorun oluştu.</p>'; }
    }
    if (e.target.classList.contains('report-link')) {
        e.preventDefault();
        const id = e.target.dataset.id;
        const type = e.target.dataset.type;
        if (confirm('Bu ilanı uygunsuz içerik olarak bildirmek istediğinizden emin misiniz?')) {
            try {
                const response = await fetch('/api/report-listing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, type }) });
                const result = await response.json();
                alert(result.message);
                if (result.success) { e.target.style.display = 'none'; }
            } catch (err) { alert('Bir hata oluştu. Lütfen giriş yaptığınızdan emin olun.'); }
        }
    }
    /* --- Başvuru İşlemleri --- */
    const resultsContainer = document.getElementById('results-container');
    if (resultsContainer) {
        resultsContainer.addEventListener('click', async (e) => {
            if (e.target.classList.contains('apply-btn')) {
                const listingId = e.target.dataset.id;

                // Önce öğrencinin kendi ilanını bulalım
                const studentListingResponse = await fetch('/api/my-student-listing');
                const studentListing = await studentListingResponse.json();

                if (!studentListing) {
                    alert('Başvuru yapabilmek için önce bir "Staj Arıyorum" ilanı oluşturmalısınız.');
                    return;
                }

                try {
                    const response = await fetch('/api/apply', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        // Sunucuya hem işveren ilanının ID'sini hem de kendi ilanımızın ID'sini gönderiyoruz
                        body: JSON.stringify({ listingId: listingId, studentListingId: studentListing._id })
                    });
                    const result = await response.json();
                    alert(result.message);
                } catch (err) {
                    alert('Bir hata oluştu. Lütfen tekrar deneyin.');
                }
            }
        });
    }

/* --- Hamburger Menü İşlevselliği --- */
const hamburger = document.getElementById('hamburger-menu');
const mobileNav = document.getElementById('mobile-nav');
if (hamburger && mobileNav) {
    hamburger.addEventListener('click', () => {
        mobileNav.classList.toggle('active');
    });
}

/* --- Bildirim Sistemi İşlemleri --- */
async function setupNotifications() {
    const userNav = document.getElementById('user-nav');
    if (!userNav) return;
    const notificationHTML = `<div class="notifications"><div class="notification-bell">🔔</div><div class="notification-count" style="display: none;">0</div><div class="notification-dropdown"></div></div>`;
    userNav.insertAdjacentHTML('beforebegin', notificationHTML);
    const bell = document.querySelector('.notification-bell');
    const countBadge = document.querySelector('.notification-count');
    const dropdown = document.querySelector('.notification-dropdown');
    const response = await fetch('/api/notifications');
    const notifications = await response.json();
    if (notifications.length > 0) {
        countBadge.textContent = notifications.length;
        countBadge.style.display = 'flex';
        notifications.forEach(notif => {
            const applicantName = notif.applicantInfo[0]?.name || 'Bilinmeyen Aday';
            // Artık öğrencinin alanını da alabiliyoruz!
            const studentArea = notif.studentListingInfo[0]?.area || 'Bölüm belirtilmemiş';

            const item = document.createElement('div');
            item.className = 'notification-item';
            // Bildirim metnini daha detaylı hale getirdik
            item.innerHTML = `<p><strong>${escapeHtml(applicantName)}</strong> (${escapeHtml(studentArea)}) ilanınıza başvurdu.</p>`;
            dropdown.appendChild(item);
        });
    } else {
        dropdown.innerHTML = '<div class="notification-item"><p>Yeni bildirim yok.</p></div>';
    }
    bell.addEventListener('click', () => {
        bell.parentElement.classList.toggle('active');
    });
}