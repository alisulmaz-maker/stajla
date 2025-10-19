require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Dosya işlemleri için gerekli
const cloudinary = require('cloudinary').v2; // YENİ: Cloudinary Modülü

// Cloudinary Konfigürasyonu
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const app = express();
const PORT = process.env.PORT || 3000;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error("HATA: DATABASE_URL bulunamadı. Lütfen .env dosyanızı veya Render'daki ayarlarınızı kontrol edin.");
    process.exit(1);
}

const client = new MongoClient(connectionString);
let db;

// MULTER VE GEÇİCİ DEPOLAMA AYARLARI (Cloudinary'ye yüklemeden önce)
const tempDir = 'public/temp_uploads';
// Klasör yoksa oluştur
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// Tüm dosya yüklemeleri için GEÇİCİ disk depolaması
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, tempDir);
    },
    filename: (req, file, cb) => {
        // Benzersiz dosya adı oluşturma
        cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });
// ESKİ YEREL AVATAR DEPOLAMA KODLARI KALDIRILMIŞTIR.

// YARDIMCI FONKSİYON: Cloudinary'ye yükle ve yerel dosyayı sil
async function uploadToCloudinary(filePath, resourceType, folderName) {
    try {
        const result = await cloudinary.uploader.upload(filePath, {
            resource_type: resourceType, // 'image' veya 'raw' (CV'ler için)
            folder: `stajla/${folderName}`, // Cloudinary'de klasör yolu
            quality: "auto",
            fetch_format: "auto"
        });
        // Yükleme sonrası geçici dosyayı siliyoruz.
        fs.unlinkSync(filePath);
        return result.secure_url; // Cloudinary'nin kalıcı URL'sini döndür
    } catch (error) {
        // Hata durumunda da geçici dosyayı temizleme
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        console.error("Cloudinary yükleme hatası:", error);
        throw new Error("Dosya yüklenirken bir sorun oluştu: " + error.message);
    }
}


// E-posta gönderimi için yapılandırma
// SendGrid kullanılıyorsa
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Middleware'ler
app.use(express.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Oturum (Session) Yapılandırması
const sessionStore = MongoStore.create({
    mongoUrl: connectionString,
    dbName: 'StajlaDB',
    collectionName: 'sessions',
    ttl: 14 * 24 * 60 * 60, // 14 gün
    autoRemove: 'interval',
    autoRemoveInterval: 10 // Dakika
});

app.use(session({
    secret: process.env.SESSION_SECRET || 'gizli-anahtar-gerekir',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // 1 hafta
        secure: process.env.NODE_ENV === 'production' // Sadece üretimde HTTPS üzerinden
    }
}));


