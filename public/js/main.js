// ===================================================================================
//                                  STAJLA - main.js (NİHAİ MÜKEMMEL VE HATASIZ VERSİYON)
// ===================================================================================

let currentUser = null;
let myStudentListing = null;
// --- YENİ EKLENEN KISIM: ARAMA KUTUSU LİSTELERİ ---

const allCities = [
    "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Amasya", "Ankara", "Antalya", "Artvin", "Aydın", "Balıkesir",
    "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli",
    "Diyarbakır", "Düzce", "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane",
    "Hakkari", "Hatay", "Isparta", "Mersin", "İstanbul", "İzmir", "Kars", "Kastamonu", "Kayseri", "Kırklareli",
    "Kırşehir", "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Kahramanmaraş", "Mardin", "Muğla", "Muş",
    "Nevşehir", "Niğde", "Ordu", "Rize", "Sakarya", "Samsun", "Siirt", "Sinop", "Sivas", "Tekirdağ",
    "Tokat", "Trabzon", "Tunceli", "Şanlıurfa", "Uşak", "Van", "Yozgat", "Zonguldak", "Aksaray", "Bayburt",
    "Karaman", "Kırıkkale", "Batman", "Şırnak", "Bartın", "Ardahan", "Iğdır", "Yalova", "Karabük", "Kilis",
    "Osmaniye"
];

