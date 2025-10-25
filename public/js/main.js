// ===================================================================================
//                                  STAJLA - main.js (NİHAİ MÜKEMMEL VE HATASIZ VERSİYON)
// ===================================================================================

let currentUser = null;

/* --- Güvenlik için Yardımcı Fonksiyon --- */
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;', '/': '&#47;', '=': '&#61;' };
    return text.replace(/[&<>"'`=/]/g, s => map[s]);
}

/* --- Arayüz Güncelleme Fonksiyonları --- */
async function renderResultsOnHome() {
    const container = document.getElementById('results-container');
    const noResultsPlaceholder = document.getElementById('no-results-placeholder');

    if (!container || !noResultsPlaceholder) return;

    container.innerHTML = 'Yükleniyor...';
    noResultsPlaceholder.style.display = 'none';

    try {
        const response = await fetch('/api/ogrenci-ilanlari');
        const ilanlar = await response.json();
        container.innerHTML = '';

        if (!ilanlar || ilanlar.length === 0) {
            noResultsPlaceholder.style.display = 'block';
        } else {
            ilanlar.forEach(s => {
                const el = document.createElement('div');
                el.className = 'card';

                const profilePicHtml = s.sahipInfo && s.sahipInfo.profilePicturePath
                    ? `<div class="card-profile-pic" style="background-image: url('${s.sahipInfo.profilePicturePath}')"></div>`
                    : '<div class="card-profile-pic-placeholder"></div>';

                el.innerHTML = `
                    <div class="card-content">
                        <a href="/ogrenci-profil.html?id=${s._id}" class="card-link-wrapper">
                            <div class="card-header">
                                ${profilePicHtml}
                                <div class="card-info">
                                    <h4>${escapeHtml(s.name)}</h4>
                                    <p><strong>${escapeHtml(s.area)}</strong> — ${escapeHtml(s.city)}</p>
                                </div>
                            </div>
                        </a>
                        <div class="card-body">
                            <p style="margin-top: 0;">Üniversite: <strong>${escapeHtml(s.dept || 'Belirtilmemiş')}</strong></p>
                            <p>İletişim: <strong>${escapeHtml(s.contact)}</strong></p>
                            ${s.cvPath ? `<p><a href="${s.cvPath}" target="_blank" class="cv-link">CV Görüntüle</a></p>` : ''}
                            
                            <div style="margin-top: 10px; border-top: 1px solid #eee; padding-top: 5px;">
                                <a href="#" class="report-link" data-id="${s._id}" data-type="student">Bu ilanı şikayet et</a>
                            </div>
                        </div>
                    </div>
                `;
                container.appendChild(el);
            });
        }
    } catch (err) {
        console.error('Sonuçlar yüklenirken hata:', err);
        container.innerHTML = '<p>İlanlar yüklenirken bir sorun oluştu.</p>';
    }
}

async function setupNotifications() {
    if (!currentUser || currentUser.role !== 'employer') return;

    const navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;

    // Bildirim HTML'ini (Çan, Sayı) navigasyona ekleme
    const notificationHtml = `
        <div class="notifications">
            <span class="notification-bell">🔔</span>
            <span class="notification-count" id="notification-count" style="display: none;">0</span>
            <div class="notification-dropdown" id="notification-dropdown">
                <div id="notification-list"></div>
                <div class="notification-footer">
                    <button id="clear-notifications-btn" style="width: 100%; padding: 10px; background: #dc3545; color: white; border: none; cursor: pointer; border-radius: 4px;">Tümünü Temizle</button>
                </div>
            </div>
        </div>`;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = notificationHtml;
    // user-nav'dan önce eklenir
    navLinks.insertBefore(tempDiv.firstChild, document.getElementById('user-nav'));

    const countElement = document.getElementById('notification-count');
    const dropdownElement = document.getElementById('notification-dropdown');
    const listElement = document.getElementById('notification-list');
    const bellElement = document.querySelector('.notification-bell');
    const clearBtn = document.getElementById('clear-notifications-btn');

    // Dropdown açma/kapama
    bellElement.addEventListener('click', () => {
        dropdownElement.style.display = dropdownElement.style.display === 'block' ? 'none' : 'block';
    });
    // Herhangi bir yere tıklandığında dropdown'ı kapat
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.notifications') && dropdownElement) {
            dropdownElement.style.display = 'none';
        }
    });

    // Bildirimleri Çekme
    const fetchNotifications = async () => {
        try {
            const response = await fetch('/api/notifications');
            const notifications = await response.json();

            if (notifications.length > 0) {
                countElement.textContent = notifications.length;
                countElement.style.display = 'flex';
                listElement.innerHTML = '';

                notifications.forEach(n => {
                    const student = n.applicantInfo[0];
                    const studentListing = n.studentListingInfo[0];
                    const item = document.createElement('div');
                    item.className = 'notification-item';
                    item.innerHTML = `
                        <p style="margin: 0; font-weight: bold;">
                            ${escapeHtml(student.name)} yeni bir ilana başvurdu!
                        </p>
                        <p style="margin: 5px 0 0; font-size: 0.85rem;">
                            İlan: ${escapeHtml(studentListing.area)} - ${escapeHtml(studentListing.city)}
                        </p>
                        <a href="/ogrenci-profil.html?id=${studentListing._id}" style="color: #FFD43B; text-decoration: underline; font-size: 0.85rem;">Profili Gör</a>
                    `;
                    listElement.appendChild(item);
                });
            } else {
                countElement.style.display = 'none';
                listElement.innerHTML = '<div class="notification-item">Yeni başvurunuz yok.</div>';
            }
        } catch (err) {
            console.error('Bildirimler yüklenirken hata:', err);
            countElement.style.display = 'none';
            listElement.innerHTML = '<div class="notification-item">Bildirim yüklenemedi.</div>';
        }
    };
    clearBtn.addEventListener('click', async () => {
        if (confirm('Tüm bildirimleri temizlemek istediğinize emin misiniz?')) {
            try {
                const response = await fetch('/api/clear-notifications', { method: 'POST' });
                const result = await response.json();
                if (result.success) {
                    alert('Bildirimler temizlendi.');
                    fetchNotifications();
                }
            } catch (err) {
                alert('Bildirimler temizlenirken hata oluştu.');
            }
        }
    });

    fetchNotifications();
}