// HTML Dosyalarını Yönlendirme (Temel Rotalar)
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });
app.get('/index.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });
app.get('/giris.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'giris.html')); });
app.get('/kayit.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'kayit.html')); });
app.get('/profil.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'profil.html')); });
app.get('/profil-duzenle.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'profil-duzenle.html')); });
app.get('/ogrenci-ilan.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'ogrenci-ilan.html')); });
app.get('/isveren-ilan.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'isveren-ilan.html')); });
app.get('/ilan-detay.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'ilan-detay.html')); });
app.get('/ogrenci-profil.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'ogrenci-profil.html')); });
app.get('/edit-listing.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'edit-listing.html')); });
app.get('/is-tekliflerim.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'is-tekliflerim.html')); });
app.get('/iletisim.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'iletisim.html')); });
app.get('/forgot-password.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'forgot-password.html')); });
app.get('/reset-password.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'reset-password.html')); });

// ******************************************************
// API ROTALARI
// ******************************************************

// 1. Kullanıcı Kayıt
app.post('/api/kayit', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Şifreniz en az 6 karakter olmalıdır.' });
        }

        const existingUser = await db.collection("kullanicilar").findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Bu e-posta adresi zaten kayıtlı.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await db.collection("kullanicilar").insertOne({
            name,
            email,
            password: hashedPassword,
            role,
            createdAt: new Date(),
            isVerified: false // E-posta doğrulama eklenebilir
        });

        // Otomatik Giriş
        req.session.user = {
            id: result.insertedId,
            name: name,
            email: email,
            role: role
        };

        res.json({ success: true, message: 'Kayıt başarılı!', user: req.session.user });
    } catch (err) {
        console.error('Kayıt hatası:', err);
        res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' });
    }
});

// 2. Kullanıcı Giriş
app.post('/api/giris', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await db.collection("kullanicilar").findOne({ email });

        if (!user) {
            return res.status(400).json({ success: false, message: 'Geçersiz e-posta veya şifre.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(400).json({ success: false, message: 'Geçersiz e-posta veya şifre.' });
        }

        // Oturum başlat
        req.session.user = {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            profilePicturePath: user.profilePicturePath || null // Profil resmi yolu
        };

        res.json({ success: true, message: 'Giriş başarılı!', user: req.session.user });
    } catch (err) {
        console.error('Giriş hatası:', err);
        res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' });
    }
});

// 3. Oturumu Kontrol Et
app.get('/api/check-session', (req, res) => {
    if (req.session.user) {
        res.json({ success: true, user: req.session.user });
    } else {
        res.json({ success: false, user: null });
    }
});

// 4. Çıkış Yap
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Çıkış yapılırken hata oluştu.' });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true, message: 'Çıkış başarılı.' });
    });
});

// 5. Öğrenci İlanı Ekleme (CV YÜKLEME DAHİL)
// Multer'ın geçici depolaması ve ardından Cloudinary'ye yükleme
app.post('/api/ogrenci-ilan', upload.single('cv'), async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') {
        // Yükleme sonrası geçici dosyayı temizlemek için ek kontrol
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        return res.status(403).json({ success: false, message: 'Bu işlem için öğrenci olarak giriş yapmalısınız.' });
    }

    try {
        const yeniIlan = req.body;
        yeniIlan.createdBy = new ObjectId(req.session.user.id);
        yeniIlan.createdAt = new Date();
        yeniIlan.reportCount = 0; // Bildirim sayacı

        if (req.file) {
            // YENİ: Cloudinary'ye yükle (PDF'ler için 'raw' tipi ve 'cvs' klasörünü kullan)
            const cvUrl = await uploadToCloudinary(req.file.path, 'raw', 'cvs');
            yeniIlan.cvPath = cvUrl;
        } else {
            yeniIlan.cvPath = null;
        }

        await db.collection("ogrenciler").insertOne(yeniIlan);
        res.json({ success: true, message: 'İlan başarıyla eklendi!' });
    } catch (err) {
        console.error('Öğrenci ilan eklenirken hata:', err);
        res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' });
    }
});

// 6. İşveren İlanı Ekleme
app.post('/api/isveren-ilan', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'employer') {
        return res.status(403).json({ success: false, message: 'Bu işlem için işveren olarak giriş yapmalısınız.' });
    }
    try {
        const yeniIlan = req.body;
        yeniIlan.createdBy = new ObjectId(req.session.user.id);
        yeniIlan.createdAt = new Date();
        yeniIlan.reportCount = 0;
        await db.collection("isverenler").insertOne(yeniIlan);
        res.json({ success: true, message: 'İlan başarıyla eklendi!' });
    } catch (err) {
        console.error('İşveren ilan eklenirken hata:', err);
        res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' });
    }
});

// 7. Öğrenci İlanlarını Getirme (Anasayfa)
app.get('/api/ogrenci-ilanlari', async (req, res) => {
    try {
        const ilanlar = await db.collection("ogrenciler").find({}).sort({ createdAt: -1 }).toArray();
        res.json(ilanlar);
    } catch (err) {
        console.error('İlanlar getirilirken hata:', err);
        res.status(500).json([]);
    }
});

// 8. İşveren İlanlarını Getirme
app.get('/api/isveren-ilanlari', async (req, res) => {
    try {
        const ilanlar = await db.collection("isverenler").find({}).sort({ createdAt: -1 }).toArray();
        res.json(ilanlar);
    } catch (err) {
        console.error('İlanlar getirilirken hata:', err);
        res.status(500).json([]);
    }
});

// 9. İlan Detayını Getirme
app.get('/api/ilan-detay/:id', async (req, res) => {
    try {
        const ilanId = new ObjectId(req.params.id);
        const type = req.query.type;
        const collectionName = type === 'student' ? 'ogrenciler' : 'isverenler';

        const ilan = await db.collection(collectionName).findOne({ _id: ilanId });

        if (!ilan) {
            return res.status(404).json({ success: false, message: 'İlan bulunamadı.' });
        }

        res.json({ success: true, ilan });
    } catch (err) {
        console.error('İlan detayı getirilirken hata:', err);
        res.status(500).json({ success: false, message: 'Bir hata oluştu.' });
    }
});

// 10. Arama Rotası
app.get('/api/search', async (req, res) => {
    try {
        const { query, type, city, area } = req.query;
        let searchCriteria = {};
        const collectionName = type === 'student' ? 'ogrenciler' : 'isverenler';

        if (query) {
            searchCriteria.$or = [
                { name: { $regex: query, $options: 'i' } },
                { company: { $regex: query, $options: 'i' } },
                { dept: { $regex: query, $options: 'i' } },
                { desc: { $regex: query, $options: 'i' } },
                { req: { $regex: query, $options: 'i' } }
            ];
        }

        if (city && city !== 'Tüm Şehirler') {
            searchCriteria.city = city;
        }

        if (area && area !== 'Tüm Alanlar') {
            searchCriteria.area = area;
        }

        const results = await db.collection(collectionName).find(searchCriteria).sort({ createdAt: -1 }).toArray();
        res.json(results);
    } catch (err) {
        console.error('Arama yapılırken hata:', err);
        res.status(500).json([]);
    }
});

// 11. Profil Güncelleme (RESİM YÜKLEME DAHİL)
// Multer'ın geçici depolaması ve ardından Cloudinary'ye yükleme
app.post('/api/update-profile', upload.single('profilePicture'), async (req, res) => {
    // 1. Kullanıcı giriş yapmış mı diye kontrol et
    if (!req.session.user) {
        // Yükleme sonrası geçici dosyayı temizlemek için ek kontrol
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        return res.status(401).json({ success: false, message: 'Bu işlem için giriş yapmalısınız.' });
    }

    try {
        const { name } = req.body;
        const updateData = {};
        if (name) { updateData.name = name; }

        if (req.file) {
            // YENİ: Cloudinary'ye yükle (Resimler için 'image' tipi ve 'avatars' klasörünü kullan)
            const profilePictureUrl = await uploadToCloudinary(req.file.path, 'image', 'avatars');
            updateData.profilePicturePath = profilePictureUrl;
        }

        // Eğer güncellenecek bir şey yoksa, işlem yapma
        if (Object.keys(updateData).length === 0) {
            return res.json({ success: true, message: 'Güncellenecek bir bilgi gönderilmedi.' });
        }

        const userId = new ObjectId(req.session.user.id);
        await db.collection("kullanicilar").updateOne({ _id: userId }, { $set: updateData });

        // Oturum (session) bilgilerini de anında güncelle
        if (updateData.name) {
            req.session.user.name = updateData.name;
        }
        if (updateData.profilePicturePath) {
            req.session.user.profilePicturePath = updateData.profilePicturePath;
        }

        res.json({ success: true, message: 'Profiliniz başarıyla güncellendi!', user: req.session.user });

    } catch (err) {
        console.error('Profil güncelleme sırasında hata:', err);
        res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' });
    }
});

// 12. Kullanıcı Bilgisini Getirme
app.get('/api/user-info', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Giriş yapılmadı.' });
    }
    try {
        const userId = new ObjectId(req.session.user.id);
        const user = await db.collection("kullanicilar").findOne({ _id: userId });
        if (!user) {
            return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
        }
        // Şifreyi göndermemeye dikkat edin
        const userInfo = {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            profilePicturePath: user.profilePicturePath || null
        };
        res.json({ success: true, user: userInfo });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' });
    }
});

// 13. Kullanıcının Kendi İlanlarını Getirme
app.get('/api/my-listings', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Giriş yapılmadı.' });
    }
    try {
        const userId = new ObjectId(req.session.user.id);
        let listings = [];
        const query = { createdBy: userId };

        if (req.session.user.role === 'student') {
            listings = await db.collection("ogrenciler").find(query).sort({ createdAt: -1 }).toArray();
        } else if (req.session.user.role === 'employer') {
            listings = await db.collection("isverenler").find(query).sort({ createdAt: -1 }).toArray();
        }

        res.json(listings);
    } catch (err) {
        console.error('Kullanıcının ilanları getirilirken hata:', err);
        res.status(500).json([]);
    }
});

