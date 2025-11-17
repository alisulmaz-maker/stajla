require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');
const sgMail = require('@sendgrid/mail');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;

// --- 1. CLOUDINARY VE AWS/SENDGRID KONFİGÜRASYONLARI ---
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});
sgMail.setApiKey(process.env.SENDGRID_API_KEY);


// --- 2. TEMEL UYGULAMA VE VERİTABANI AYARLARI ---
const app = express();
const PORT = process.env.PORT || 3000;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error("HATA: DATABASE_URL bulunamadı. Uygulama başlatılamıyor.");
    process.exit(1);
}

const client = new MongoClient(connectionString);
let db;


// --- 3. MULTER (GEÇİCİ DEPOLAMA) VE CLOUDINARY HELPER FONKSİYONLARI ---
const tempDir = 'public/temp_uploads';
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, tempDir); },
    filename: (req, file, cb) => { cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + path.extname(file.originalname)); }
});
const upload = multer({ storage: storage });

async function uploadToCloudinary(filePath, resourceType, folderName) {
    try {
        const result = await cloudinary.uploader.upload(filePath, {
            resource_type: 'auto',
            folder: `stajla/${folderName}`,
            quality: "auto",
            fetch_format: "auto",
            type: 'upload', // Sözdizimi hatası çözümü için bu parametre eklendi.
            access_mode: 'public' // KRİTİK: CV erişim sorununu çözer.
        });
        fs.unlinkSync(filePath); // Başarılı yükleme sonrası yerel dosyayı sil
        return result.secure_url;
    } catch (error) {
        if (fs.existsSync(filePath)) { fs.unlinkSync(filePath); } // Hata durumunda da yerel dosyayı sil
        console.error("Cloudinary yükleme hatası:", error);
        throw new Error("Dosya yüklenirken bir sorun oluştu.");
    }
}


// --- 4. MIDDLEWARE'LER VE OTURUM YÖNETİMİ ---
app.use(express.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);

const sessionStore = MongoStore.create({
    mongoUrl: connectionString,
    dbName: 'StajlaDB',
    collectionName: 'sessions',
    ttl: 14 * 24 * 60 * 60,
});

app.use(session({
    secret: process.env.SESSION_SECRET || 'cok-gizli-anahtar-olmalidir',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7,
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax'
    }
}));


