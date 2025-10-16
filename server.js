require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');



const app = express();
const PORT = process.env.PORT || 3000;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error("HATA: DATABASE_URL bulunamadı. Lütfen .env dosyanızı veya Render'daki ayarlarınızı kontrol edin.");
    process.exit(1);
}

const client = new MongoClient(connectionString);
let db;

// Multer Ayarları
const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'public/uploads'); },
    filename: (req, file, cb) => { cb(null, Date.now() + '-' + file.originalname); }
});
const upload = multer({ storage: storage });

// Avatar (Profil Resmi) için Multer Ayarı
const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'public/uploads/avatars'); }, // Resimleri avatars klasörüne kaydet
    filename: (req, file, cb) => { cb(null, req.session.user.id + '-' + Date.now() + path.extname(file.originalname)); } // Dosya adını benzersiz yap
});
const uploadAvatar = multer({ storage: avatarStorage });

async function connectToDb() {
    try {
        await client.connect();
        console.log("Veritabanına başarıyla bağlandı!");
        db = client.db("StajlaDB");
    } catch (err) {
        console.error("Veritabanına bağlanırken bir hata oluştu:", err);
        process.exit(1);
    }
}

connectToDb().then(() => {
    app.use(express.static('public'));
    app.use(express.json());

    // --- NİHAİ DÜZELTME: RENDER PROXY AYARI ---
    // Bu satır, Express'e Render gibi bir proxy arkasında çalıştığını ve
    // güvenli bağlantı bilgilerine (HTTPS) güvenmesi gerektiğini söyler.
    // Bu, session cookie'lerinin doğru çalışması için KRİTİKTİR.
    app.set('trust proxy', 1);

    app.use(session({
        secret: 'cok-gizli-bir-anahtar-kelime-lutfen-degistir',
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({ mongoUrl: connectionString }),
        cookie: {
            secure: process.env.NODE_ENV === 'production', // Sadece HTTPS'te cookie gönder
            httpOnly: true, // Cookie'nin JavaScript tarafından okunmasını engelle
            sameSite: 'lax' // CSRF saldırılarına karşı koruma
        }
    }));

    // --- TÜM API ROUTE'LARI BURADA ---
    // (Aşağıdaki kodlar, daha önce eklediğimiz ve doğru çalışan tüm özellikleri içerir)

    // KULLANICI YÖNETİMİ
    app.post('/api/register', async (req, res) => {
        try {
            const { name, email, pass, role } = req.body;
            const existingUser = await db.collection("kullanicilar").findOne({ email: email });
            if (existingUser) { return res.json({ success: false, message: 'Bu e-posta adresi zaten kullanılıyor.' }); }
            const hashedPassword = await bcrypt.hash(pass, 10);
            await db.collection("kullanicilar").insertOne({ name, email, password: hashedPassword, role });
            res.json({ success: true, message: 'Kayıt başarılı! Giriş yapabilirsiniz.' });
        } catch (err) { console.error("Kayıt sırasında hata:", err); res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' }); }
    });

    app.post('/api/login', async (req, res) => {
        try {
            const { email, pass, remember } = req.body;
            const user = await db.collection("kullanicilar").findOne({ email: email });
            if (!user) { return res.json({ success: false, message: 'Hatalı e-posta veya şifre.' }); }
            const isPasswordCorrect = await bcrypt.compare(pass, user.password);
            if (!isPasswordCorrect) { return res.json({ success: false, message: 'Hatalı e-posta veya şifre.' }); }

            // DÜZELTME: Session'a profilePicturePath alanını da ekliyoruz.
            // Eğer kullanıcı resmi yoksa, bu alan 'undefined' olacak ve sorun yaratmayacaktır.
            req.session.user = {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                role: user.role,
                profilePicturePath: user.profilePicturePath // <-- EKLENEN SATIR
            };

            if (remember) { req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; } else { req.session.cookie.expires = false; }
            res.json({ success: true, message: 'Giriş başarılı!' });
        } catch (err) { console.error('Giriş sırasında hata:', err); res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' }); }
    });

    // YENİ API ENDPOINT: Kullanıcı profilini (isim ve resim) günceller
    app.post('/api/update-profile', uploadAvatar.single('profilePicture'), async (req, res) => {
        // 1. Kullanıcı giriş yapmış mı diye kontrol et
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Bu işlem için giriş yapmalısınız.' });
        }

        try {
            const { name } = req.body;
            const updateData = {};

            // Eğer yeni bir isim gönderildiyse, güncelleme objesine ekle
            if (name) {
                updateData.name = name;
            }

            // Eğer yeni bir resim yüklendiyse, onun yolunu da ekle
            if (req.file) {
                const picturePath = req.file.path.replace(/\\/g, '/').replace('public', '');
                updateData.profilePicturePath = picturePath;
            }

            // Eğer güncellenecek bir şey yoksa, işlem yapma
            if (Object.keys(updateData).length === 0) {
                return res.json({ success: true, message: 'Güncellenecek bir bilgi gönderilmedi.' });
            }

            const userId = new ObjectId(req.session.user.id);
            await db.collection("kullanicilar").updateOne({ _id: userId }, { $set: updateData });

            // Oturum (session) bilgilerini de anında güncelle, böylece navbar'da hemen görünür
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

    app.get('/api/current-user', (req, res) => {
        if (req.session.user) { res.json(req.session.user); } else { res.json(null); }
    });

    app.get('/api/logout', (req, res) => {
        req.session.destroy(err => { if (err) { return res.json({ success: false }); } res.clearCookie('connect.sid'); res.json({ success: true }); });
    });

    app.post('/api/forgot-password', async (req, res) => {
        try {
            const { email } = req.body;
            const user = await db.collection("kullanicilar").findOne({ email: email });
            if (!user) { return res.json({ success: true, message: 'Eğer bu e-posta adresi sistemimizde kayıtlıysa, şifre sıfırlama linki gönderilecektir.' }); }
            const resetToken = crypto.randomBytes(20).toString('hex');
            await db.collection("kullanicilar").updateOne({ _id: user._id }, { $set: { resetPasswordToken: resetToken, resetPasswordExpires: Date.now() + 3600000 } });
            const testAccount = await nodemailer.createTestAccount();
            const transporter = nodemailer.createTransport({ host: "smtp.ethereal.email", port: 587, secure: false, auth: { user: testAccount.user, pass: testAccount.pass } });
            const resetURL = `https://${req.get('host')}/reset-password.html?token=${resetToken}`;
            let info = await transporter.sendMail({ from: '"Stajla Destek" <destek@stajla.com>', to: user.email, subject: "Stajla Şifre Sıfırlama İsteği", html: `<p>Merhaba ${user.name},</p><p>Şifrenizi sıfırlamak için aşağıdaki linke tıklayınız...</p><a href="${resetURL}">${resetURL}</a>` });
            console.log("Test E-postasını Görüntüle: %s", nodemailer.getTestMessageUrl(info));
            res.json({ success: true, message: 'Eğer bu e-posta adresi sistemimizde kayıtlıysa, şifre sıfırlama linki gönderilecektir.' });
        } catch (err) { console.error('Şifre sıfırlama sırasında hata:', err); res.status(500).json({ success: false, message: 'Bir hata oluştu.' }); }
    });

    app.post('/api/reset-password', async (req, res) => {
        try {
            const { token, newPassword } = req.body;
            const user = await db.collection("kullanicilar").findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });
            if (!user) { return res.json({ success: false, message: 'Şifre sıfırlama anahtarı geçersiz veya süresi dolmuş.' }); }
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await db.collection("kullanicilar").updateOne({ _id: user._id }, { $set: { password: hashedPassword, resetPasswordToken: undefined, resetPasswordExpires: undefined } });
            res.json({ success: true, message: 'Şifreniz başarıyla güncellendi.' });
        } catch (err) { res.status(500).json({ success: false, message: 'Bir hata oluştu.' }); }
    });

    // İLAN YÖNETİMİ
    app.post('/api/ogrenci-ilan', upload.single('cv'), async (req, res) => {
        if (!req.session.user || req.session.user.role !== 'student') { return res.status(403).json({ success: false, message: 'Bu işlem için öğrenci olarak giriş yapmalısınız.' }); }
        try {
            const yeniIlan = req.body;
            yeniIlan.createdBy = new ObjectId(req.session.user.id);
            if (req.file) { yeniIlan.cvPath = req.file.path.replace(/\\/g, '/').replace('public', ''); }
            await db.collection("ogrenciler").insertOne(yeniIlan);
            res.json({ success: true, message: 'İlan başarıyla eklendi!' });
        } catch (err) { res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' }); }
    });

    app.post('/api/isveren-ilan', async (req, res) => {
        if (!req.session.user || req.session.user.role !== 'employer') { return res.status(403).json({ success: false, message: 'Bu işlem için işveren olarak giriş yapmalısınız.' }); }
        try {
            const yeniIlan = req.body;
            yeniIlan.createdBy = new ObjectId(req.session.user.id);
            await db.collection("isverenler").insertOne(yeniIlan);
            res.json({ success: true, message: 'İlan başarıyla eklendi!' });
        } catch (err) { res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' }); }
    });

    // YENİ API ENDPOINT: Giriş yapmış öğrencinin kendi ilanını getirir
    app.get('/api/my-student-listing', async (req, res) => {
        if (!req.session.user || req.session.user.role !== 'student') {
            return res.status(403).json(null);
        }
        try {
            const studentId = new ObjectId(req.session.user.id);
            const listing = await db.collection("ogrenciler").findOne({ createdBy: studentId });
            res.json(listing); // Öğrencinin ilanını veya bulunamazsa null döner
        } catch (err) {
            res.status(500).json(null);
        }
    });

    // YENİ API ENDPOINT: ID'ye göre tek bir öğrenci ilanını getirir
    app.get('/api/ogrenci-ilan/:id', async (req, res) => {
        try {
            const { id } = req.params;
            // ID'nin geçerli bir ObjectId olup olmadığını kontrol etmek önemlidir
            if (!ObjectId.isValid(id)) {
                return res.status(400).json({ message: 'Geçersiz İlan IDsi.' });
            }
            const ilan = await db.collection("ogrenciler").findOne({ _id: new ObjectId(id) });
            if (!ilan) {
                return res.status(404).json({ message: 'Öğrenci ilanı bulunamadı.' });
            }
            res.json(ilan);
        } catch (err) {
            console.error("Tekil öğrenci ilanı alınırken hata:", err);
            res.status(500).json({ message: 'Sunucuda bir hata oluştu.' });
        }
    });

    // --- BU ROTAYI GÜNCELLENMİŞ HALİYLE DEĞİŞTİRİN ---
// YENİ API ENDPOINT: Bir işveren ilanına başvurmak için
    app.post('/api/apply', async (req, res) => {
        // 1. Kullanıcı giriş yapmış mı ve rolü 'student' mı diye kontrol et
        if (!req.session.user || req.session.user.role !== 'student') {
            return res.status(403).json({ success: false, message: 'Bu işlem için öğrenci olarak giriş yapmalısınız.' });
        }

        try {
            const { listingId, studentListingId } = req.body; // Butona tıklandığında gelen ilan ID'leri
            const studentId = new ObjectId(req.session.user.id);

            // 2. Bu öğrenci bu ilana daha önce başvurmuş mu diye kontrol et
            const existingApplication = await db.collection("applications").findOne({
                listingId: new ObjectId(listingId),
                applicantId: studentId
            });
            if (existingApplication) {
                return res.status(400).json({ success: false, message: 'Bu ilana zaten başvurdunuz.' });
            }

            // 3. İlanın sahibinin ID'sini bul
            const listing = await db.collection("isverenler").findOne({ _id: new ObjectId(listingId) });
            if (!listing) {
                return res.status(404).json({ success: false, message: 'İlan bulunamadı.' });
            }

            // 4. Yeni başvuru belgesini oluştur ve "applications" koleksiyonuna kaydet
            const newApplication = {
                applicantId: studentId,
                listingId: new ObjectId(listingId),
                ownerId: listing.createdBy, // İlan sahibinin ID'si
                studentListingId: new ObjectId(studentListingId), // Başvuran öğrencinin kendi ilanının ID'si
                status: 'pending', // Başvuru durumu: 'beklemede'
                createdAt: new Date() // Başvuru tarihi
            };
            await db.collection("applications").insertOne(newApplication);

            res.json({ success: true, message: 'Başvurunuz başarıyla gönderildi!' });

        } catch (err) {
            console.error('Başvuru sırasında hata:', err);
            res.status(500).json({ success: false, message: 'Bir hata oluştu.' });
        }
    });


// --- BU ROTAYI DA GÜNCELLENMİŞ HALİYLE DEĞİŞTİRİN ---
    app.get('/api/notifications', async (req, res) => {
        if (!req.session.user || req.session.user.role !== 'employer') {
            return res.status(403).json([]);
        }
        try {
            const ownerId = new ObjectId(req.session.user.id);
            const notifications = await db.collection("applications").aggregate([
                { $match: { ownerId: ownerId } },
                { $sort: { createdAt: -1 } },
                { // Başvuranın kullanıcı adını getir
                    $lookup: { from: "kullanicilar", localField: "applicantId", foreignField: "_id", as: "applicantInfo" }
                },
                { // Başvuranın öğrenci ilanını getir
                    $lookup: { from: "ogrenciler", localField: "studentListingId", foreignField: "_id", as: "studentListingInfo" }
                },
                { // Başvurulan işveren ilanını getir (opsiyonel ama faydalı)
                    $lookup: { from: "isverenler", localField: "listingId", foreignField: "_id", as: "listingInfo" }
                }
            ]).toArray();
            res.json(notifications);
        } catch (err) {
            console.error("Bildirimler getirilirken hata:", err);
            res.status(500).json([]);
        }
    });

// ÖNEMLİ: Dosyanın sonlarındaki diğer app.post('/api/apply') ve app.get('/api/notifications') satırlarını sildiğinizden emin olun!

    app.get('/api/ogrenci-ilanlari', async (req, res) => { try { const ilanlar = await db.collection("ogrenciler").find().sort({_id: -1}).limit(8).toArray(); res.json(ilanlar); } catch (err) { res.status(500).json([]); } });
    app.get('/api/isveren-ilanlari', async (req, res) => { try { const ilanlar = await db.collection("isverenler").find().sort({_id: -1}).limit(8).toArray(); res.json(ilanlar); } catch (err) { res.status(500).json([]); } });
    app.get('/api/search', async (req, res) => { try { const { type, area, city } = req.query; const filterQuery = {}; if (area) filterQuery.area = area; if (city) filterQuery.city = city; const collectionName = type === 'jobs' ? 'isverenler' : 'ogrenciler'; const results = await db.collection(collectionName).find(filterQuery).sort({_id: -1}).toArray(); res.json(results); } catch (err) { res.status(500).json([]); } });
    app.get('/api/listing/:id', async (req, res) => { try { const { id } = req.params; const { type } = req.query; const collectionName = type === 'student' ? 'ogrenciler' : 'isverenler'; const listing = await db.collection(collectionName).findOne({ _id: new ObjectId(id) }); if (!listing) { return res.status(404).json({ message: 'İlan bulunamadı.' }); } res.json(listing); } catch (err) { res.status(500).json({ message: 'Sunucu hatası.' }); } });
    app.get('/api/my-listings', async (req, res) => { if (!req.session.user) { return res.status(401).json({ message: 'Lütfen giriş yapın.' }); } try { const userId = new ObjectId(req.session.user.id); const studentListings = await db.collection("ogrenciler").find({ createdBy: userId }).toArray(); const employerListings = await db.collection("isverenler").find({ createdBy: userId }).toArray(); res.json({ student: studentListings, employer: employerListings }); } catch (err) { res.status(500).json({ message: 'İlanlar getirilirken bir hata oluştu.' }); } });
    app.post('/api/update-listing', async (req, res) => { if (!req.session.user) { return res.status(401).json({ success: false, message: 'Bu işlem için giriş yapmalısınız.' }); } try { const { id, type, data } = req.body; const collectionName = type === 'student' ? 'ogrenciler' : 'isverenler'; const listing = await db.collection(collectionName).findOne({ _id: new ObjectId(id) }); if (!listing) { return res.status(404).json({ success: false, message: 'İlan bulunamadı.' }); } if (listing.createdBy.toString() !== req.session.user.id.toString()) { return res.status(403).json({ success: false, message: 'Bu ilanı düzenleme yetkiniz yok.' }); } await db.collection(collectionName).updateOne({ _id: new ObjectId(id) }, { $set: data }); res.json({ success: true, message: 'İlan başarıyla güncellendi.' }); } catch (err) { res.status(500).json({ success: false, message: 'Bir hata oluştu.' }); } });
    app.post('/api/delete-listing', async (req, res) => { if (!req.session.user) { return res.status(401).json({ success: false, message: 'Bu işlem için giriş yapmalısınız.' }); } try { const { id, type } = req.body; const collectionName = type === 'student' ? 'ogrenciler' : 'isverenler'; const listing = await db.collection(collectionName).findOne({ _id: new ObjectId(id) }); if (!listing) { return res.status(404).json({ success: false, message: 'İlan bulunamadı.' }); } if (listing.createdBy.toString() !== req.session.user.id.toString()) { return res.status(403).json({ success: false, message: 'Bu ilanı silme yetkiniz yok.' }); } await db.collection(collectionName).deleteOne({ _id: new ObjectId(id) }); res.json({ success: true, message: 'İlan başarıyla silindi.' }); } catch (err) { res.status(500).json({ success: false, message: 'Bir hata oluştu.' }); } });
    app.post('/api/report-listing', async (req, res) => { if (!req.session.user) { return res.status(401).json({ success: false, message: 'İçerik bildirmek için giriş yapmalısınız.' }); } try { const { id, type } = req.body; const collectionName = type === 'student' ? 'ogrenciler' : 'isverenler'; await db.collection(collectionName).updateOne({ _id: new ObjectId(id) }, { $inc: { reportCount: 1 } }); res.json({ success: true, message: 'İlan bildiriminiz alınmıştır. Teşekkür ederiz.' }); } catch (err) { res.status(500).json({ success: false, message: 'Bir hata oluştu.' }); } });


    // Sunucu Başlatma
    app.listen(PORT, () => {
        console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
    });
});