async function loadStudentProfileData() {
    const container = document.getElementById('student-profile-container');
    const params = new URLSearchParams(window.location.search);
    const listingId = params.get('id');

    if (!listingId) {
        container.innerHTML = '<h2>Geçersiz veya eksik profil ID\'si.</h2>';
        return;
    }

    try {
        const response = await fetch(`/api/student-profile/${listingId}`);
        if (!response.ok) {
            throw new Error('Profil bulunamadı veya bir sunucu hatası oluştu.');
        }
        const { profileInfo: s } = await response.json();

        const canOffer = currentUser && currentUser.role === 'employer';
        const offerBtnHtml = canOffer
            ? `<button id="offer-job-btn" class="cta-primary" style="width: 100%; padding: 15px; font-size: 1.1rem; margin-top: 15px; background-color: #FFD43B; color: #222; border: none; font-weight: bold; cursor: pointer;">Bu Adaya İş Teklif Et</button>`
            : '';

        const profilePicHtml = s.profilePicturePath
            ? `<div class="profile-pic-large" style="background-image: url('${s.profilePicturePath}')"></div>`
            : '<div class="profile-pic-placeholder-large"></div>';

        container.innerHTML = `
            <div class="card" style="text-align: center;">
                ${profilePicHtml}
                <h2 style="margin-bottom: 20px;">${escapeHtml(s.name)}</h2>
                <p style="text-align: left;"><strong>Bölüm:</strong> ${escapeHtml(s.dept || 'Belirtilmemiş')}</p>
                <p style="text-align: left;"><strong>Şehir:</strong> ${escapeHtml(s.city)}</p>
                <p style="text-align: left;"><strong>İlgilendiği Alan:</strong> ${escapeHtml(s.area)}</p>
                <hr style="margin: 15px 0;">
                <p style="text-align: left;">${escapeHtml(s.desc || 'Kısa tanıtım metni bulunmamaktadır.')}</p>
                <hr style="margin: 15px 0;">
                <p style="text-align: left;"><strong>İletişim Bilgisi:</strong> ${escapeHtml(s.contact)}</p>
                ${s.cvPath ? `<p style="margin-top: 20px;"><a href="${s.cvPath}" target="_blank" class="cv-link" style="font-weight: bold; background-color: #FFD43B; padding: 10px 15px; border-radius: 5px; color: #222; display: inline-block;">CV Görüntüle</a></p>` : ''}
                ${offerBtnHtml}
            </div>
        `;
        // Modal ve buton mantığı (ogrenci-profil.html'deki modal HTML'e bağlıdır)
        if (canOffer) {
            const offerBtn = document.getElementById('offer-job-btn');
            const modal = document.getElementById('offer-modal');
            const closeModalBtn = document.querySelector('.close-modal');
            const listingsContainer = document.getElementById('employer-listings-container');
            const studentId = listingId;

            offerBtn.addEventListener('click', async () => {
                listingsContainer.innerHTML = '<i>İlanlarınız yükleniyor...</i>';

                const response = await fetch('/api/my-listings');
                const data = await response.json();

                if (data.employer && data.employer.length > 0) {
                    listingsContainer.innerHTML = '';
                    data.employer.forEach(listing => {
                        const listingEl = document.createElement('div');
                        listingEl.className = 'listing-offer-item';
                        listingEl.innerHTML = `<span>${escapeHtml(listing.company)} - ${escapeHtml(listing.area)}</span><button class="cta-primary" data-listing-id="${listing._id}" style="padding: 8px 15px; font-weight: bold;">Teklif Gönder</button>`;
                        listingsContainer.appendChild(listingEl);
                    });
                } else {
                    listingsContainer.innerHTML = '<p>Bu adaya teklif gönderebileceğiniz aktif bir iş ilanınız bulunmuyor. Lütfen önce bir ilan oluşturun.</p>';
                }
                modal.style.display = 'flex';
            });

            closeModalBtn.addEventListener('click', () => { modal.style.display = 'none'; });
            modal.addEventListener('click', (e) => { if (e.target === modal) { modal.style.display = 'none'; } });

            // Teklif Gönderimini Başlatma
            listingsContainer.addEventListener('click', async (e) => {
                if (e.target.tagName === 'BUTTON' && e.target.dataset.listingId) {
                    const jobListingId = e.target.dataset.listingId;
                    e.target.textContent = 'Gönderiliyor...';
                    e.target.disabled = true;

                    try {
                        const response = await fetch('/api/send-offer', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ studentId, jobListingId })
                        });
                        const result = await response.json();
                        alert(result.message);
                        if(result.success) {
                            modal.style.display = 'none';
                        }
                    } catch(err) {
                        alert('Teklif gönderilirken sunucu hatası oluştu.');
                    } finally {
                        e.target.textContent = 'Teklif Gönder';
                        e.target.disabled = false;
                    }
                }
            });
        }

    } catch (err) {
        console.error('Profil yüklenirken hata:', err);
        container.innerHTML = '<h2>Öğrenci profili yüklenirken bir sorun oluştu.</h2>';
    }
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
        if (data.student && data.student.length > 0) {
            data.student.forEach(s => {
                const el = document.createElement('div');
                el.className = 'card';
                el.innerHTML = `<div class="card-content"><h4>${escapeHtml(s.name)}</h4><p>${escapeHtml(s.area)}</p></div><div class="card-actions"><a href="/edit-listing.html?type=student&id=${s._id}" class="edit-btn">Düzenle</a><button class="delete-btn" data-id="${s._id}" data-type="student">Sil</button></div>`;
                studentContainer.appendChild(el);
            });
        } else { studentContainer.innerHTML = '<p>Henüz oluşturduğunuz bir stajyer ilanı yok.</p>'; }
        employerContainer.innerHTML = '';
        if (data.employer && data.employer.length > 0) {
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
                body: JSON.stringify(loginData),
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
const forgotPasswordForm = document.getElementById('forgot-password-form');
if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const email = document.getElementById('forgot-email').value;
        const button = this.querySelector('button');
        button.textContent = 'Gönderiliyor...';
        button.disabled = true;
        try {
            const response = await fetch('/api/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
            const result = await response.json();
            alert(result.message);
        } catch (err) {
            alert('Bir hata oluştu. Lütfen tekrar deneyin.');
        } finally {
            button.textContent = 'Sıfırlama Linki Gönder';
            button.disabled = false;
        }
    });
}
if (window.location.pathname.endsWith('/reset-password.html')) {
    const resetPasswordForm = document.getElementById('reset-password-form');
    resetPasswordForm.addEventListener('submit', async function(e) { e.preventDefault(); const pass1 = document.getElementById('reset-pass1').value; const pass2 = document.getElementById('reset-pass2').value; if (pass1 !== pass2) { alert('Girdiğiniz şifreler uyuşmuyor.'); return; } const params = new URLSearchParams(window.location.search); const token = params.get('token'); try { const response = await fetch('/api/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token, newPassword: pass1 }) }); const result = await response.json(); alert(result.message); if (result.success) { window.location.href = '/giris.html'; } } catch (err) { alert('Bir hata oluştu.'); } });
}
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

        // KRİTİK KONTROL: Kullanıcı giriş yapmışsa
        if (currentUser && userNav) {
            const studentLinks = currentUser.role === 'student'
                ? '<a href="/is-tekliflerim.html">İş Tekliflerim</a>'
                : '';

            // Profil avatarı veya baş harf kutusunu oluşturma
            let avatarHtml;
            if (currentUser.profilePicturePath) {
                avatarHtml = `<img src="${currentUser.profilePicturePath}" alt="Profil" class="profile-avatar-img">`;
            } else {
                const userInitial = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : '?';
                avatarHtml = `<div class="profile-avatar">${userInitial}</div>`;
            }
            if (window.location.pathname.endsWith('/ogrenci-profil.html')) {
                loadStudentProfileData();
            }
            // userNav içeriğini temiz Dropdown yapısıyla doldur
            userNav.innerHTML = `
                <div class="profile-dropdown">
                    ${avatarHtml}
                    <div class="dropdown-content">
                        <a href="/profil.html">İlanlarım</a>
                        ${studentLinks}
                        <a href="/profil-duzenle.html">Profili Düzenle</a>
                        <a id="logout-btn" href="#">Çıkış Yap</a>
                    </div>
                </div>`;
            if (window.location.pathname.endsWith('/ogrenci-profil.html')) {
                loadStudentProfileData();
            // ÇÖZÜM: ÇIKIŞ YAP DINLEYICISINI DOĞRU ZAMANDA VE YERE ATIYORUZ
            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    await fetch('/api/logout', { method: 'POST' });
                    window.location.href = '/index.html';

                });
            }
        }


        // Giriş yapmamışsa, index.html'deki Giriş/Kayıt butonu kalır.

        updateUIAfterLogin();

        // Sayfa Bazlı Yüklemeler
        if (document.getElementById('results-container')) { renderResultsOnHome(); }
        if (window.location.pathname.endsWith('/profil.html')) { fetchMyListings(); }
        if (window.location.pathname.endsWith('/profil-duzenle.html')) { initializeProfileEditPage(); }
        if (window.location.pathname.endsWith('/is-tekliflerim.html')) { renderMyOffers(); }

    } catch (err) {
        console.error('Kullanıcı durumu kontrol edilirken hata:', err);
    }
});

    sync function renderMyOffers() {
        const container = document.getElementById('offers-container');
        if (!container) return;

        // ÖN KONTROL: Kullanıcı Öğrenci mi ve Oturum Kurulmuş mu?
        if (!currentUser || currentUser.role !== 'student') {
            container.innerHTML = '<p>Bu sayfayı görüntülemek için öğrenci olarak giriş yapmalısınız.</p>';
            return;
        }

        container.innerHTML = 'Teklifleriniz yükleniyor...';

        try {
            const response = await fetch('/api/get-my-offers');
            if (response.status === 403 || response.status === 401) {
                throw new Error("Oturum yetkilendirmesi başarısız.");
            }

            const offers = await response.json();
            container.innerHTML = '';

            if (!offers || offers.length === 0) {
                container.innerHTML = '<p>Şu anda size gönderilmiş yeni bir iş teklifi bulunmuyor.</p>';
                return;
            }

            // Teklifler başarılı bir şekilde listelenir
            offers.forEach(offer => {
                const companyName = offer.jobInfo?.company || 'Bilinmeyen Şirket';
                const jobArea = offer.jobInfo?.area || 'Bilinmeyen Pozisyon';
                const offerDate = new Date(offer.createdAt).toLocaleDateString('tr-TR');

                const card = document.createElement('div');
                card.className = 'card';
                card.innerHTML = `
                <h4><strong>${escapeHtml(companyName)}</strong> size bir teklif gönderdi!</h4>
                <p>Pozisyon: ${escapeHtml(jobArea)}</p>
                <p style="font-size: 0.9em; color: #6c757d; margin-top: 15px;">Gönderim Tarihi: ${offerDate}</p>
                <a href="#" style="font-weight: bold; color: #28a745; margin-top: 10px; display: block;">Detayları Gör</a>
            `;
                container.appendChild(card);
            });

        } catch (err) {
            console.error('Teklifler yüklenirken API hatası:', err);
            container.innerHTML = '<p>Teklifler yüklenirken bir sorun oluştu. Lütfen teknik ekiple iletişime geçin.</p>';
        }
    }

            // Teklifler başarılı bir şekilde listelenir
            offers.forEach(offer => {
                const companyName = offer.jobInfo?.company || 'Bilinmeyen Şirket';
                const jobArea = offer.jobInfo?.area || 'Bilinmeyen Pozisyon';
                const offerDate = new Date(offer.createdAt).toLocaleDateString('tr-TR');

                const card = document.createElement('div');
                card.className = 'card';
                card.innerHTML = `
                <h4><strong>${escapeHtml(companyName)}</strong> size bir teklif gönderdi!</h4>
                <p>Pozisyon: ${escapeHtml(jobArea)}</p>
                <p style="font-size: 0.9em; color: #6c757d; margin-top: 15px;">Gönderim Tarihi: ${offerDate}</p>
                <a href="#" style="font-weight: bold; color: #28a745; margin-top: 10px; display: block;">Detayları Gör</a>
            `;
                container.appendChild(card);
            });

        } catch (err) {
            console.error('Teklifler yüklenirken API hatası:', err);
            container.innerHTML = '<p>Teklifler yüklenirken bir sorun oluştu. Lütfen teknik ekiple iletişime geçin.</p>';
        }
    }