// --- 5. HTML DOSYALARINI YÖNLENDİRME ---
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });
app.get('/index.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });
app.get('/giris.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'giris.html')); });
app.get('/kayit.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'kayit.html')); });
app.get('/profil.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'profil.html')); });
app.get('/profil-duzenle.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'profil-duzenle.html')); });
app.get('/ogrenci-ilan.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'ogrenci-ilan.html')); });
app.get('/isveren-ilan.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'isveren-ilan.html')); });
app.get('/ogrenci-profil.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'ogrenci-profil.html')); });
app.get('/edit-listing.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'edit-listing.html')); });
app.get('/is-tekliflerim.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'is-tekliflerim.html')); });
app.get('/iletisim.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'iletisim.html')); });
app.get('/forgot-password.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'forgot-password.html')); });
app.get('/reset-password.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'reset-password.html')); });
app.get('/gizlilik.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'gizlilik.html')); });
app.get('/kullanim-sartlari.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'kullanim-sartlari.html')); });
app.get('/blog.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'blog.html')); });
app.get('/makale-detay.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'makale-detay.html')); });
app.get('/sirket-profili.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'sirket-profili.html')); });
// --- 6. API ROTALARI (MLP Stabilizasyonu) ---

// KONTROL: Kullanıcı oturumunu döndürür
app.get('/api/current-user', (req, res) => { if (req.session.user) { res.json(req.session.user); } else { res.json(null); } });
// YENİ EKLENDİ (Geliştirme 7): Profil düzenleme sayfası için detaylı kullanıcı verisi
app.get('/api/current-user-details', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Giriş yapılmadı.' });
    }
    try {
        const userId = new ObjectId(req.session.user.id);
        // 'kullanicilar' koleksiyonundan tüm veriyi çek (şifre hariç)
        const userDetails = await db.collection("kullanicilar").findOne(
            { _id: userId },
            { projection: { password: 0, verificationCode: 0, resetToken: 0, tokenExpiration: 0 } } // Güvenlik: Hassas verileri hariç tut
        );

        if (!userDetails) {
            return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
        }
        res.json(userDetails); // 'name', 'email', 'role', 'companyBio', 'companyWebsite' vb. tüm bilgileri döndür
    } catch (err) {
        console.error('Detaylı kullanıcı verisi çekilirken hata:', err);
        res.status(500).json({ success: false, message: 'Sunucu hatası.' });
    }
});
// YENİ EKLENDİ (Geliştirme 7): Herkese Açık Şirket Profil Sayfası Verisi
app.get('/api/company-profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: 'Geçersiz Şirket ID\'si.' });
        }

        const companyId = new ObjectId(userId);

        // 1. Şirket (Kullanıcı) Bilgilerini Çek
        // Aggregation kullanarak $lookup için veriyi tek bir diziye alıyoruz
        const companyDataArray = await db.collection("kullanicilar").aggregate([
            { $match: { _id: companyId, role: 'employer' } }, // Sadece işverenleri bul
            { $project: { // Sadece herkese açık olması gereken bilgileri al
                    name: 1,
                    profilePicturePath: 1,
                    companyWebsite: 1,
                    companyBio: 1,
                    createdAt: 1
                }
            },
            { $limit: 1 } // Sadece 1 sonuç
        ]).toArray();

        if (companyDataArray.length === 0) {
            return res.status(404).json({ success: false, message: 'Şirket profili bulunamadı.' });
        }

        const companyInfo = companyDataArray[0];

        // 2. Bu Şirkete Ait Tüm Aktif İş İlanlarını Çek
        const companyListings = await db.collection("isverenler").find({ createdBy: companyId })
            .sort({ createdAt: -1 }) // En yeni ilanlar üste gelsin
            .toArray();

        // 3. İki bilgiyi birleştirip yolla
        res.json({
            success: true,
            profile: companyInfo,
            listings: companyListings
        });

    } catch (err) {
        console.error('Şirket profili çekilirken hata:', err);
        res.status(500).json({ success: false, message: 'Sunucu hatası.' });
    }
});
// ÇIKIŞ YAP
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) { return res.json({ success: false }); }
        res.clearCookie('connect.sid');
        res.json({ success: true, message: 'Çıkış başarılı.' });
    });
});
// server.js - İŞ TEKLİFLERİNİ GETİRME ROTASI (ÖĞRENCİ İÇİN)
app.get('/api/get-my-offers', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') {
        // Hata vermeden boş dönmeli
        return res.status(200).json([]);
    }

    try {
        const userId = new ObjectId(req.session.user.id);

        // 1. Kullanıcının aktif staj ilanlarını (profilini) bul
        const studentListings = await db.collection("ogrenciler")
            .find({ createdBy: userId })
            .project({ _id: 1 }) // Sadece ID'leri çekmek yeterli
            .toArray();

        if (studentListings.length === 0) {
            return res.json([]);
        }

        const listingIds = studentListings.map(l => l._id); // Öğrencinin tüm ilan ID'leri

        // 2. Aggregation ile bu ilanlara gelen teklifleri ve işveren detaylarını birleştir
        const offers = await db.collection("is_teklifleri").aggregate([
            { $match: { studentListingId: { $in: listingIds } } }, // Sadece bu ilan ID'lerine gelenleri filtrele
            { $sort: { createdAt: -1 } },
            { $lookup: {
                    from: 'isverenler',
                    localField: 'jobListingId',
                    foreignField: '_id',
                    as: 'jobInfo' // Teklifin ait olduğu iş ilanı detayları
                }},
            { $unwind: { path: "$jobInfo", preserveNullAndEmptyArrays: true } } // İş ilanını objeye çevir
        ]).toArray();

        res.json(offers);
    } catch (err) {
        console.error('Teklifleri getirirken hata:', err);
        // Hata durumunda boş bir dizi döndür ki frontend çökmesin
        res.status(500).json({ message: 'Sunucuda teklif yükleme hatası oluştu.' });
    }
});
// server.js - İŞVEREN İÇİN BİLDİRİMLERİ GETİRME ROTASI (main.js'teki setupNotifications'ın çağırdığı)
app.get('/api/notifications', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'employer') {
        return res.status(403).json([]);
    }

    try {
        const userId = new ObjectId(req.session.user.id);

        // 1. İşverenin sahip olduğu, okunmamış başvuruları bul
        const notifications = await db.collection("applications").aggregate([
            { $match: { ownerId: userId, status: 'pending' } }, // İşverenin sahip olduğu, beklemede (pending) olanlar
            { $sort: { createdAt: -1 } },
            // 2. Başvuran öğrenci kullanıcı bilgilerini çek
            { $lookup: {
                    from: 'kullanicilar',
                    localField: 'applicantId',
                    foreignField: '_id',
                    as: 'applicantInfo'
                }},
            // 3. Öğrencinin (başvuruda kullanılan) staj ilanının detaylarını çek
            { $lookup: {
                    from: 'ogrenciler',
                    localField: 'studentListingId',
                    foreignField: '_id',
                    as: 'studentListingInfo'
                }},
            // Veri yapısını basitleştir
            { $unwind: { path: "$applicantInfo", preserveNullAndEmptyArrays: true } },
            { $unwind: { path: "$studentListingInfo", preserveNullAndEmptyArrays: true } },
            // Sadece gerekli alanları döndür
            { $project: {
                    _id: 1,
                    createdAt: 1,
                    applicantInfo: { name: 1, profilePicturePath: 1 },
                    studentListingInfo: { area: 1, city: 1, _id: 1 }
                }}
        ]).toArray();

        // NOT: Başvuru sayısı çok ise limit eklenebilir. Şu an limit yok.

        res.json(notifications);
    } catch (err) {
        console.error('Bildirimleri getirirken hata:', err);
        res.status(500).json([]);
    }
});

// server.js - İŞVEREN İÇİN BİLDİRİMLERİ TEMİZLEME ROTASI
app.post('/api/clear-notifications', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'employer') {
        return res.status(403).json({ success: false, message: 'Bu işlem için işveren olarak giriş yapmalısınız.' });
    }

    try {
        const userId = new ObjectId(req.session.user.id);

        // İşverenin sahip olduğu tüm "pending" (beklemede) başvuruları "read" (okundu) olarak işaretle
        await db.collection("applications").updateMany(
            { ownerId: userId, status: 'pending' },
            { $set: { status: 'read', readAt: new Date() } }
        );

        res.json({ success: true, message: 'Tüm bildirimler temizlendi.' });
    } catch (err) {
        console.error('Bildirimler temizlenirken hata:', err);
        res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' });
    }
});

