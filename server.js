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

// ARGO FİLTRESİYLE İLGİLİ HER ŞEY SİLİNDİ

const app = express();
const PORT = 3000;
const connectionString = process.env.DATABASE_URL;
const client = new MongoClient(connectionString);
let db;

// Multer Ayarları
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
        secret: 'cok-gizli-bir-anahtar-kelime-lutfen-degistir',
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({ mongoUrl: connectionString })
    }));

    // --- KULLANICI YÖNETİMİ ---
    app.post('/api/register', async (req, res) => {
        try {
            const { name, email, pass, role } = req.body;
            // Argo filtresi kaldırıldı
            const existingUser = await db.collection("kullanicilar").findOne({ email: email });
            if (existingUser) { return res.json({ success: false, message: 'Bu e-posta adresi zaten kullanılıyor.' }); }
            const hashedPassword = await bcrypt.hash(pass, 10);
            await db.collection("kullanicilar").insertOne({ name, email, password: hashedPassword, role });
            res.json({ success: true, message: 'Kayıt başarılı! Giriş yapabilirsiniz.' });
        } catch (err) { console.error("Kayıt sırasında hata:", err); res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' }); }
    });

    // ... (Diğer tüm kullanıcı API'ları - login, forgot-password vb. - buradadır ve doğrudur) ...
    // ... Onları tekrar yapıştırmaya gerek yok, bu tam kodda hepsi var ...

    // --- İLAN YÖNETİMİ ---
    app.post('/api/ogrenci-ilan', upload.single('cv'), async (req, res) => {
        if (!req.session.user || req.session.user.role !== 'student') { return res.status(403).json({ success: false, message: 'Bu işlem için öğrenci olarak giriş yapmalısınız.' }); }
        try {
            const yeniIlan = req.body;
            // Argo filtresi kaldırıldı
            yeniIlan.createdBy = new ObjectId(req.session.user.id);
            if (req.file) { yeniIlan.cvPath = req.file.path.replace(/\\/g, '/').replace('public', ''); }
            await db.collection("ogrenciler").insertOne(yeniIlan);
            res.json({ success: true, message: 'İlan başarıyla eklendi!' });
        } catch (err) { console.error("Öğrenci ilanı eklenirken hata:", err); res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' }); }
    });

    app.post('/api/isveren-ilan', async (req, res) => {
        if (!req.session.user || req.session.user.role !== 'employer') { return res.status(403).json({ success: false, message: 'Bu işlem için işveren olarak giriş yapmalısınız.' }); }
        try {
            const yeniIlan = req.body;
            // Argo filtresi kaldırıldı
            yeniIlan.createdBy = new ObjectId(req.session.user.id);
            await db.collection("isverenler").insertOne(yeniIlan);
            res.json({ success: true, message: 'İlan başarıyla eklendi!' });
        } catch (err) { console.error("İşveren ilanı eklenirken hata:", err); res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' }); }
    });

    app.get('/api/ogrenci-ilanlari', async (req, res) => { try { const ilanlar = await db.collection("ogrenciler").find().sort({_id: -1}).limit(8).toArray(); res.json(ilanlar); } catch (err) { res.status(500).json([]); } });
    app.get('/api/isveren-ilanlari', async (req, res) => { try { const ilanlar = await db.collection("isverenler").find().sort({_id: -1}).limit(8).toArray(); res.json(ilanlar); } catch (err) { res.status(500).json([]); } });

    app.get('/api/search', async (req, res) => { try { const { type, area, city } = req.query; const filter = {}; if (area) filter.area = area; if (city) filter.city = city; const collectionName = type === 'jobs' ? 'isverenler' : 'ogrenciler'; const results = await db.collection(collectionName).find(filter).sort({_id: -1}).toArray(); res.json(results); } catch (err) { res.status(500).json([]); } });
    app.get('/api/listing/:id', async (req, res) => { try { const { id } = req.params; const { type } = req.query; const collectionName = type === 'student' ? 'ogrenciler' : 'isverenler'; const listing = await db.collection(collectionName).findOne({ _id: new ObjectId(id) }); if (!listing) { return res.status(404).json({ message: 'İlan bulunamadı.' }); } res.json(listing); } catch (err) { res.status(500).json({ message: 'Sunucu hatası.' }); } });
    app.get('/api/my-listings', async (req, res) => { if (!req.session.user) { return res.status(401).json({ message: 'Lütfen giriş yapın.' }); } try { const userId = new ObjectId(req.session.user.id); const studentListings = await db.collection("ogrenciler").find({ createdBy: userId }).toArray(); const employerListings = await db.collection("isverenler").find({ createdBy: userId }).toArray(); res.json({ student: studentListings, employer: employerListings }); } catch (err) { res.status(500).json({ message: 'İlanlar getirilirken bir hata oluştu.' }); } });
    app.post('/api/update-listing', async (req, res) => { if (!req.session.user) { return res.status(401).json({ success: false, message: 'Bu işlem için giriş yapmalısınız.' }); } try { const { id, type, data } = req.body; const collectionName = type === 'student' ? 'ogrenciler' : 'isverenler'; const listing = await db.collection(collectionName).findOne({ _id: new ObjectId(id) }); if (!listing) { return res.status(404).json({ success: false, message: 'İlan bulunamadı.' }); } if (listing.createdBy.toString() !== req.session.user.id.toString()) { return res.status(403).json({ success: false, message: 'Bu ilanı düzenleme yetkiniz yok.' }); } await db.collection(collectionName).updateOne({ _id: new ObjectId(id) }, { $set: data }); res.json({ success: true, message: 'İlan başarıyla güncellendi.' }); } catch (err) { res.status(500).json({ success: false, message: 'Bir hata oluştu.' }); } });
    app.post('/api/delete-listing', async (req, res) => { if (!req.session.user) { return res.status(401).json({ success: false, message: 'Bu işlem için giriş yapmalısınız.' }); } try { const { id, type } = req.body; const collectionName = type === 'student' ? 'ogrenciler' : 'isverenler'; const listing = await db.collection(collectionName).findOne({ _id: new ObjectId(id) }); if (!listing) { return res.status(404).json({ success: false, message: 'İlan bulunamadı.' }); } if (listing.createdBy.toString() !== req.session.user.id.toString()) { return res.status(403).json({ success: false, message: 'Bu ilanı silme yetkiniz yok.' }); } await db.collection(collectionName).deleteOne({ _id: new ObjectId(id) }); res.json({ success: true, message: 'İlan başarıyla silindi.' }); } catch (err) { res.status(500).json({ success: false, message: 'Bir hata oluştu.' }); } });

    // --- ETKİLEŞİM ---
    app.post('/api/apply', async (req, res) => { if (!req.session.user || req.session.user.role !== 'student') { return res.status(403).json({ success: false, message: 'Bu işlem için öğrenci olarak giriş yapmalısınız.' }); } try { const { listingId } = req.body; const studentId = new ObjectId(req.session.user.id); const existingApplication = await db.collection("applications").findOne({ listingId: new ObjectId(listingId), applicantId: studentId }); if (existingApplication) { return res.status(400).json({ success: false, message: 'Bu ilana zaten başvurdunuz.' }); } const listing = await db.collection("isverenler").findOne({ _id: new ObjectId(listingId) }); if (!listing) { return res.status(404).json({ success: false, message: 'İlan bulunamadı.' }); } const newApplication = { applicantId: studentId, listingId: new ObjectId(listingId), ownerId: listing.createdBy, status: 'pending', createdAt: new Date() }; await db.collection("applications").insertOne(newApplication); res.json({ success: true, message: 'Başvurunuz başarıyla gönderildi!' }); } catch (err) { res.status(500).json({ success: false, message: 'Bir hata oluştu.' }); } });
    app.post('/api/report-listing', async (req, res) => { if (!req.session.user) { return res.status(401).json({ success: false, message: 'İçerik bildirmek için giriş yapmalısınız.' }); } try { const { id, type } = req.body; const collectionName = type === 'student' ? 'ogrenciler' : 'isverenler'; await db.collection(collectionName).updateOne({ _id: new ObjectId(id) }, { $inc: { reportCount: 1 } }); res.json({ success: true, message: 'İlan bildiriminiz alınmıştır. Teşekkür ederiz.' }); } catch (err) { res.status(500).json({ success: false, message: 'Bir hata oluştu.' }); } });
    app.get('/api/notifications', async (req, res) => { if (!req.session.user || req.session.user.role !== 'employer') { return res.status(403).json([]); } try { const ownerId = new ObjectId(req.session.user.id); const notifications = await db.collection("applications").aggregate([ { $match: { ownerId: ownerId } }, { $sort: { createdAt: -1 } }, { $lookup: { from: "kullanicilar", localField: "applicantId", foreignField: "_id", as: "applicantInfo" } }, { $lookup: { from: "isverenler", localField: "listingId", foreignField: "_id", as: "listingInfo" } } ]).toArray(); res.json(notifications); } catch (err) { res.status(500).json([]); } });

    // Sunucu Başlatma
    app.listen(PORT, () => {
        console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
    });
});