/* --- Arama, Şikayet ve Başvuru İşlemleri --- */
document.body.addEventListener('click', async function(e) {
    if (e.target.id === 'search-btn') {
        const searchArea = document.getElementById('search-area').value;
        const searchCity = document.getElementById('search-city').value;
        const searchQuery = document.getElementById('search-query').value;

        const query = `?query=${searchQuery}&area=${searchArea}&city=${searchCity}`;
        const container = document.getElementById('results-container');
        if (window.location.pathname === '/index.html' || window.location.pathname === '/') {
            container.innerHTML = 'Aranıyor...';
            const noResultsPlaceholder = document.getElementById('no-results-placeholder');
            noResultsPlaceholder.style.display = 'none';

            try {
                const response = await fetch(`/api/search${query}`);
                const results = await response.json();
                container.innerHTML = '';

                if (results.length === 0) {
                    noResultsPlaceholder.style.display = 'block';
                    return;
                }
                const isEmployer = (currentUser && currentUser.role === 'employer');
                results.forEach(item => {
                    const el = document.createElement('div');
                    el.className = 'card';
                    if (isEmployer) {
                        const profilePicHtml = item.sahipInfo && item.sahipInfo.profilePicturePath
                            ? `<div class="card-profile-pic" style="background-image: url('${item.sahipInfo.profilePicturePath}')"></div>`
                            : '<div class="card-profile-pic-placeholder"></div>';

                        el.innerHTML = `
                            <a href="/ogrenci-profil.html?id=${item._id}" class="card-link-wrapper">
                                <div class="card-header">
                                    ${profilePicHtml}
                                    <div class="card-info">
                                        <h4>${escapeHtml(item.name)}</h4>
                                        <p><strong>${escapeHtml(item.area)}</strong> — ${escapeHtml(item.city)}</p>
                                    </div>
                                </div>
                            </a>
                            <div class="card-body">
                                <p>${escapeHtml(item.dept || '')}</p>
                                <p>${escapeHtml(item.desc)}</p>
                                <a href="#" class="report-link" data-id="${item._id}" data-type="student">Bu ilanı şikayet et</a>
                            </div>`;

                    } else {
                        const applyButtonHTML = (currentUser && currentUser.role === 'student') ? `<div class="card-actions"><button class="apply-btn" data-id="${item._id}">Başvur</button></div>` : '';
                        el.innerHTML = `<div class="card-content"><h4>${escapeHtml(item.company)}</h4><p><strong>${escapeHtml(item.area)}</strong> — ${escapeHtml(item.city)}</p><p>${escapeHtml(item.sector)}</p><p>${escapeHtml(item.req)}</p><p>İletişim: <strong>${escapeHtml(item.contact)}</strong></p><a href="#" class="report-link" data-id="${item._id}" data-type="employer">Bu ilanı şikayet et</a></div>${applyButtonHTML}`;
                    }
                    container.appendChild(el);
                });

            } catch (err) { console.error('Arama sırasında hata:', err); container.innerHTML = '<p>Arama sırasında bir sorun oluştu.</p>'; }
        }
    }

    // Şikayet linki tıklandığında... (Diğer olay dinleyicileri)
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
});