// KULLANICI KAYIT & GİRİŞ (Diğerleri)
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, pass, role } = req.body;

        if (pass.length < 6) { return res.status(400).json({ success: false, message: 'Şifreniz en az 6 karakter olmalıdır.' }); }
        const existingUser = await db.collection("kullanicilar").findOne({ email });
        if (existingUser) { return res.status(400).json({ success: false, message: 'Bu e-posta adresi zaten kayıtlı.' }); }

        const hashedPassword = await bcrypt.hash(pass, 10);
        const verificationCode = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 haneli kod

        await db.collection("kullanicilar").insertOne({
            name,
            email,
            password: hashedPassword,
            role,
            isVerified: false, // KRİTİK: Doğrulanana kadar FALSE
            verificationCode: verificationCode,
            createdAt: new Date()
        });

        // Doğrulama e-postası gönderme
        const msg = {
            to: email,
            from: process.env.SENDGRID_VERIFIED_SENDER || 'no-reply@stajla.net',
            subject: 'STAJLA Hesap Doğrulama Kodunuz',
            html: `
                <p style="font-family: Arial, sans-serif;">Merhaba ${name},</p>
                <p style="font-family: Arial, sans-serif;">STAJLA hesabınızı aktive etmek için aşağıdaki kodu kullanın:</p>
                <h3 style="color: #FFD43B; font-family: Arial, sans-serif; font-size: 24px;">${verificationCode}</h3>
                <p style="font-family: Arial, sans-serif;">Bu kodu kaydolduğunuz sayfada girerek hesabınızı hemen aktif edebilirsiniz.</p>
            `,
        };
        try {
            await sgMail.send(msg);
            console.log(`Doğrulama e-postası ${email} adresine gönderildi.`);
        } catch (error) {
            // E-posta gönderimi başarısız olsa bile 500 hatası vermeyip kaydı kabul etmeliyiz.
            console.error('SendGrid E-posta GÖNDERİM HATASI:', error);
        }

        // Frontend'i doğrulama ekranına yönlendirmek için sadece success mesajı döndür
        res.json({ success: true, message: 'Kayıt başarılı! Doğrulama kodu e-posta adresinize gönderildi.' });
    } catch (err) {
        console.error('Kayıt/Doğrulama E-posta hatası:', err);
        res.status(500).json({ success: false, message: 'Kayıt sırasında bir hata oluştu. E-posta ayarlarınızı kontrol edin.' });
    }
});
// KULLANICI GİRİŞ ROTASI (DOĞRULAMA KONTROLÜ EKLENDİ)
app.post('/api/login', async (req, res) => {
    try {
        const { email, pass } = req.body;
        const user = await db.collection("kullanicilar").findOne({ email });

        if (!user || !(await bcrypt.compare(pass, user.password))) { return res.status(400).json({ success: false, message: 'Hatalı e-posta veya şifre.' }); }

        // KRİTİK KONTROL: Hesap doğrulanmış mı?
        if (!user.isVerified) {
            return res.status(403).json({ success: false, message: 'Hesabınız doğrulanmamış. Lütfen e-postanızı kontrol edin.' });
        }

        req.session.user = { id: user._id.toString(), name: user.name, email: user.email, role: user.role, profilePicturePath: user.profilePicturePath || null };
        res.json({ success: true, message: 'Giriş başarılı!' });
    } catch (err) { console.error('Giriş hatası:', err); res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' }); }
});

// YENİ: HESAP DOĞRULAMA ROTASI
app.post('/api/verify-email', async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ success: false, message: 'E-posta ve doğrulama kodu gereklidir.' });
        }

        const user = await db.collection("kullanicilar").findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
        }

        if (user.isVerified) {
            return res.json({ success: true, message: 'Hesabınız zaten doğrulanmış.' });
        }

        // Kodu kontrol et
        if (user.verificationCode !== code.toUpperCase()) {
            return res.status(400).json({ success: false, message: 'Geçersiz doğrulama kodu.' });
        }

        // Hesap doğrulandı!
        await db.collection("kullanicilar").updateOne(
            { _id: user._id },
            { $set: { isVerified: true }, $unset: { verificationCode: "" } }
        );

        // Doğrulama sonrası otomatik giriş
        req.session.user = { id: user._id, name: user.name, email: user.email, role: user.role };

        res.json({ success: true, message: 'Hesabınız başarıyla doğrulandı ve giriş yapıldı!' });

    } catch (err) {
        console.error('E-posta doğrulama hatası:', err);
        res.status(500).json({ success: false, message: 'Doğrulama sırasında sunucuda bir hata oluştu.' });
    }
});
// ÖĞRENCİ İLANI EKLEME (CV YÜKLEME)
app.post('/api/ogrenci-ilan', upload.single('cv'), async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') {
        if (req.file) { fs.unlinkSync(req.file.path); }
        return res.status(403).json({ success: false, message: 'Bu işlem için öğrenci olarak giriş yapmalısınız.' });
    }
    try {
        const yeniIlan = req.body;
        yeniIlan.createdBy = new ObjectId(req.session.user.id);
        yeniIlan.createdAt = new Date();
        if (req.file) {
            // resourceType: 'raw' olarak ayarlı
            yeniIlan.cvPath = await uploadToCloudinary(req.file.path, 'raw', 'cvs');
        } else { yeniIlan.cvPath = null; }
        await db.collection("ogrenciler").insertOne(yeniIlan);
        res.json({ success: true, message: 'İlan başarıyla eklendi!' });
    } catch (err) { console.error('Öğrenci ilan eklenirken hata:', err); res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' }); }
});