// 14. İlan Düzenleme
app.post('/api/edit-listing/:id', async (req, res) => {
    if (!req.session.user) { return res.status(401).json({ success: false, message: 'Bu işlem için giriş yapmalısınız.' }); }

    try {
        const listingId = new ObjectId(req.params.id);
        const updatedData = req.body;
        const type = updatedData.type;
        delete updatedData.type; // Type bilgisini veritabanına kaydetme

        const collectionName = type === 'student' ? 'ogrenciler' : 'isverenler';

        const listing = await db.collection(collectionName).findOne({ _id: listingId });

        if (!listing) { return res.status(404).json({ success: false, message: 'İlan bulunamadı.' }); }
        if (listing.createdBy.toString() !== req.session.user.id.toString()) {
            return res.status(403).json({ success: false, message: 'Bu ilanı düzenleme yetkiniz yok.' });
        }

        await db.collection(collectionName).updateOne({ _id: listingId }, { $set: updatedData });
        res.json({ success: true, message: 'İlan başarıyla güncellendi.' });

    } catch (err) {
        console.error('İlan düzenleme hatası:', err);
        res.status(500).json({ success: false, message: 'Bir hata oluştu.' });
    }
});

// 15. İlan Silme
app.post('/api/delete-listing', async (req, res) => {
    if (!req.session.user) { return res.status(401).json({ success: false, message: 'Bu işlem için giriş yapmalısınız.' }); }

    try {
        const { id, type } = req.body;
        const collectionName = type === 'student' ? 'ogrenciler' : 'isverenler';

        const listing = await db.collection(collectionName).findOne({ _id: new ObjectId(id) });

        if (!listing) { return res.status(404).json({ success: false, message: 'İlan bulunamadı.' }); }

        if (listing.createdBy.toString() !== req.session.user.id.toString()) {
            return res.status(403).json({ success: false, message: 'Bu ilanı silme yetkiniz yok.' });
        }

        await db.collection(collectionName).deleteOne({ _id: new ObjectId(id) });
        res.json({ success: true, message: 'İlan başarıyla silindi.' });

    } catch (err) {
        res.status(500).json({ success: false, message: 'Bir hata oluştu.' });
    }
});

