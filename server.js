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


// --- 6. API ROTALARI (MLP Stabilizasyonu) ---

// KONTROL: Kullanıcı oturumunu döndürür
app.get('/api/current-user', (req, res) => { if (req.session.user) { res.json(req.session.user); } else { res.json(null); } });

// ÇIKIŞ YAP
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) { return res.json({ success: false }); }
        res.clearCookie('connect.sid');
        res.json({ success: true, message: 'Çıkış başarılı.' });
    });
});

// KULLANICI KAYIT & GİRİŞ (Diğerleri)
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, pass, role } = req.body;
        if (pass.length < 6) { return res.status(400).json({ success: false, message: 'Şifreniz en az 6 karakter olmalıdır.' }); }
        const existingUser = await db.collection("kullanicilar").findOne({ email });
        if (existingUser) { return res.status(400).json({ success: false, message: 'Bu e-posta adresi zaten kayıtlı.' }); }
        const hashedPassword = await bcrypt.hash(pass, 10);
        await db.collection("kullanicilar").insertOne({ name, email, password: hashedPassword, role, createdAt: new Date() });
        res.json({ success: true, message: 'Kayıt başarılı! Giriş yapabilirsiniz.' });
    } catch (err) { console.error('Kayıt hatası:', err); res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' }); }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, pass } = req.body;
        const user = await db.collection("kullanicilar").findOne({ email });
        if (!user || !(await bcrypt.compare(pass, user.password))) { return res.status(400).json({ success: false, message: 'Hatalı e-posta veya şifre.' }); }
        req.session.user = { id: user._id.toString(), name: user.name, email: user.email, role: user.role, profilePicturePath: user.profilePicturePath || null };
        res.json({ success: true, message: 'Giriş başarılı!' });
    } catch (err) { console.error('Giriş hatası:', err); res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' }); }
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

// PROFİL GÜNCELLEME (RESİM YÜKLEME)
app.post('/api/update-profile', upload.single('profilePicture'), async (req, res) => {
    if (!req.session.user) {
        if (req.file) { fs.unlinkSync(req.file.path); }
        return res.status(401).json({ success: false, message: 'Bu işlem için giriş yapmalısınız.' });
    }
    try {
        const { name } = req.body;
        const updateData = {};
        if (name) { updateData.name = name; }
        if (req.file) {
            updateData.profilePicturePath = await uploadToCloudinary(req.file.path, 'image', 'avatars');
        }
        if (Object.keys(updateData).length === 0) { return res.json({ success: true, message: 'Güncellenecek bir bilgi gönderilmedi.' }); }

        const userId = new ObjectId(req.session.user.id);
        await db.collection("kullanicilar").updateOne({ _id: userId }, { $set: updateData });

        if (updateData.name) { req.session.user.name = updateData.name; }
        if (updateData.profilePicturePath) { req.session.user.profilePicturePath = updateData.profilePicturePath; }

        res.json({ success: true, message: 'Profiliniz başarıyla güncellendi!', user: req.session.user });

    } catch (err) { console.error('Profil güncelleme sırasında hata:', err); res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' }); }
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

// PROFİL DETAYINI GETİRME (ogrenci-profil.html'nin kullandığı rota)
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
            listingId: studentListing._id
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

// server.js'te API ROTALARI bölümüne bu kodu ekleyin:
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
            listingId: studentListing._id
        };

        res.json({ success: true, profileInfo });

    } catch (err) {
        console.error('Öğrenci profili getirilirken hata:', err);
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