// İŞVEREN İLANI EKLEME
app.post('/api/isveren-ilan', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'employer') {
        return res.status(403).json({ success: false, message: 'Bu işlem için işveren olarak giriş yapmalısınız.' });
    }
    try {
        const yeniIlan = req.body;
        yeniIlan.createdBy = new ObjectId(req.session.user.id);
        yeniIlan.createdAt = new Date();
        await db.collection("isverenler").insertOne(yeniIlan);
        res.json({ success: true, message: 'İlan başarıyla eklendi!' });
    } catch (err) { console.error('İşveren ilan eklenirken hata:', err); res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' }); }
});

// PROFİL GÜNCELLEME (Geliştirme 8: Tam ve Güncel Versiyon)
app.post('/api/update-profile', upload.single('profilePicture'), async (req, res) => {
    if (!req.session.user) {
        if (req.file) { fs.unlinkSync(req.file.path); }
        return res.status(401).json({ success: false, message: 'Bu işlem için giriş yapmalısınız.' });
    }
    
    try {
        const { name, companyWebsite, companyBio, linkedin, github, portfolio } = req.body;
        const updateData = {};
        const userId = new ObjectId(req.session.user.id);
        const userRole = req.session.user.role;

        // 1. Ortak Alan: İsim
        if (name) { updateData.name = name; }

        // 2. Resim Yükleme
        if (req.file) {
            const resourceType = 'image'; 
            const folder = userRole === 'employer' ? 'company_logos' : 'avatars';
            updateData.profilePicturePath = await uploadToCloudinary(req.file.path, resourceType, folder);
        }

        // 3. İşverene Özel Alanlar
        if (userRole === 'employer') {
            if (companyWebsite !== undefined) updateData.companyWebsite = companyWebsite;
            if (companyBio !== undefined) updateData.companyBio = companyBio;
        }

        // 4. Öğrenciye Özel Alanlar (Sosyal Medya)
        if (userRole === 'student') {
            if (linkedin !== undefined) updateData.linkedin = linkedin;
            if (github !== undefined) updateData.github = github;
            if (portfolio !== undefined) updateData.portfolio = portfolio;
        }

        // 5. Güncelleme İşlemi
        if (Object.keys(updateData).length === 0) { 
            return res.json({ success: true, message: 'Güncellenecek bir bilgi gönderilmedi.' }); 
        }

        await db.collection("kullanicilar").updateOne({ _id: userId }, { $set: updateData });

        // Oturumu Güncelle
        if (updateData.name) { req.session.user.name = updateData.name; }
        if (updateData.profilePicturePath) { req.session.user.profilePicturePath = updateData.profilePicturePath; }

        res.json({ success: true, message: 'Profiliniz başarıyla güncellendi!', user: req.session.user });

    } catch (err) { 
        console.error('Profil güncelleme hatası:', err); 
        res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' }); 
    }
});

// ANASAYFA İLAN LİSTELEME
app.get('/api/ogrenci-ilanlari', async (req, res) => {
    try {
        const ilanlar = await db.collection("ogrenciler").aggregate([
            { $sort: { _id: -1 } },
            { $limit: 8 },
            { $lookup: { from: "kullanicilar", localField: "createdBy", foreignField: "_id", as: "sahipInfo" } },
            { $unwind: { path: "$sahipInfo", preserveNullAndEmptyArrays: true } }
        ]).toArray();
        res.json(ilanlar);
    } catch (err) { res.status(500).json([]); }
});
// YENİ EKLENEN ROTA: ANASAYFA İÇİN İŞVEREN İLANLARINI LİSTELEME
app.get('/api/job-listings', async (req, res) => {
    try {
        const ilanlar = await db.collection("isverenler").aggregate([
            { $sort: { createdAt: -1 } }, // Önce createdAt'e göre sırala (yeni tarihli olanlar)
            { $limit: 8 },
            { $lookup: { from: "kullanicilar", localField: "createdBy", foreignField: "_id", as: "sahipInfo" } },
            { $unwind: { path: "$sahipInfo", preserveNullAndEmptyArrays: true } }
        ]).toArray();
        res.json(ilanlar);
    } catch (err) { res.status(500).json([]); }
});
// ROL BAZLI ARAMA
app.get('/api/search', async (req, res) => {
    if (!req.session.user) { req.session.user = { role: 'guest' }; }

    let collectionName;
    if (req.session.user.role === 'student' || req.session.user.role === 'guest') {
        collectionName = 'isverenler';
    } else if (req.session.user.role === 'employer') {
        collectionName = 'ogrenciler';
    } else {
        collectionName = 'isverenler';
    }

    try {
        const { query, city, area } = req.query;
        let searchCriteria = {};

        if (query) {
            searchCriteria.$or = [
                { name: { $regex: query, $options: 'i' } },
                { dept: { $regex: query, $options: 'i' } },
                { desc: { $regex: query, $options: 'i' } },
                { company: { $regex: query, $options: 'i' } },
                { req: { $regex: query, $options: 'i' } }
            ].filter(c => Object.keys(c).length > 0);
        }

        if (city && city !== 'Şehir seç' && city !== 'Tüm Şehirler') { searchCriteria.city = city; }
        if (area && area !== 'Alan seç' && area !== 'Tüm Alanlar') { searchCriteria.area = area; }

        const results = await db.collection(collectionName).find(searchCriteria).sort({ createdAt: -1 }).toArray();
        res.json(results);
    } catch (err) { console.error('Arama yapılırken hata:', err); res.status(500).json([]); }
});