const resultsContainer = document.getElementById('results-container');
if (resultsContainer) {
    resultsContainer.addEventListener('click', async (e) => {
        if (e.target.classList.contains('apply-btn')) {
            const listingId = e.target.dataset.id;
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

const hamburger = document.getElementById('hamburger-menu');
const mobileNav = document.getElementById('mobile-nav');
if (hamburger && mobileNav) {
    hamburger.addEventListener('click', () => {
        mobileNav.classList.toggle('active');
    });
}

// Profil Düzenleme Fonksiyonu (Diğer sayfalarda kullanılıyor)
function initializeProfileEditPage() {
    const editForm = document.getElementById('edit-profile-form');
    const nameInput = document.getElementById('edit-name');
    const picturePreview = document.getElementById('picture-preview');

    if (currentUser) {
        nameInput.value = currentUser.name;
        if (currentUser.profilePicturePath) {
            picturePreview.style.backgroundImage = `url(${currentUser.profilePicturePath})`;
        }
    } else {
        window.location.href = '/giris.html';
        return;
    }

    editForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(this);

        try {
            const response = await fetch('/api/update-profile', { method: 'POST', body: formData });
            const result = await response.json();
            alert(result.message);
            if (result.success) { window.location.href = '/profil.html'; }
        } catch (err) {
            alert('Profil güncellenirken bir hata oluştu.');
            console.error(err);
        }
    });
}

// Teklifleri Gösterme Fonksiyonu (Diğer sayfalarda kullanılıyor)
function renderMyOffers() {
    const container = document.getElementById('offers-container');
    if (!container) return;

    fetch('/api/get-my-offers')
        .then(res => res.json())
        .then(offers => {
            container.innerHTML = '';
            if (!offers || offers.length === 0) {
                container.innerHTML = '<p>Henüz bir iş teklifi almadınız.</p>';
                return;
            }
            offers.forEach(offer => {
                const companyName = offer.jobInfo && offer.jobInfo[0] ? offer.jobInfo[0].company : 'Bir Şirket';
                const jobArea = offer.jobInfo && offer.jobInfo[0] ? offer.jobInfo[0].area : 'bir pozisyon';
                const offerDate = new Date(offer.createdAt).toLocaleDateString('tr-TR');

                const card = document.createElement('div');
                card.className = 'card';
                card.innerHTML = `
                    <h4><strong>${escapeHtml(companyName)}</strong></h4>
                    <p>Size <strong>${escapeHtml(jobArea)}</strong> pozisyonu için bir iş teklifi gönderdi.</p>
                    <p style="font-size: 0.9em; color: #6c757d; margin-top: 15px;">Tarih: ${offerDate}</p>
                `;
                container.appendChild(card);
            });
        })
        .catch(err => {
            console.error('Teklifler yüklenirken hata:', err);
            container.innerHTML = '<p>Teklifler yüklenirken bir sorun oluştu. Lütfen giriş yaptığınızdan emin olun.</p>';
        });
}
// --- E-POSTA DOĞRULAMA MANTIĞI ---


const verifyForm = document.getElementById('verify-form');
const verifyCard = document.getElementById('verify-card');
const registerCard = document.getElementById('register-card');

if (registerForm) {
    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const userData = {
            name: document.getElementById('reg-name').value,
            email: document.getElementById('reg-email').value,
            pass: document.getElementById('reg-pass').value,
            role: document.getElementById('reg-role').value
        };
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
            const result = await response.json();

            alert(result.message);

            if (result.success) {
                // Kayıt başarılıysa doğrulama ekranına geç
                document.getElementById('verification-email').value = userData.email;
                registerCard.style.display = 'none';
                verifyCard.style.display = 'block';
            }
        } catch (err) {
            alert('Sunucuya bağlanırken bir hata oluştu.');
        }
    });
}

if (verifyForm) {
    verifyForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const email = document.getElementById('verification-email').value;
        const code = document.getElementById('verify-code').value.toUpperCase();

        try {
            const response = await fetch('/api/verify-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code })
            });
            const result = await response.json();
            alert(result.message);

            if (result.success) {
                // Doğrulama başarılı ise anasayfaya yönlendir
                window.location.href = '/index.html';
            }
        } catch (err) {
            alert('Doğrulama sırasında bir hata oluştu.');
        }
    });
}
// NOT: Kodu tekrar gönderme (resend-code) mantığı, server tarafında yeni bir rota gerektirir. Şimdilik bu kısmı yoksayabiliriz.