// ===================================================================================
//                                  STAJLA - server.js (NİHAİ KARARLI VE TAM VERSİYON)
// ===================================================================================
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

// Nihai ve doğru argo filtresi kütüphanesi
const BadWords = require('bad-words-next');
const en = require('bad-words-next/data/en.json');
const filter = new BadWords({ data: en });
const turkceArgolar = ['aptal', 'salak', 'gerizekalı', 'lan', 'oruspu', 'orospuçocuğu', 'amk', 'aminakoyayim', 'mal'];
filter.addWords(...turkceArgolar);

const app = express();
const PORT = process.env.PORT || 3000;
const connectionString = process.env.DATABASE_URL;
const client = new MongoClient(connectionString);
let db;

// Multer (Dosya Yükleme) Ayarları
const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'public/uploads'); },
    filename: (req, file, cb) => { cb(null, Date.now() + '-' + file.originalname); }
});
const upload = multer({ storage: storage });

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
    app.use(session({
        secret: 'cok-gizli-bir-anahtar-kelime',
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({ mongoUrl: connectionString })
    }));

    // ===============================================
    //           KULLANICI YÖNETİMİ API'LARI
    // ===============================================

    app.post('/api/register', async (req, res) => {
        try {
            const { name, email, pass, role } = req.body;
            if (filter.isProfane(name)) { return res.status(400).json({ success: false, message: 'Kullanıcı adında uygun olmayan kelimeler tespit edildi.' }); }
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
            req.session.user = { id: user._id.toString(), name: user.name, email: user.email, role: user.role };
            if (remember) { req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; } else { req.session.cookie.expires = false; }
            res.json({ success: true, message: 'Giriş başarılı!' });
        } catch (err) { console.error('Giriş sırasında hata:', err); res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' }); }
    });

    app.get('/api/current-user', (req, res) => {
        if (req.session.user) { res.json(req.session.user); }
        else { res.json(null); }
    });

    app.get('/api/logout', (req, res) => {
        req.session.destroy(err => {
            if (err) { return res.json({ success: false }); }
            res.clearCookie('connect.sid');
            res.json({ success: true });
        });
    });

    app.post('/api/forgot-password', async (req, res) => {
        try {
            const { email } = req.body;
            const user = await db.collection("kullanicilar").findOne({ email: email });
            if (!user) { return res.json({ success: true, message: 'Eğer bu e-posta adresi sistemimizde kayıtlıysa, şifre sıfırlama linki gönderilecektir.' }); }
            const resetToken = crypto.randomBytes(20).toString('hex');
            await db.collection("kullanicilar").updateOne({ _id: user._id }, { $set: { resetPasswordToken: resetToken, resetPasswordExpires: Date.now() + 3600000 } });
            let testAccount = await nodemailer.createTestAccount();
            let transporter = nodemailer.createTransport({ host: "smtp.ethereal.email", port: 587, secure: false, auth: { user: testAccount.user, pass: testAccount.pass } });
            const resetURL = `${req.protocol}://${req.get('host')}/reset-password.html?token=${resetToken}`;
            let info = await transporter.sendMail({ from: '"Stajla Destek" <destek@stajla.com>', to: user.email, subject: "Stajla Şifre Sıfırlama İsteği", html: `<p>Merhaba ${user.name},</p><p>Şifrenizi sıfırlamak için aşağıdaki linke tıklayınız. Bu link 1 saat geçerlidir.</p><a href="${resetURL}">${resetURL}</a>` });
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
            res.json({ success: true, message: 'Şifreniz başarıyla güncellendi. Şimdi giriş yapabilirsiniz.' });
        } catch (err) { console.error('Şifre güncellenirken hata:', err); res.status(500).json({ success: false, message: 'Bir hata oluştu.' }); }
    });

    // ===============================================
    //           İLAN YÖNETİMİ API'LARI
    // ===============================================

    app.post('/api/ogrenci-ilan', upload.single('cv'), async (req, res) => {
        if (!req.session.user || req.session.user.role !== 'student') { return res.status(403).json({ success: false, message: 'Bu işlem için öğrenci olarak giriş yapmalısınız.' }); }
        try {
            const yeniIlan = req.body;
            if (filter.isProfane(yeniIlan.name) || filter.isProfane(yeniIlan.desc) || filter.isProfane(yeniIlan.dept)) { return res.status(400).json({ success: false, message: 'İlan içeriğinde uygun olmayan kelimeler tespit edildi.' }); }
            yeniIlan.createdBy = new ObjectId(req.session.user.id);
            if (req.file) { yeniIlan.cvPath = req.file.path.replace('public', ''); }
            await db.collection("ogrenciler").insertOne(yeniIlan);
            res.json({ success: true, message: 'İlan başarıyla eklendi!' });
        } catch (err) { console.error("Öğrenci ilanı eklenirken hata:", err); res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' }); }
    });

    app.post('/api/isveren-ilan', async (req, res) => {
        if (!req.session.user || req.session.user.role !== 'employer') { return res.status(403).json({ success: false, message: 'Bu işlem için işveren olarak giriş yapmalısınız.' }); }
        try {
            const yeniIlan = req.body;
            // DÜZELTME: isProfane() fonksiyonu doğru şekilde kullanıldı
            if (filter.isProfane(yeniIlan.company) || filter.isProfane(yeniIlan.sector) || filter.isProfane(yeniIlan.req)) {
                return res.status(400).json({ success: false, message: 'İlan içeriğinde uygun olmayan kelimeler tespit edildi.' });
            }
            yeniIlan.createdBy = new ObjectId(req.session.user.id);
            await db.collection("isverenler").insertOne(yeniIlan);
            res.json({ success: true, message: 'İlan başarıyla eklendi!' });
        } catch (err) { console.error("İşveren ilanı eklenirken hata:", err); res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' }); }
    });

    app.get('/api/ogrenci-ilanlari', async (req, res) => {
        try { const ilanlar = await db.collection("ogrenciler").find().sort({_id: -1}).limit(6).toArray(); res.json(ilanlar); } catch (err) { console.error('Öğrenci ilanları getirilirken hata:', err); res.status(500).json([]); }
    });

    app.get('/api/isveren-ilanlari', async (req, res) => {
        try { const ilanlar = await db.collection("isverenler").find().sort({_id: -1}).limit(6).toArray(); res.json(ilanlar); } catch (err) { console.error('İşveren ilanları getirilirken hata:', err); res.status(500).json([]); }
    });

    app.get('/api/search', async (req, res) => {
        try {
            const { type, area, city } = req.query;
            const filter = {};
            if (area) filter.area = area;
            if (city) filter.city = city;
            const collectionName = type === 'jobs' ? 'isverenler' : 'ogrenciler';
            const results = await db.collection(collectionName).find(filter).sort({_id: -1}).toArray();
            res.json(results);
        } catch (err) { console.error('Arama sırasında hata:', err); res.status(500).json([]); }
    });

    app.get('/api/listing/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { type } = req.query;
            const collectionName = type === 'student' ? 'ogrenciler' : 'isverenler';
            const listing = await db.collection(collectionName).findOne({ _id: new ObjectId(id) });
            if (!listing) { return res.status(404).json({ message: 'İlan bulunamadı.' }); }
            res.json(listing);
        } catch (err) { console.error("Tekil ilan getirilirken sunucu hatası:", err); res.status(500).json({ message: 'Sunucu hatası.' }); }
    });

    app.get('/api/my-listings', async (req, res) => {
        if (!req.session.user) { return res.status(401).json({ message: 'Lütfen giriş yapın.' }); }
        try {
            const userId = new ObjectId(req.session.user.id);
            const studentListings = await db.collection("ogrenciler").find({ createdBy: userId }).toArray();
            const employerListings = await db.collection("isverenler").find({ createdBy: userId }).toArray();
            res.json({ student: studentListings, employer: employerListings });
        } catch (err) { console.error("Kullanıcı ilanları getirilirken hata:", err); res.status(500).json({ message: 'İlanlar getirilirken bir hata oluştu.' }); }
    });

    app.post('/api/update-listing', async (req, res) => {
        if (!req.session.user) { return res.status(401).json({ success: false, message: 'Bu işlem için giriş yapmalısınız.' }); }
        try {
            const { id, type, data } = req.body;
            const collectionName = type === 'student' ? 'ogrenciler' : 'isverenler';
            const listing = await db.collection(collectionName).findOne({ _id: new ObjectId(id) });
            if (!listing) { return res.status(404).json({ success: false, message: 'İlan bulunamadı.' }); }
            if (listing.createdBy.toString() !== req.session.user.id.toString()) {
                return res.status(403).json({ success: false, message: 'Bu ilanı düzenleme yetkiniz yok.' });
            }
            await db.collection(collectionName).updateOne({ _id: new ObjectId(id) }, { $set: data });
            res.json({ success: true, message: 'İlan başarıyla güncellendi.' });
        } catch (err) { console.error('İlan güncellenirken hata:', err); res.status(500).json({ success: false, message: 'Bir hata oluştu.' }); }
    });

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
        } catch (err) { console.error('İlan silinirken hata:', err); res.status(500).json({ success: false, message: 'Bir hata oluştu.' }); }
    });

    // ===============================================
    //           ETKİLEŞİM API'LARI
    // ===============================================

    app.post('/api/apply', async (req, res) => {
        if (!req.session.user || req.session.user.role !== 'student') { return res.status(403).json({ success: false, message: 'Bu işlem için öğrenci olarak giriş yapmalısınız.' }); }
        try {
            const { listingId } = req.body;
            const studentId = new ObjectId(req.session.user.id);
            const existingApplication = await db.collection("applications").findOne({ listingId: new ObjectId(listingId), applicantId: studentId });
            if (existingApplication) { return res.status(400).json({ success: false, message: 'Bu ilana zaten başvurdunuz.' }); }
            const listing = await db.collection("isverenler").findOne({ _id: new ObjectId(listingId) });
            if (!listing) { return res.status(404).json({ success: false, message: 'İlan bulunamadı.' }); }
            const newApplication = { applicantId: studentId, listingId: new ObjectId(listingId), ownerId: listing.createdBy, status: 'pending', createdAt: new Date() };
            await db.collection("applications").insertOne(newApplication);
            res.json({ success: true, message: 'Başvurunuz başarıyla gönderildi!' });
        } catch (err) { console.error('Başvuru sırasında hata:', err); res.status(500).json({ success: false, message: 'Bir hata oluştu.' }); }
    });

    app.post('/api/report-listing', async (req, res) => {
        if (!req.session.user) { return res.status(401).json({ success: false, message: 'İçerik bildirmek için giriş yapmalısınız.' }); }
        try {
            const { id, type } = req.body;
            const collectionName = type === 'student' ? 'ogrenciler' : 'isverenler';
            await db.collection(collectionName).updateOne({ _id: new ObjectId(id) }, { $inc: { reportCount: 1 } });
            res.json({ success: true, message: 'İlan bildiriminiz alınmıştır. Teşekkür ederiz.' });
        } catch (err) { console.error('İlan şikayet edilirken hata:', err); res.status(500).json({ success: false, message: 'Bir hata oluştu.' }); }
    });

    app.get('/api/notifications', async (req, res) => {
        if (!req.session.user || req.session.user.role !== 'employer') { return res.status(403).json([]); }
        try {
            const ownerId = new ObjectId(req.session.user.id);
            const notifications = await db.collection("applications").aggregate([
                { $match: { ownerId: ownerId } },
                { $sort: { createdAt: -1 } },
                { $lookup: { from: "kullanicilar", localField: "applicantId", foreignField: "_id", as: "applicantInfo" } },
                { $lookup: { from: "isverenler", localField: "listingId", foreignField: "_id", as: "listingInfo" } }
            ]).toArray();
            res.json(notifications);
        } catch (err) { console.error("Bildirimler getirilirken hata:", err); res.status(500).json([]); }
    });

    // Sunucu Başlatma
    app.listen(PORT, () => {
        console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
    });
});