// PROFİL DETAYINI GETİRME (GÜNCELLENDİ: Sosyal Medya Linkleri Eklendi)
app.get('/api/student-profile/:id', async (req, res) => {
    try {
        const ilanId = new ObjectId(req.params.id);
        const studentListing = await db.collection("ogrenciler").findOne({ _id: ilanId });

        if (!studentListing) {
            return res.status(404).json({ success: false, message: 'Öğrenci ilanı bulunamadı.' });
        }

        const user = await db.collection("kullanicilar").findOne({ _id: studentListing.createdBy });

        const profileInfo = {
            name: studentListing.name,
            dept: studentListing.dept,
            city: studentListing.city,
            area: studentListing.area,
            desc: studentListing.desc,
            contact: studentListing.contact,
            cvPath: studentListing.cvPath,
            profilePicturePath: user ? user.profilePicturePath : null,
            listingId: studentListing._id,
            // --- EKLENEN KISIM ---
            linkedin: user ? user.linkedin : null,
            github: user ? user.github : null,
            portfolio: user ? user.portfolio : null
        };

        res.json({ success: true, profileInfo });

    } catch (err) {
        console.error('Öğrenci profili getirilirken hata:', err);
        res.status(500).json({ success: false, message: 'Bir hata oluştu.' });
    }
});
// --- DİĞER İŞLEVSEL ROTALAR (Silme, Başvuru, Teklifler, Şifre Sıfırlama) ---

app.get('/api/my-listings', async (req, res) => {
    if (!req.session.user) { return res.status(401).json({ success: false, message: 'Giriş yapılmadı.' }); }
    try {
        const userId = new ObjectId(req.session.user.id);
        let student = [], employer = [];
        if (req.session.user.role === 'student') {
            student = await db.collection("ogrenciler").find({ createdBy: userId }).sort({ createdAt: -1 }).toArray();
        } else if (req.session.user.role === 'employer') {
            employer = await db.collection("isverenler").find({ createdBy: userId }).sort({ createdAt: -1 }).toArray();
        }
        res.json({ student, employer });
    } catch (err) { console.error('Kullanıcının ilanları getirilirken hata:', err); res.status(500).json({ student: [], employer: [] }); }
});

app.post('/api/delete-listing', async (req, res) => {
    if (!req.session.user) { return res.status(401).json({ success: false, message: 'Bu işlem için giriş yapmalısınız.' }); }
    try {
        const { id, type } = req.body;
        const collectionName = type === 'student' ? 'ogrenciler' : 'isverenler';
        const listing = await db.collection(collectionName).findOne({ _id: new ObjectId(id) });
        if (!listing || listing.createdBy.toString() !== req.session.user.id.toString()) {
            return res.status(403).json({ success: false, message: 'Yetkiniz yok veya ilan bulunamadı.' });
        }
        await db.collection(collectionName).deleteOne({ _id: new ObjectId(id) });
        res.json({ success: true, message: 'İlan başarıyla silindi.' });
    } catch (err) { res.status(500).json({ success: false, message: 'Bir hata oluştu.' }); }
});

// YENİ EKLENDİ: İlanı Favorilere Ekle/Çıkar (Toggle)
app.post('/api/toggle-save', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Favorilere eklemek için giriş yapmalısınız.' });
    }

    try {
        const { listingId } = req.body;
        const userId = new ObjectId(req.session.user.id);
        const listingObjectId = new ObjectId(listingId);

        // Önce kullanıcının verisini çekelim
        const user = await db.collection("kullanicilar").findOne({ _id: userId });
        
        // Kullanıcının 'savedListings' dizisi var mı ve bu ilan içinde mi?
        const isSaved = user.savedListings && user.savedListings.some(id => id.toString() === listingId);

        if (isSaved) {
            // Zaten kayıtlıysa -> ÇIKAR ($pull)
            await db.collection("kullanicilar").updateOne(
                { _id: userId },
                { $pull: { savedListings: listingObjectId } }
            );
            res.json({ success: true, status: 'removed', message: 'İlan favorilerden çıkarıldı.' });
        } else {
            // Kayıtlı değilse -> EKLE ($addToSet - aynı şeyi iki kere eklemez)
            await db.collection("kullanicilar").updateOne(
                { _id: userId },
                { $addToSet: { savedListings: listingObjectId } }
            );
            res.json({ success: true, status: 'added', message: 'İlan favorilere eklendi!' });
        }

    } catch (err) {
        console.error('Favori işlemi hatası:', err);
        res.status(500).json({ success: false, message: 'İşlem sırasında hata oluştu.' });
    }
});