const allAreas = {
    "Bilişim & Yazılım": [
        "Bilgisayar Mühendisliği", "Yazılım Mühendisliği", "Yapay Zeka Mühendisliği", "Yönetim Bilişim Sistemleri (YBS)", "Bilgi Sistemleri Mühendisliği"
    ],
    "Mühendislik & Teknik Bilimler": [
        "Makine Mühendisliği", "Elektrik-Elektronik Mühendisliği", "Endüstri Mühendisliği", "İnşaat Mühendisliği", "Kimya Mühendisliği",
        "Malzeme Bilimi ve Mühendisliği", "Çevre Mühendisliği", "Gıda Mühendisliği", "Orman Mühendisliği", "Orman Endüstri Mühendisliği",
        "Ziraat Mühendisliği", "Jeoloji Mühendisliği", "Harita Mühendisliği"
    ],
    "Mimarlık & Tasarım": [
        "Mimarlık", "İç Mimarlık ve Çevre Tasarımı", "Şehir ve Bölge Planlama", "Görsel İletişim Tasarımı", "Grafik Tasarımı", "Endüstriyel Tasarım"
    ],
    "İşletme, Ekonomi & İdari Bilimler": [
        "İşletme", "İktisat (Ekonomi)", "Uluslararası İlişkiler", "Uluslararası Ticaret ve Lojistik", "Maliye", "Bankacılık ve Finans", "Hukuk", "Ekonometri"
    ],
    "Sosyal & Beşeri Bilimler": [
        "Psikoloji", "Sosyoloji", "Sosyal Hizmet", "Felsefe", "Tarih", "Edebiyat (Türk Dili ve Edebiyatı vb.)", "Çeviribilim"
    ],
    "İletişim, Medya & Pazarlama": [
        "Halkla İlişkiler ve Tanıtım", "Reklamcılık", "Gazetecilik", "Radyo, Televizyon ve Sinema", "Yeni Medya ve İletişim"
    ],
    "Sağlık Bilimleri": [
        "Tıp", "Diş Hekimliği", "Eczacılık", "Hemşirelik", "Fizyoterapi ve Rehabilitasyon", "Beslenme ve Diyetetik", "Veterinerlik"
    ],
    "Önlisans (2 Yıllık Programlar)": [
        "Bilgisayar Programcılığı (Önlisans)", "Elektrik/Elektronik Teknolojisi (Önlisans)", "Muhasebe ve Vergi Uygulamaları (Önlisans)",
        "İnsan Kaynakları Yönetimi (Önlisans)", "Tıbbi Sekreterlik ve Dökümantasyon (Önlisans)", "İşletme Yönetimi (Önlisans)", "Önlisans Programları (Genel)"
    ]
};
/* --- YARDIMCI FONKSİYONLAR --- */
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;', '/': '&#47;', '=': '&#61;' };
    return text.replace(/[&<>"'`=/]/g, s => map[s]);
}


/* ---------------------------------------------------- */
/* İLAN VE SONUÇ LİSTELEME FONKSİYONLARI (GÜNCELLENDİ) */
/* ---------------------------------------------------- */

async function renderResultsOnHome() {
    const container = document.getElementById('results-container');
    const noResultsPlaceholder = document.getElementById('no-results-placeholder');

    if (!container || !noResultsPlaceholder) return;

    container.innerHTML = 'Yükleniyor...';
    noResultsPlaceholder.style.display = 'none';

    // 1. KULLANICI ROLÜNE GÖRE DOĞRU API ROTASINI SEÇ
    let apiEndpoint = '/api/ogrenci-ilanlari'; // Varsayılan (Ziyaretçi ve İşveren için)
    let ilanTipi = 'student';

    if (currentUser && currentUser.role === 'student') {
        apiEndpoint = '/api/job-listings'; // Öğrenciyse işveren ilanlarını çek
        ilanTipi = 'employer';
    }

    try {
        const response = await fetch(apiEndpoint);
        const ilanlar = await response.json();
        container.innerHTML = '';

        if (!ilanlar || ilanlar.length === 0) {
            noResultsPlaceholder.style.display = 'block';
            return;
        }

        // 2. ÇEKİLEN İLAN TİPİNE GÖRE DOĞRU KARTI OLUŞTUR
        ilanlar.forEach(ilan => {
            const el = document.createElement('div');
            el.className = 'card';

            if (ilanTipi === 'student') {
                // Ziyaretçi/İşveren için Öğrenci Kartı HTML'i
                const s = ilan;
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
                        </div>
                    </div>`;
            } else {
                // Öğrenci için İşveren Kartı HTML'i
                const j = ilan;
                const profilePicHtml = j.sahipInfo && j.sahipInfo.profilePicturePath
                    ? `<div class="card-profile-pic" style="background-image: url('${j.sahipInfo.profilePicturePath}')"></div>`
                    : '<div class="card-profile-pic-placeholder"></div>';

                el.innerHTML = `
                    <div class="card-content">
                        <div class="card-header">
                            ${profilePicHtml}
                            <div class="card-info">
                               <a href="/sirket-profili.html?id=${j.createdBy}" style="color: inherit; text-decoration: none;" title="${escapeHtml(j.company)} şirket profiline git"><h4>${escapeHtml(j.company)}</h4></a>
                                <p><strong>${escapeHtml(j.area)}</strong> — ${escapeHtml(j.city)}</p>
                            </div>
                        </div>
                        <div class="card-body">
                            <p style="margin-top: 0;">Sektör: <strong>${escapeHtml(j.sector || 'Belirtilmemiş')}</strong></p>
                            <p>Gereksinimler: ${escapeHtml((j.req || 'Belirtilmemiş').substring(0, 75))}...</p>
                            <p>İletişim: <strong>${escapeHtml(j.contact)}</strong></p>
                            
                            <button class="apply-btn cta-primary" data-listing-id="${j._id}" style="width: 100%; margin-top: 10px; padding: 10px; font-weight: bold; background-color: #FFD43B; color: #222; border: none; cursor: pointer;">
                                Hemen Başvur
                            </button>
                        </div>
                    </div>`;
            }
            container.appendChild(el);
        });

    } catch (err) {
        console.error('Anasayfa sonuçları yüklenirken hata:', err);
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

    const userNav = document.getElementById('user-nav');
    if (!userNav) return;
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
    navLinks.insertBefore(tempDiv.firstElementChild, document.getElementById('user-nav'));

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
/* İŞ TEKLİFLERİM SAYFASI YÜKLEYİCİSİ (YENİ EKLENDİ) */
/* ---------------------------------------------------- */
async function renderMyOffers() {
    const container = document.getElementById('offers-container'); //
    if (!container) return;

    // Kullanıcının öğrenci olduğunu doğrula
    if (!currentUser || currentUser.role !== 'student') {
        container.innerHTML = '<p>Bu sayfayı görmek için öğrenci olarak giriş yapmış olmalısınız.</p>';
        return;
    }

    try {
        // Sunucudaki ilgili rotayı çağır
        const response = await fetch('/api/get-my-offers');
        if (!response.ok) {
            throw new Error('Teklifler yüklenirken bir sunucu hatası oluştu.');
        }

        const offers = await response.json();

        if (!offers || offers.length === 0) {
            container.innerHTML = '<p style="text-align: center; font-size: 1.1rem;">Henüz size gönderilmiş bir iş teklifi bulunmuyor.</p>';
            return;
        }

        container.innerHTML = ''; // "Yükleniyor..." metnini temizle

        // Gelen teklifleri listele
        offers.forEach(offer => {
            const job = offer.jobInfo; // server.js bu bilgiyi 'jobInfo' olarak ekliyor
            if (!job) return; // İş ilanı bilgisi gelmezse (silinmişse vb.) bu teklifi atla

            const el = document.createElement('div');
            el.className = 'card';
            el.innerHTML = `
                <div class="card-content">
                    <div class="card-header">
                        <div class="card-info">
                            <h4>${escapeHtml(job.company)}</h4>
                            <p><strong>${escapeHtml(job.area)}</strong> — ${escapeHtml(job.city)}</p>
                        </div>
                    </div>
                    <div class="card-body">
                        <p style="margin-top: 0;"><strong>Pozisyon:</strong> ${escapeHtml(job.req || 'Açıklama belirtilmemiş')}</p>
                        <p><strong>Teklif Tarihi:</strong> ${new Date(offer.createdAt).toLocaleDateString('tr-TR')}</p>
                        <p><strong>İletişim:</strong> ${escapeHtml(job.contact)}</p>
                    </div>
                </div>
            `;
            container.appendChild(el);
        });

    } catch (err) {
        console.error('Teklifler yüklenirken hata:', err);
        container.innerHTML = '<p>Teklifler yüklenirken bir sorun oluştu. Lütfen daha sonra tekrar deneyin.</p>';
    }
}
// --- YENİ EKLENEN KISIM: ARAMA KUTULARINI DOLDURAN FONKSİYON ---
// --- GÜNCELLENEN KISIM: Listeleri dolduran fonksiyonlar ---

// Bu fonksiyon, ID'si verilen herhangi bir <select>'i şehir listesiyle doldurur
function populateCities(selectId) {
    const citySelect = document.getElementById(selectId);
    if (!citySelect) return; // ID'li element yoksa atla

    allCities.sort().forEach(city => { // Şehirleri A-Z sıralayalım
        const option = document.createElement('option');
        option.value = city;
        option.textContent = city;
        citySelect.appendChild(option);
    });
}

// Bu fonksiyon, ID'si verilen herhangi bir <select>'i alan listesiyle doldurur
function populateAreas(selectId) {
    const areaSelect = document.getElementById(selectId);
    if (!areaSelect) return; // ID'li element yoksa atla

    // Gruplu olarak (Mühendislik, Bilişim vb.) doldur
    for (const groupName in allAreas) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = groupName;

        allAreas[groupName].forEach(area => {
            const option = document.createElement('option');
            option.value = area;
            option.textContent = area;
            optgroup.appendChild(option);
        });
        areaSelect.appendChild(optgroup);
    }

    // "Diğer" seçeneğini anasayfadaki 'search-area' dışındakilere eklemeyelim
    if (selectId === 'search-area') {
        const otherOption = document.createElement('option');
        otherOption.value = "Tümü";
        otherOption.textContent = "Diğer / Tüm Alanlar";
        areaSelect.appendChild(otherOption);
    }
}
/* ---------------------------------------------------- */
/* DİĞER TEMEL FONKSİYONLAR */
/* ---------------------------------------------------- */







/* ---------------------------------------------------- */
/* DOM YÜKLEME VE SAYFA BAĞLANTILARI */
/* ---------------------------------------------------- */
/* ---------------------------------------------------- */
/* DOM YÜKLEME VE SAYFA BAĞLANTILARI */
/* ---------------------------------------------------- */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/current-user');
        currentUser = await response.json();
        const userNav = document.getElementById('user-nav');
// YENİ EKLENDİ: Kullanıcı öğrenciyse, başvuru yapabilmesi için onun staj ilanını hafızaya al
        if (currentUser && currentUser.role === 'student') {
            try {
                const listingResponse = await fetch('/api/my-student-listing'); //
                myStudentListing = await listingResponse.json();
            } catch (e) {
                console.error("Öğrenci ilanı çekilemedi:", e);
                myStudentListing = null; // Hata olursa veya ilanı yoksa null kalsın
            }
        }
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
        if (window.location.pathname.endsWith('/is-tekliflerim.html')) { renderMyOffers(); }
        if (window.location.pathname.endsWith('/ogrenci-profil.html')) { loadStudentProfileData(); }
        // --- YENİ EKLENEN KISIM: TÜM LİSTELERİ DOLDUR ---
        // 1. Anasayfa (index.html) listeleri
        populateCities('search-city');
        populateAreas('search-area');

        // 2. Öğrenci İlan (ogrenci-ilan.html) listeleri
        populateCities('s-city'); //
        populateAreas('s-area');  //

        // 3. İşveren İlan (isveren-ilan.html) listeleri
        populateCities('j-city'); //
        populateAreas('j-area');  //
        // --- YENİ EKLENEN KISIM: ANASAYFA ARAMA BUTONU YÖNETİMİ ---
        const searchButton = document.getElementById('search-btn'); //
        if (searchButton) {
            searchButton.addEventListener('click', async () => {
                const query = document.getElementById('search-query').value;
                const area = document.getElementById('search-area').value;
                const city = document.getElementById('search-city').value;

                // Arama sonuçlarını göstereceğimiz ana bölüm
                const container = document.getElementById('results-container'); //
                const noResultsPlaceholder = document.getElementById('no-results-placeholder'); //
                const sectionTitle = document.querySelector('.homepage-section .section-title'); // "Son Eklenenler" başlığı

                if (!container || !noResultsPlaceholder || !sectionTitle) return;

                // Arama başlıyor, ekranı temizle
                sectionTitle.textContent = 'Arama Sonuçları'; // Başlığı değiştir
                container.innerHTML = '<i>Aranıyor...</i>';
                noResultsPlaceholder.style.display = 'none';

                try {
                    // 1. Sunucudaki /api/search rotasına isteği gönder
                    const response = await fetch(`/api/search?query=${encodeURIComponent(query)}&area=${encodeURIComponent(area)}&city=${encodeURIComponent(city)}`);
                    const results = await response.json();
                    container.innerHTML = ''; // "Aranıyor..." yazısını temizle

                    if (!results || results.length === 0) {
                        noResultsPlaceholder.style.display = 'block';
                        noResultsPlaceholder.querySelector('h3').textContent = '😥 Aradığınız Kriterlere Uygun İlan Bulunamadı.';
                        noResultsPlaceholder.querySelector('p').textContent = 'Farklı anahtar kelimeler veya filtreler deneyin.';
                        return;
                    }

                    // 2. /api/search rotası, kullanıcı rolüne göre (öğrenciyse işveren, işverense öğrenci)
                    // doğru ilanları zaten getirir. Biz sadece gelen veriyi ekrana basacağız.
                    // Gelen verinin öğrenci mi işveren mi olduğunu anlamak için 'company' alanı var mı diye kontrol edelim.
                    const ilanTipi = results[0].company ? 'employer' : 'student';

                    results.forEach(ilan => {
                        const el = document.createElement('div');
                        el.className = 'card';

                        if (ilanTipi === 'student') {
                            const s = ilan;
                            // Not: Arama sonucu 'sahipInfo' içermeyebilir, basit kart yapalım.
                            el.innerHTML = `
                                <div class="card-content">
                                    <a href="/ogrenci-profil.html?id=${s._id}" class="card-link-wrapper">
                                        <div class="card-header"><div class="card-info">
                                            <h4>${escapeHtml(s.name)}</h4>
                                            <p><strong>${escapeHtml(s.area)}</strong> — ${escapeHtml(s.city)}</p>
                                        </div></div>
                                    </a>
                                    <div class="card-body">
                                        <p style="margin-top: 0;">Üniversite: <strong>${escapeHtml(s.dept || 'Belirtilmemiş')}</strong></p>
                                        ${s.cvPath ? `<p><a href="${s.cvPath}" target="_blank" class="cv-link">CV Görüntüle</a></p>` : ''}
                                    </div>
                                </div>`;
                        } else {
                            const j = ilan;
                            el.innerHTML = `
                                <div class="card-content">
                                    <div class="card-header"><div class="card-info">
                                        <<a href="/sirket-profili.html?id=${j.createdBy}" style="color: inherit; text-decoration: none;" title="${escapeHtml(j.company)} şirket profiline git"><h4>${escapeHtml(j.company)}</h4></a>
                                        <p><strong>${escapeHtml(j.area)}</strong> — ${escapeHtml(j.city)}</p>
                                    </div></div>
                                    <div class="card-body">
                                        <p style="margin-top: 0;">Sektör: <strong>${escapeHtml(j.sector || 'Belirtilmemiş')}</strong></p>
                                        <p>Gereksinimler: ${escapeHtml((j.req || 'Belirtilmemiş').substring(0, 75))}...</p>
                                        ${currentUser && currentUser.role === 'student' ? // Sadece öğrenciyse Başvur butonu göster
                                `<button class="apply-btn cta-primary" data-listing-id="${j._id}" style="width: 100%; margin-top: 10px; padding: 10px; font-weight: bold; background-color: #FFD43B; color: #222; border: none; cursor: pointer;">
                                                Hemen Başvur
                                            </button>` :
                                `<p>İletişim: <strong>${escapeHtml(j.contact)}</strong></p>` // Değilse iletişim göster
                            }
                                    </div>
                                </div>`;
                        }
                        container.appendChild(el);
                    });

                } catch (err) {
                    console.error('Arama yapılırken hata:', err);
                    sectionTitle.textContent = 'Bir Hata Oluştu';
                    container.innerHTML = '<p>Arama sonuçları getirilirken bir sorun yaşandı.</p>';
                }
            });
        }
// --- YENİ EKLENEN KISIM: ANASAYFA BAŞVURU BUTONU TIKLAMASI ---
        const resultsContainer = document.getElementById('results-container');
        if (resultsContainer) {
            resultsContainer.addEventListener('click', async (e) => {
                // Tıklanan öğenin "Hemen Başvur" butonu olup olmadığını kontrol et
                if (e.target.classList.contains('apply-btn')) {

                    // 1. Kullanıcının giriş yapıp yapmadığını ve rolünü kontrol et
                    if (!currentUser || currentUser.role !== 'student') {
                        alert('Başvuru yapmak için öğrenci olarak giriş yapmalısınız.');
                        return;
                    }

                    // 2. Öğrencinin "Staj Arıyorum" ilanı olup olmadığını kontrol et
                    if (!myStudentListing || !myStudentListing._id) {
                        alert('Başvuru yapabilmek için önce "Staj Arıyorum" ilanı oluşturmanız gerekmektedir.');
                        window.location.href = '/ogrenci-ilan.html'; // Kullanıcıyı ilan oluşturmaya yönlendir
                        return;
                    }

                    // 3. Başvuru işlemini onayla
                    if (!confirm('Bu iş ilanına başvurmak istediğinize emin misiniz?')) {
                        return;
                    }

                    const button = e.target;
                    const listingId = button.dataset.listingId; // Tıklanan butonun data-listing-id'si
                    const studentListingId = myStudentListing._id; // Hafızaya alınan öğrenci ilanının ID'si

                    button.disabled = true;
                    button.textContent = 'Başvuruluyor...';

                    try {
                        const response = await fetch('/api/apply', { //
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ listingId, studentListingId })
                        });

                        const result = await response.json();
                        alert(result.message);

                        if (response.ok) {
                            button.textContent = 'Başvuruldu';
                        } else {
                            button.disabled = false;
                            button.textContent = 'Hemen Başvur';
                        }
                    } catch (error) {
                        alert('Başvuru sırasında bir hata oluştu.');
                        button.disabled = false;
                        button.textContent = 'Hemen Başvur';
                    }
                }
            });
        }
        // --- YENİ EKLENEN KISIM: GİRİŞ FORMU YÖNETİMİ ---
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                const email = document.getElementById('login-email').value;
                const pass = document.getElementById('login-pass').value;
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
                    alert('Sunucuya bağlanırken bir hata oluştu.');
                    console.error('Giriş Formu Hata:', error);
                } finally {
                    button.disabled = false;
                    button.textContent = 'Hemen Giriş Yap';
                }
            });
        }
        // --- YENİ EKLENEN KISIM SONU ---
// --- YENİ EKLENEN KISIM: KAYIT FORMU YÖNETİMİ ---
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault(); // Formun sayfayı yenilemesini engelle

                const name = document.getElementById('reg-name').value;
                const email = document.getElementById('reg-email').value;
                const pass = document.getElementById('reg-pass').value;
                const role = document.getElementById('reg-role').value;
                const button = registerForm.querySelector('button[type="submit"]');

                if (!role) {
                    alert('Lütfen bir hesap türü seçin (Öğrenci veya İşveren).');
                    return;
                }
                if (pass.length < 6) {
                    alert('Şifreniz en az 6 karakter olmalıdır.');
                    return;
                }

                button.disabled = true;
                button.textContent = 'Kayıt Olunuyor...';

                try {
                    const response = await fetch('/api/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, email, pass, role })
                    });

                    const result = await response.json();

                    if (response.ok) {
                        // Başarılı kayıt (doğrulama kodu gönderildi)
                        alert(result.message); // "Doğrulama kodu gönderildi" mesajı

                        // Kayıt formunu gizle, doğrulama formunu göster
                        document.getElementById('register-card').style.display = 'none';
                        document.getElementById('verify-card').style.display = 'block';

                        // E-postayı gizli bir alana yaz, böylece doğrulama formu kullanabilir
                        document.getElementById('verification-email').value = email;
                    } else {
                        // Hata (örn: e-posta zaten kayıtlı)
                        alert(result.message);
                    }
                } catch (error) {
                    alert('Sunucuya bağlanırken bir hata oluştu.');
                    console.error('Kayıt Formu Hata:', error);
                } finally {
                    button.disabled = false;
                    button.textContent = 'Kayıt Ol';
                }
            });
        }

        // --- YENİ EKLENEN KISIM: E-POSTA DOĞRULAMA FORMU YÖNETİMİ ---
        const verifyForm = document.getElementById('verify-form');
        if (verifyForm) {
            verifyForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                const code = document.getElementById('verify-code').value;
                const email = document.getElementById('verification-email').value; // Kayıt formundan saklanan e-posta
                const button = verifyForm.querySelector('button[type="submit"]');

                if (!email) {
                    alert('Doğrulama yapılacak e-posta adresi bulunamadı. Lütfen kayıt sayfasına geri dönün.');
                    return;
                }

                button.disabled = true;
                button.textContent = 'Doğrulanıyor...';

                try {
                    const response = await fetch('/api/verify-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, code })
                    });

                    const result = await response.json();

                    if (response.ok) {
                        // Başarılı doğrulama ve otomatik giriş
                        alert(result.message);
                        window.location.href = '/index.html'; // Kullanıcıyı anasayfaya yönlendir
                    } else {
                        // Hata (örn: yanlış kod)
                        alert(result.message);
                    }

                } catch (error) {
                    alert('Doğrulama sırasında sunucuda bir hata oluştu.');
                    console.error('Doğrulama Formu Hata:', error);
                } finally {
                    button.disabled = false;
                    button.textContent = 'Hesabı Aktive Et';
                }
            });
        }
        // --- YENİ EKLENEN KISIM: ÖĞRENCİ İLANI OLUŞTURMA FORMU ---
        const studentForm = document.getElementById('student-form');
        if (studentForm) {
            studentForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const button = studentForm.querySelector('button[type="submit"]');
                button.disabled = true;
                button.textContent = 'İlan Gönderiliyor...';

                // Dosya (CV) olduğu için FormData kullanmalıyız
                const formData = new FormData();
                formData.append('name', document.getElementById('s-name').value);
                formData.append('dept', document.getElementById('s-dept').value);
                formData.append('city', document.getElementById('s-city').value);
                formData.append('area', document.getElementById('s-area').value);
                formData.append('desc', document.getElementById('s-desc').value);
                formData.append('contact', document.getElementById('s-contact').value);

                const cvFile = document.getElementById('s-cv').files[0];
                if (cvFile) {
                    formData.append('cv', cvFile); // Sunucu tarafı bunu 'cv' olarak bekliyor
                }

                try {
                    const response = await fetch('/api/ogrenci-ilan', {
                        method: 'POST',
                        body: formData // Dosya gönderdiğimiz için JSON değil, FormData
                    });

                    const result = await response.json();
                    alert(result.message);

                    if (response.ok) {
                        window.location.href = '/profil.html'; // Başarılıysa "İlanlarım" sayfasına yönlendir
                    }
                } catch (error) {
                    alert('İlan gönderilirken bir hata oluştu.');
                    console.error('Öğrenci İlan Formu Hata:', error);
                } finally {
                    button.disabled = false;
                    button.textContent = 'İlanımı Keşfe Aç';
                }
            });
        }

        // --- YENİ EKLENEN KISIM: İŞVEREN İLANI OLUŞTURMA FORMU ---
        const jobForm = document.getElementById('job-form');
        if (jobForm) {
            jobForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const button = jobForm.querySelector('button[type="submit"]');
                button.disabled = true;
                button.textContent = 'İlan Yayınlanıyor...';

                // Bu formda dosya yok, JSON olarak gönderebiliriz
                const jobData = {
                    company: document.getElementById('j-company').value,
                    sector: document.getElementById('j-sector').value,
                    city: document.getElementById('j-city').value,
                    area: document.getElementById('j-area').value,
                    req: document.getElementById('j-req').value,
                    contact: document.getElementById('j-contact').value,
                };

                try {
                    const response = await fetch('/api/isveren-ilan', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(jobData)
                    });

                    const result = await response.json();
                    alert(result.message);

                    if (response.ok) {
                        window.location.href = '/profil.html'; // Başarılıysa "İlanlarım" sayfasına yönlendir
                    }
                } catch (error) {
                    alert('İlan yayınlanırken bir hata oluştu.');
                    console.error('İşveren İlan Formu Hata:', error);
                } finally {
                    button.disabled = false;
                    button.textContent = 'İlanı Yayınla ve Adayları Bekle';
                }
            });
        }
// --- GÜNCELLENEN KISIM: PROFİL GÜNCELLEME (Geliştirme 7: Rol Tabanlı) ---

        // Önce iki formu da seçelim
        const studentEditForm = document.getElementById('student-edit-form');
        const employerEditForm = document.getElementById('employer-edit-form');

        // Eğer bu formlardan biri sayfada varsa (yani profil-duzenle.html sayfasındaysak)
        if (studentEditForm && employerEditForm) {

            // 1. Sayfa yüklendiğinde: Kullanıcı rolüne göre doğru formu göster
            if (!currentUser) {
                document.querySelector('main.form-page').innerHTML = '<h2>Bu sayfayı görmek için giriş yapmalısınız.</h2>';
            } else if (currentUser.role === 'student') {
                // --- Öğrenciyse ---
                studentEditForm.style.display = 'block'; // Öğrenci formunu göster

                // Mevcut verileri doldur
                document.getElementById('s-edit-name').value = currentUser.name || '';
                if (currentUser.profilePicturePath) {
                    document.getElementById('student-picture-preview').style.backgroundImage = `url('${currentUser.profilePicturePath}')`;
                }

            } else if (currentUser.role === 'employer') {
                // --- İşverense ---
                employerEditForm.style.display = 'block'; // İşveren formunu göster

                // Mevcut verileri (sunucudan çekerek) doldurmamız lazım
                // (Çünkü 'bio' ve 'website' bilgisi 'currentUser' objemizde yok)
                fetch('/api/current-user-details') // BU YENİ ROTAYI BİR SONRAKİ ADIMDA EKLEYECEĞİZ
                    .then(res => res.json())
                    .then(userData => {
                        document.getElementById('e-edit-name').value = userData.name || '';
                        document.getElementById('e-edit-website').value = userData.companyWebsite || '';
                        document.getElementById('e-edit-bio').value = userData.companyBio || '';
                        if (userData.profilePicturePath) {
                            document.getElementById('employer-picture-preview').style.backgroundImage = `url('${userData.profilePicturePath}')`;
                        }
                    });
            }

            // 2. Form Gönderme İşlemi (Öğrenci)
            studentEditForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData();
                formData.append('name', document.getElementById('s-edit-name').value);

                const file = document.getElementById('s-edit-picture').files[0];
                if (file) { formData.append('profilePicture', file); }

                await submitProfileUpdate(formData, studentEditForm);
            });

            // 3. Form Gönderme İşlemi (İşveren)
            employerEditForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData();
                formData.append('name', document.getElementById('e-edit-name').value);
                formData.append('companyWebsite', document.getElementById('e-edit-website').value);
                formData.append('companyBio', document.getElementById('e-edit-bio').value);

                const file = document.getElementById('e-edit-picture').files[0];
                if (file) { formData.append('profilePicture', file); }

                await submitProfileUpdate(formData, employerEditForm);
            });

            // 4. Ortak Gönderme Fonksiyonu
            const submitProfileUpdate = async (formData, formElement) => {
                const button = formElement.querySelector('button[type="submit"]');
                button.disabled = true;
                button.textContent = 'Güncelleniyor...';

                try {
                    const response = await fetch('/api/update-profile', { //
                        method: 'POST',
                        body: formData // FormData (dosya içerir)
                    });

                    const result = await response.json();
                    alert(result.message);

                    if (response.ok) {
                        window.location.reload(); // Sayfayı yenile ki navbar vs. güncellensin
                    }
                } catch (error) {
                    alert('Profil güncellenirken bir hata oluştu.');
                    console.error('Profil Güncelleme Formu Hata:', error);
                } finally {
                    button.disabled = false;
                    button.textContent = button.textContent.includes('Öğrenci') ? 'Öğrenci Profilimi Güncelle' : 'Şirket Profilimi Güncelle';
                }
            };
        }
// --- YENİ EKLENEN KISIM: ŞİFREMİ UNUTTUM FORMU ---
        const forgotPasswordForm = document.getElementById('forgot-password-form');
        if (forgotPasswordForm) {
            forgotPasswordForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const button = forgotPasswordForm.querySelector('button[type="submit"]');
                button.disabled = true;
                button.textContent = 'Gönderiliyor...';

                const email = document.getElementById('forgot-email').value;

                try {
                    const response = await fetch('/api/forgot-password', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email })
                    });

                    const result = await response.json();
                    alert(result.message); // "E-posta adresinize sıfırlama linki gönderildi."

                    if (response.ok) {
                        button.textContent = 'Gönderildi';
                    } else {
                        button.disabled = false;
                        button.textContent = 'Sıfırlama Linki Gönder';
                    }
                } catch (error) {
                    alert('Sunucuyla iletişim kurulamadı.');
                    button.disabled = false;
                    button.textContent = 'Sıfırlama Linki Gönder';
                }
            });
        }

        // --- YENİ EKLENEN KISIM: YENİ ŞİFRE BELİRLEME FORMU ---
        const resetPasswordForm = document.getElementById('reset-password-form');
        if (resetPasswordForm) {
            resetPasswordForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                const pass1 = document.getElementById('reset-pass1').value;
                const pass2 = document.getElementById('reset-pass2').value;

                if (pass1 !== pass2) {
                    alert('Girdiğiniz şifreler uyuşmuyor.');
                    return;
                }
                if (pass1.length < 6) {
                    alert('Yeni şifreniz en az 6 karakter olmalıdır.');
                    return;
                }

                // URL'den 'token' ve 'email' parametrelerini al
                const params = new URLSearchParams(window.location.search);
                const token = params.get('token');
                const email = params.get('email');

                if (!token || !email) {
                    alert('Geçersiz veya eksik sıfırlama linki. Lütfen e-postanızdaki linke tekrar tıklayın.');
                    return;
                }

                const button = resetPasswordForm.querySelector('button[type="submit"]');
                button.disabled = true;
                button.textContent = 'Şifre Güncelleniyor...';

                try {
                    const response = await fetch('/api/reset-password', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, token, newPassword: pass1 })
                    });

                    const result = await response.json();
                    alert(result.message);

                    if (response.ok) {
                        window.location.href = '/giris.html'; // Başarılıysa giriş sayfasına yönlendir
                    } else {
                        button.disabled = false;
                        button.textContent = 'Şifreyi Güncelle';
                    }
                } catch (error) {
                    alert('Şifre sıfırlanırken bir hata oluştu.');
                    button.disabled = false;
                    button.textContent = 'Şifreyi Güncelle';
                }
            });
        }
// --- YENİ EKLENEN KISIM: İLAN DÜZENLEME SAYFASI YÖNETİMİ (edit-listing.html) ---
        if (window.location.pathname.endsWith('/edit-listing.html')) {
            const params = new URLSearchParams(window.location.search);
            const listingId = params.get('id');
            const listingType = params.get('type');

            const studentFormEdit = document.getElementById('student-form-edit'); //
            const jobFormEdit = document.getElementById('job-form-edit'); //
            const mainContent = document.querySelector('main.form-page');

            // 1. Sayfa yüklendiğinde: Doğru formu göster ve verileri doldur
            const loadListingData = async () => {
                if (!listingId || !listingType) {
                    mainContent.innerHTML = '<h2>Geçersiz ilan. Lütfen profil sayfanızdan tekrar deneyin.</h2>';
                    return;
                }

                try {
                    // Az önce server.js'e eklediğimiz rotadan verileri çek
                    const response = await fetch(`/api/get-listing-details?id=${listingId}&type=${listingType}`);
                    const result = await response.json();

                    if (!result.success) { throw new Error(result.message); }

                    const data = result.listing;

                    // Gelen veriye göre doğru formu doldur ve göster
                    if (listingType === 'student') {
                        document.getElementById('s-name').value = data.name || '';
                        document.getElementById('s-dept').value = data.dept || '';
                        document.getElementById('s-desc').value = data.desc || '';
                        document.getElementById('s-contact').value = data.contact || '';
                        studentFormEdit.style.display = 'block'; //
                    } else { // 'employer'
                        document.getElementById('j-company').value = data.company || '';
                        document.getElementById('j-sector').value = data.sector || '';
                        document.getElementById('j-req').value = data.req || '';
                        document.getElementById('j-contact').value = data.contact || '';
                        jobFormEdit.style.display = 'block'; //
                    }
                } catch (err) {
                    mainContent.innerHTML = `<h2>Hata: ${err.message}</h2><p>İlan yüklenemedi. Lütfen giriş yaptığınızdan ve bu ilanın size ait olduğundan emin olun.</p>`;
                }
            };

            // 2. Formu gönderme (Student)
            studentFormEdit.addEventListener('submit', async (e) => {
                e.preventDefault();
                const updatedData = {
                    name: document.getElementById('s-name').value,
                    dept: document.getElementById('s-dept').value,
                    desc: document.getElementById('s-desc').value,
                    contact: document.getElementById('s-contact').value,
                };
                await submitUpdate(listingId, 'student', updatedData, studentFormEdit);
            });

            // 3. Formu gönderme (Job)
            jobFormEdit.addEventListener('submit', async (e) => {
                e.preventDefault();
                const updatedData = {
                    company: document.getElementById('j-company').value,
                    sector: document.getElementById('j-sector').value,
                    req: document.getElementById('j-req').value,
                    contact: document.getElementById('j-contact').value,
                };
                await submitUpdate(listingId, 'employer', updatedData, jobFormEdit);
            });

            // 4. Güncellemeyi sunucuya gönderen ortak fonksiyon
            const submitUpdate = async (id, type, data, formElement) => {
                const button = formElement.querySelector('button[type="submit"]');
                button.disabled = true;
                button.textContent = 'Kaydediliyor...';

                try {
                    // Az önce server.js'e eklediğimiz rotaya verileri gönder
                    const response = await fetch('/api/update-listing', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id, type, data })
                    });
                    const result = await response.json();
                    alert(result.message);
                    if (result.success) {
                        window.location.href = '/profil.html'; // Başarılıysa "İlanlarım" sayfasına dön
                    }
                } catch (err) {
                    alert('Güncelleme sırasında bir hata oluştu.');
                } finally {
                    button.disabled = false;
                    button.textContent = 'Değişiklikleri Kaydet';
                }
            };

            // Sayfa ilk yüklendiğinde verileri çekme fonksiyonunu çalıştır
            loadListingData();
        }
    } catch (err) {
        console.error('Kullanıcı durumu kontrol edilirken hata:', err);
    }
});