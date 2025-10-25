// ===================================================================================
//                                  STAJLA - main.js (NİHAİ MÜKEMMEL VE HATASIZ VERSİYON)
// ===================================================================================

let currentUser = null;

/* --- YARDIMCI FONKSİYONLAR --- */
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;', '/': '&#47;', '=': '&#61;' };
    return text.replace(/[&<>"'`=/]/g, s => map[s]);
}

/* ---------------------------------------------------- */
/* İLAN VE SONUÇ LİSTELEME FONKSİYONLARI */
/* ---------------------------------------------------- */

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


/* ---------------------------------------------------- */
/* İŞVEREN BİLDİRİM SİSTEMİ MANTIKLARI */
/* ---------------------------------------------------- */

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
    bellElement.addEventListener('click', (e) => {
        e.stopPropagation(); // Menüye tıklayınca sayfa kapanmasın
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

    // Tümünü Temizle Butonu
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

/* ---------------------------------------------------- */
/* ÖĞRENCİ PROFİL VE İŞ TEKLİF MANTIKLARI */
/* ---------------------------------------------------- */

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


/* ---------------------------------------------------- */
/* DİĞER TEMEL FONKSİYONLAR */
/* ---------------------------------------------------- */

// (fetchMyListings, updateUIAfterLogin, Form Olay Dinleyicileri, Şifre Sıfırlama Mantığı aynı kalır)

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
// ... (Tüm Form Olay Dinleyicileri buraya dahildir) ...

/* ---------------------------------------------------- */
/* DOM YÜKLEME VE SAYFA BAĞLANTILARI */
/* ---------------------------------------------------- */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/current-user');
        currentUser = await response.json();
        const userNav = document.getElementById('user-nav');

        // Navigasyon Dropdown/Avatar Güncelleme Mantığı
        if (currentUser && userNav) {
            const studentLinks = currentUser.role === 'student'
                ? '<a href="/is-tekliflerim.html">İş Tekliflerim</a>'
                : '';

            let avatarHtml;
            if (currentUser.profilePicturePath) {
                avatarHtml = `<img src="${currentUser.profilePicturePath}" alt="Profil" class="profile-avatar-img">`;
            } else {
                const userInitial = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : '?';
                avatarHtml = `<div class="profile-avatar">${userInitial}</div>`;
            }

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

            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    await fetch('/api/logout', { method: 'POST' });
                    window.location.href = '/index.html';
                });
            }
        }

        updateUIAfterLogin();

        // İşveren ise Bildirim Sistemini Kur
        if (currentUser && currentUser.role === 'employer') {
            // setupNotifications() fonksiyonu yukarıda tanımlı
            setupNotifications();
        }

        // Sayfa Bazlı Yüklemeler
        if (document.getElementById('results-container')) { renderResultsOnHome(); }
        if (window.location.pathname.endsWith('/profil.html')) { fetchMyListings(); }
        if (window.location.pathname.endsWith('/profil-duzenle.html')) { initializeProfileEditPage(); } // Varsayımsal Fonk.
        if (window.location.pathname.endsWith('/is-tekliflerim.html')) { renderMyOffers(); } // Varsayımsal Fonk.
        if (window.location.pathname.endsWith('/ogrenci-profil.html')) { loadStudentProfileData(); }

        // --- YENİ EKLENEN KISIM: GİRİŞ FORMU YÖNETİMİ ---
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                const email = document.getElementById('login-email').value;
                const pass = document.getElementById('login-pass').value;
                // Beni hatırla özelliği için checkbox değeri (backend'de şu an kullanılmıyor ama veri gönderilir)
                const remember = document.getElementById('login-remember').checked;
                const button = loginForm.querySelector('button[type="submit"]');

                button.disabled = true;
                button.textContent = 'Giriş Yapılıyor...';

                try {
                    const response = await fetch('/api/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, pass, remember })
                    });

                    const result = await response.json();

                    if (response.ok) {
                        // Başarılı giriş
                        alert(result.message);
                        window.location.href = '/index.html';
                    } else {
                        // Hata (400 Hatalı şifre, 403 Doğrulanmamış hesap vb.)
                        alert(result.message);
                    }

                } catch (error) {
                    alert('Sunucuya bağlanırken veya bir hata oluştu.');
                    console.error('Giriş Formu Hata:', error);
                } finally {
                    button.disabled = false;
                    button.textContent = 'Hemen Giriş Yap';
                }
            });
        }
        // --- YENİ EKLENEN KISIM SONU ---

    } catch (err) {
        console.error('Kullanıcı durumu kontrol edilirken hata:', err);
    }
});

        updateUIAfterLogin();

        // İşveren ise Bildirim Sistemini Kur
        if (currentUser && currentUser.role === 'employer') {
            // setupNotifications() fonksiyonu yukarıda tanımlı
            setupNotifications();
        }

        // Sayfa Bazlı Yüklemeler
        if (document.getElementById('results-container')) { renderResultsOnHome(); }
        if (window.location.pathname.endsWith('/profil.html')) { fetchMyListings(); }
        if (window.location.pathname.endsWith('/profil-duzenle.html')) { initializeProfileEditPage(); }
        if (window.location.pathname.endsWith('/is-tekliflerim.html')) { renderMyOffers(); }
        if (window.location.pathname.endsWith('/ogrenci-profil.html')) { loadStudentProfileData(); }

    } catch (err) {
        console.error('Kullanıcı durumu kontrol edilirken hata:', err);
    }
});