// YENİ EKLENDİ: Kullanıcının Favori İlan ID'lerini Getir (Kalpleri boyamak için)
app.get('/api/my-saved-ids', async (req, res) => {
    if (!req.session.user) { return res.json([]); }
    try {
        const user = await db.collection("kullanicilar").findOne(
            { _id: new ObjectId(req.session.user.id) },
            { projection: { savedListings: 1 } }
        );
        res.json(user.savedListings || []);
    } catch (err) {
        res.json([]);
    }
});
// YENİ EKLENDİ: Kaydedilen İlanların DETAYLARINI Getir (Profil sayfası için)
app.get('/api/my-saved-listings-details', async (req, res) => {
    if (!req.session.user) { return res.json({ success: false }); }
    
    try {
        const user = await db.collection("kullanicilar").findOne({ _id: new ObjectId(req.session.user.id) });
        const savedIds = user.savedListings || [];

        if (savedIds.length === 0) { return res.json([]); }

        // Hem öğrenci hem işveren ilanlarında bu ID'leri ara
        // (Kullanıcı hem iş hem stajyer ilanı kaydetmiş olabilir)
        const savedJobs = await db.collection("isverenler").find({ _id: { $in: savedIds } }).sort({ createdAt: -1 }).toArray();
        const savedStudents = await db.collection("ogrenciler").find({ _id: { $in: savedIds } }).sort({ createdAt: -1 }).toArray();

        // Hepsini tek bir listede birleştir
        const allSaved = [...savedJobs, ...savedStudents];
        
        res.json(allSaved);
    } catch (err) {
        console.error('Favoriler çekilirken hata:', err);
        res.status(500).json([]);
    }
});

// YENİ EKLENEN ROTA: DÜZENLENECEK İLANIN DETAYLARINI GETİRME
app.get('/api/get-listing-details', async (req, res) => {
    if (!req.session.user) { return res.status(401).json({ success: false, message: 'Giriş yapmalısınız.' }); }

    const { id, type } = req.query; // URL'den ?id=...&type=... olarak gelir
    const collectionName = type === 'student' ? 'ogrenciler' : 'isverenler';
    const userId = new ObjectId(req.session.user.id);

    try {
        const listing = await db.collection(collectionName).findOne({ _id: new ObjectId(id) });

        if (!listing) { return res.status(404).json({ success: false, message: 'İlan bulunamadı.' }); }

        // Güvenlik: Kullanıcı sadece kendi ilanını düzenleyebilir
        if (listing.createdBy.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: 'Bu ilanı düzenleme yetkiniz yok.' });
        }

        res.json({ success: true, listing }); // İlanın mevcut verilerini JSON olarak döndür
    } catch (err) {
        res.status(500).json({ success: false, message: 'İlan yüklenirken hata oluştu.' });
    }
});

// YENİ EKLENEN ROTA: İLANI GÜNCELLEME
app.post('/api/update-listing', async (req, res) => {
    if (!req.session.user) { return res.status(401).json({ success: false, message: 'Giriş yapmalısınız.' }); }

    const { id, type, data } = req.body; // main.js'den güncel veriler 'data' objesi içinde gelecek
    const collectionName = type === 'student' ? 'ogrenciler' : 'isverenler';
    const userId = new ObjectId(req.session.user.id);

    try {
        const listing = await db.collection(collectionName).findOne({ _id: new ObjectId(id) });

        if (!listing) { return res.status(404).json({ success: false, message: 'İlan bulunamadı.' }); }

        // Güvenlik: Kullanıcı sadece kendi ilanını güncelleyebilir
        if (listing.createdBy.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: 'Bu ilanı güncelleme yetkiniz yok.' });
        }

        // Veritabanında güncelleme yap
        await db.collection(collectionName).updateOne({ _id: new ObjectId(id) }, { $set: data });

        res.json({ success: true, message: 'İlan başarıyla güncellendi!' });
    } catch (err) {
        console.error("İlan güncelleme hatası:", err);
        res.status(500).json({ success: false, message: 'Güncelleme sırasında bir hata oluştu.' });
    }
});
app.get('/api/my-student-listing', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') { return res.json(null); }
    try { const listing = await db.collection("ogrenciler").findOne({ createdBy: new ObjectId(req.session.user.id) }); res.json(listing); } catch (err) { res.json(null); }
});