// 16. İlan Bildirme
app.post('/api/report-listing', async (req, res) => {
    if (!req.session.user) { return res.status(401).json({ success: false, message: 'İçerik bildirmek için giriş yapmalısınız.' }); }

    try {
        const { id, type } = req.body;
        const collectionName = type === 'student' ? 'ogrenciler' : 'isverenler';

        await db.collection(collectionName).updateOne(
            { _id: new ObjectId(id) },
            { $inc: { reportCount: 1 } }
        );

        res.json({ success: true, message: 'İlan bildiriminiz alınmıştır. Teşekkür ederiz.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Bir hata oluştu.' });
    }
});


// 17. Öğrenci Profili Detayını Getirme (İlan ID'sine göre)
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
            cvPath: studentListing.cvPath, // Cloudinary URL'si
            profilePicturePath: user ? user.profilePicturePath : null, // Cloudinary URL'si
            listingId: studentListing._id
        };

        res.json({ success: true, profileInfo });

    } catch (err) {
        console.error('Öğrenci profili getirilirken hata:', err);
        res.status(500).json({ success: false, message: 'Bir hata oluştu.' });
    }
});

// 18. İş Teklifi Gönderme (İşveren tarafından)
app.get('/api/my-job-listings', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'employer') {
        return res.status(403).json({ success: false, message: 'Bu işlem için işveren olarak giriş yapmalısınız.' });
    }
    try {
        const userId = new ObjectId(req.session.user.id);
        const jobListings = await db.collection("isverenler")
            .find({ createdBy: userId })
            .project({ _id: 1, company: 1, area: 1 }) // Sadece gerekli alanları çek
            .toArray();

        res.json({ success: true, listings: jobListings });
    } catch (err) {
        console.error('İşveren ilanları getirilirken hata:', err);
        res.status(500).json({ success: false, message: 'Bir hata oluştu.' });
    }
});

// 19. Teklifi Kaydetme
app.post('/api/send-offer', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'employer') {
        return res.status(403).json({ success: false, message: 'Bu işlem için işveren olarak giriş yapmalısınız.' });
    }
    try {
        const { studentId, jobListingId } = req.body;

        if (!studentId || !jobListingId) {
            return res.status(400).json({ success: false, message: 'Eksik parametreler.' });
        }

        const studentObjectId = new ObjectId(studentId);
        const jobObjectId = new ObjectId(jobListingId);
        const employerId = new ObjectId(req.session.user.id);

        // Teklifin zaten gönderilip gönderilmediğini kontrol et
        const existingOffer = await db.collection("is_teklifleri").findOne({
            studentListingId: studentObjectId,
            jobListingId: jobObjectId
        });

        if (existingOffer) {
            return res.json({ success: false, message: 'Bu ilana zaten teklif gönderdiniz.' });
        }

        await db.collection("is_teklifleri").insertOne({
            studentListingId: studentObjectId, // Öğrencinin ilanı (profili)
            jobListingId: jobObjectId,       // İşverenin ilanı
            employerId: employerId,          // Teklifi gönderen işveren
            createdAt: new Date(),
            status: 'pending'                // 'pending', 'accepted', 'rejected'
        });

        res.json({ success: true, message: 'İş teklifi başarıyla gönderildi!' });
    } catch (err) {
        console.error('Teklif gönderim hatası:', err);
        res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' });
    }
});