app.post('/api/apply', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') { return res.status(403).json({ success: false, message: 'Bu işlem için öğrenci olarak giriş yapmalısınız.' }); }
    try {
        const { listingId, studentListingId } = req.body;
        const studentId = new ObjectId(req.session.user.id);
        const listing = await db.collection("isverenler").findOne({ _id: new ObjectId(listingId) });
        if (!listing) { return res.status(404).json({ success: false, message: 'İlan bulunamadı.' }); }
        const existingApplication = await db.collection("applications").findOne({ listingId: new ObjectId(listingId), applicantId: studentId });
        if (existingApplication) { return res.status(400).json({ success: false, message: 'Bu ilana zaten başvurdunuz.' }); }
        const newApplication = { applicantId: studentId, listingId: new ObjectId(listingId), ownerId: listing.createdBy, studentListingId: new ObjectId(studentListingId), status: 'pending', createdAt: new Date() };
        await db.collection("applications").insertOne(newApplication);
        res.json({ success: true, message: 'Başvurunuz başarıyla gönderildi!' });
    } catch (err) { console.error('Başvuru sırasında hata:', err); res.status(500).json({ success: false, message: 'Bir hata oluştu.' }); }
});
// YENİ EKLENEN ROTA: İŞVERENDEN ÖĞRENCİYE İŞ TEKLİFİ GÖNDERME
app.post('/api/send-offer', async (req, res) => {
    // 1. Sadece işverenlerin bu rotayı kullanabildiğinden emin ol
    if (!req.session.user || req.session.user.role !== 'employer') {
        return res.status(403).json({ success: false, message: 'Bu işlem için işveren olarak giriş yapmalısınız.' });
    }

    try {
        const { studentId, jobListingId } = req.body; // main.js'den 'studentId' olarak geliyor (aslında studentListingId)
        const employerId = new ObjectId(req.session.user.id);

        // 2. Gelen ID'leri doğrula
        if (!studentId || !jobListingId) {
            return res.status(400).json({ success: false, message: 'Eksik bilgi: Öğrenci veya iş ilanı ID\'si bulunamadı.' });
        }

        const studentListingIdObj = new ObjectId(studentId);
        const jobListingIdObj = new ObjectId(jobListingId);

        // 3. Teklif edilen iş ilanının bu işverene ait olduğunu doğrula
        const jobListing = await db.collection("isverenler").findOne({ _id: jobListingIdObj, createdBy: employerId });
        if (!jobListing) {
            return res.status(403).json({ success: false, message: 'Bu iş ilanı size ait değil veya bulunamadı.' });
        }

        // 4. Teklif gönderilen öğrenci ilanının mevcut olduğunu doğrula
        const studentListing = await db.collection("ogrenciler").findOne({ _id: studentListingIdObj });
        if (!studentListing) {
            return res.status(404).json({ success: false, message: 'Teklif gönderilmek istenen öğrenci ilanı bulunamadı.' });
        }

        // 5. Bu teklifin daha önce gönderilip gönderilmediğini kontrol et
        const existingOffer = await db.collection("is_teklifleri").findOne({
            studentListingId: studentListingIdObj,
            jobListingId: jobListingIdObj
        });

        if (existingOffer) {
            return res.status(400).json({ success: false, message: 'Bu öğrenciye bu ilan için zaten bir teklif göndermişsiniz.' });
        }

        // 6. Teklifi 'is_teklifleri' koleksiyonuna kaydet
        const newOffer = {
            studentListingId: studentListingIdObj,      // Öğrencinin ilan ID'si
            jobListingId: jobListingIdObj,          // İşverenin ilan ID'si
            employerId: employerId,                 // Teklifi gönderen işverenin KULLANICI ID'si
            studentOwnerId: studentListing.createdBy, // Teklifi alan öğrencinin KULLANCI ID'si
            status: 'pending',
            createdAt: new Date()
        };

        await db.collection("is_teklifleri").insertOne(newOffer);

        res.json({ success: true, message: 'Teklif başarıyla gönderildi!' });

    } catch (err) {
        console.error('Teklif gönderme hatası:', err);
        res.status(500).json({ success: false, message: 'Teklif gönderilirken sunucuda bir hata oluştu.' });
    }
});
// server.js'te API ROTALARI bölümüne bu kodu ekleyin:
// --- YENİ EKLENEN: ADMIN PANELİ VE GÜVENLİK ---

// 1. Admin Sayfasına Giriş Rotası (Güvenlik Kontrolü)
app.get('/admin', (req, res) => {
    // Sadece giriş yapmış VE e-postası 'alisulmaz@gmail.com' olan kişi girebilir
    // (Eğer farklı bir mail ile yönetecekseniz burayı değiştirebilirsiniz)
    if (!req.session.user || req.session.user.email !== 'alisulmaz@gmail.com') {
        return res.redirect('/index.html'); // Yetkisiz kişiyi anasayfaya at
    }
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 2. Admin İstatistikleri API'sı
app.get('/api/admin/stats', async (req, res) => {
    // API için de güvenlik kontrolü şart
    if (!req.session.user || req.session.user.email !== 'alisulmaz@gmail.com') {
        return res.status(403).json({ success: false, message: 'Yetkisiz erişim.' });
    }

    try {
        const totalUsers = await db.collection("kullanicilar").countDocuments({});
        const totalStudents = await db.collection("ogrenciler").countDocuments({});
        const totalJobs = await db.collection("isverenler").countDocuments({});
        const totalArticles = await db.collection("articles").countDocuments({});

        res.json({
            success: true,
            stats: {
                users: totalUsers,
                students: totalStudents,
                jobs: totalJobs,
                articles: totalArticles
            }
        });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// 3. Blog Yazısı Ekleme API'sı
app.post('/api/admin/add-blog', async (req, res) => {
    if (!req.session.user || req.session.user.email !== 'alisulmaz@gmail.com') {
        return res.status(403).json({ success: false, message: 'Yetkisiz erişim.' });
    }

    try {
        const { title, description, slug, content } = req.body;
        
        // Sıra numarası (order) için en son eklenen makaleyi bulup +1 ekleyelim
        const lastArticle = await db.collection("articles").find().sort({ order: -1 }).limit(1).toArray();
        const nextOrder = (lastArticle.length > 0 && lastArticle[0].order) ? lastArticle[0].order + 1 : 1;

        await db.collection("articles").insertOne({
            order: nextOrder,
            slug: slug, // URL'de görünecek kısım (örn: staj-tuyolari)
            title: title,
            description: description,
            content: content // HTML içerik
        });

        res.json({ success: true, message: 'Blog yazısı başarıyla yayınlandı!' });
    } catch (err) {
        console.error("Blog ekleme hatası:", err);
        res.status(500).json({ success: false, message: 'Bir hata oluştu.' });
    }
});

// Şifre Sıfırlama Rotaları
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await db.collection("kullanicilar").findOne({ email });
        if (!user) { return res.json({ success: true, message: 'Eğer bu e-posta adresi sistemimizde kayıtlıysa, şifre sıfırlama talimatları size gönderilecektir.' }); }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiration = Date.now() + 3600000;
        await db.collection("kullanicilar").updateOne({ _id: user._id }, { $set: { resetToken, tokenExpiration } });

        const resetLink = `${req.protocol}://${req.get('host')}/reset-password.html?token=${resetToken}&email=${email}`;
        const msg = { to: email, from: process.env.SENDGRID_VERIFIED_SENDER || 'no-reply@stajla.net', subject: 'STAJLA - Şifre Sıfırlama Talebi', html: `<p>Şifrenizi sıfırlamak için aşağıdaki linke tıklayın. <a href="${resetLink}">Şifremi Sıfırla</a></p>`, };
        await sgMail.send(msg);

        res.json({ success: true, message: 'E-posta adresinize şifre sıfırlama linki gönderildi.' });
    } catch (err) { console.error('Şifre sıfırlama hatası:', err); res.status(500).json({ success: false, message: 'E-posta gönderimi sırasında bir hata oluştu.' }); }
});

app.post('/api/reset-password', async (req, res) => {
    try {
        const { email, token, newPassword } = req.body;
        const user = await db.collection("kullanicilar").findOne({ email });

        if (!user || user.resetToken !== token || user.tokenExpiration < Date.now() || newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'Geçersiz veya süresi dolmuş şifre sıfırlama linki ya da şifre çok kısa.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.collection("kullanicilar").updateOne({ _id: user._id }, { $set: { password: hashedPassword }, $unset: { resetToken: "", tokenExpiration: "" } });

        res.json({ success: true, message: 'Şifreniz başarıyla sıfırlandı. Şimdi giriş yapabilirsiniz.' });
    } catch (err) { console.error('Şifre sıfırlama hatası:', err); res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' }); }
});
// --- YENİ EKLENEN ROTALAR: DİNAMİK BLOG/KARİYER REHBERİ ---

// Rota 1: Tüm makalelerin listesini getir (blog.html için)
// Rota 1: Tüm makalelerin listesini getir (SAYFALANDIRMA EKLENDİ)
app.get('/api/articles', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // URL'den ?page=X değerini al, yoksa 1 kabul et
        const articlesPerPage = 8; // Sayfa başına 8 makale göster (2'li sütun için ideal)
        const skip = (page - 1) * articlesPerPage;

        // Veritabanından toplam makale sayısını da almamız gerekiyor
        const totalArticles = await db.collection("articles").countDocuments({});

        // Sorguyu güncelliyoruz: .skip() ve .limit() eklendi
        const articles = await db.collection("articles").find({})
            .sort({ order: 1 }) // Sıralama kalsın
            .skip(skip) // Önceki sayfaları atla
            .limit(articlesPerPage) // Sadece 8 tane al
            .toArray();

        // Sunucu cevabını güncelliyoruz: Artık toplam sayfa sayısını da yolluyoruz
        res.json({
            articles: articles,
            totalPages: Math.ceil(totalArticles / articlesPerPage),
            currentPage: page
        });
    } catch (err) {
        console.error('Makaleler çekilirken hata:', err);
        res.status(500).json({ articles: [], totalPages: 0, currentPage: 1 });
    }
});

// Rota 2: Tek bir makalenin detayını getir (makale-detay.html için)
app.get('/api/article/:slug', async (req, res) => {
    try {
        const { slug } = req.params; // URL'den 'cv_hazirlama' gibi slug'ı al
        const article = await db.collection("articles").findOne({ slug: slug });

        if (!article) {
            return res.status(404).json({ success: false, message: 'Makale bulunamadı.' });
        }
        res.json({ success: true, article });
    } catch (err) {
        console.error('Makale detayı çekilirken hata:', err);
        res.status(500).json({ success: false, message: 'Sunucu hatası oluştu.' });
    }
});
// --- 7. VERİTABANI BAĞLANTISI VE SUNUCU BAŞLATMA ---
async function connectToDb() {
    try {
        await client.connect();
        db = client.db("StajlaDB");
        console.log("MongoDB'ye başarıyla bağlanıldı!");
        app.listen(PORT, () => { console.log(`Sunucu ${PORT} portunda çalışıyor.`); });
    } catch (err) {
        console.error("Veritabanı bağlantı hatası:", err);
        process.exit(1);
    }
}

connectToDb();