// 20. İş Tekliflerini Getirme (Öğrenci için)
app.get('/api/get-my-offers', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') {
        return res.status(403).json({ success: false, message: 'Bu işlem için öğrenci olarak giriş yapmalısınız.' });
    }

    try {
        const userId = new ObjectId(req.session.user.id);

        // Önce, kullanıcının aktif ilanlarını bul
        const studentListings = await db.collection("ogrenciler")
            .find({ createdBy: userId })
            .project({ _id: 1 })
            .toArray();

        if (studentListings.length === 0) {
            return res.json([]); // Öğrencinin ilanı yoksa teklif de almamıştır.
        }

        const listingIds = studentListings.map(l => l._id);

        // Aggregation Pipeline ile teklifleri ve ilgili iş bilgilerini birleştir
        const offers = await db.collection("is_teklifleri").aggregate([
            { $match: { studentListingId: { $in: listingIds } } },
            { $lookup: {
                    from: 'isverenler',
                    localField: 'jobListingId',
                    foreignField: '_id',
                    as: 'jobInfo'
                }}
        ]).sort({ createdAt: -1 }).toArray();

        res.json(offers);
    } catch (err) {
        console.error('Teklifleri getirirken hata:', err);
        res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' });
    }
});

// 21. Şifre Sıfırlama İsteği
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await db.collection("kullanicilar").findOne({ email });

        if (!user) {
            // Güvenlik nedeniyle, kullanıcıya e-postanın kayıtlı olup olmadığını söylemeyiz.
            return res.json({ success: true, message: 'Eğer bu e-posta adresi sistemimizde kayıtlıysa, şifre sıfırlama talimatları size gönderilecektir.' });
        }

        // Token oluştur
        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiration = Date.now() + 3600000; // 1 saat

        await db.collection("kullanicilar").updateOne(
            { _id: user._id },
            { $set: { resetToken, tokenExpiration } }
        );

        // Sıfırlama linki (Render domainini veya yerel adresi kullanın)
        const resetLink = `${req.protocol}://${req.get('host')}/reset-password.html?token=${resetToken}&email=${email}`;

        const msg = {
            to: email,
            from: process.env.SENDGRID_VERIFIED_SENDER || 'no-reply@stajla.com', // Kendi SendGrid doğrulanan e-postanız
            subject: 'STAJLA - Şifre Sıfırlama Talebi',
            html: `
                <p>Merhaba ${user.name},</p>
                <p>Şifrenizi sıfırlamak için aşağıdaki linke tıklayın. Bu link 1 saat geçerlidir:</p>
                <a href="${resetLink}">Şifremi Sıfırla</a>
                <p>Eğer bu talebi siz yapmadıysanız, bu e-postayı dikkate almayınız.</p>
                <p>STAJLA Destek Ekibi</p>
            `,
        };

        await sgMail.send(msg);

        res.json({ success: true, message: 'E-posta adresinize şifre sıfırlama linki gönderildi.' });
    } catch (err) {
        console.error('Şifre sıfırlama talebi hatası:', err);
        res.status(500).json({ success: false, message: 'E-posta gönderimi sırasında bir hata oluştu.' });
    }
});

// 22. Şifre Sıfırlama İşlemi
app.post('/api/reset-password', async (req, res) => {
    try {
        const { email, token, newPassword } = req.body;

        const user = await db.collection("kullanicilar").findOne({ email });

        if (!user || user.resetToken !== token || user.tokenExpiration < Date.now()) {
            return res.status(400).json({ success: false, message: 'Geçersiz veya süresi dolmuş şifre sıfırlama linki.' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'Yeni şifreniz en az 6 karakter olmalıdır.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Yeni şifreyi kaydet ve token'ı temizle
        await db.collection("kullanicilar").updateOne(
            { _id: user._id },
            { $set: { password: hashedPassword }, $unset: { resetToken: "", tokenExpiration: "" } }
        );

        res.json({ success: true, message: 'Şifreniz başarıyla sıfırlandı. Şimdi giriş yapabilirsiniz.' });

    } catch (err) {
        console.error('Şifre sıfırlama hatası:', err);
        res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' });
    }
});


// Veritabanı bağlantısı ve sunucu başlatma
async function connectToDb() {
    try {
        await client.connect();
        db = client.db("StajlaDB");
        console.log("MongoDB'ye başarıyla bağlanıldı!");
        app.listen(PORT, () => {
            console.log(`Sunucu ${PORT} portunda çalışıyor.`);
        });
    } catch (err) {
        console.error("Veritabanı bağlantı hatası:", err);
        process.exit(1);
    }
}

connectToDb();