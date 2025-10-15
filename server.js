require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const app = express();
const PORT = 3000;
const Filter = require('@2toad/profanity').Profanity;
const filter = new Filter();

const turkceArgolar = ['aptal', 'salak', 'gerizekalı', 'lan'];
filter.addWords(turkceArgolar);

const connectionString = process.env.DATABASE_URL;

const client = new MongoClient(connectionString);
let db;

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
    // Middleware (Yardımcı Ayarlar)
    app.use(express.static('public'));
    app.use(express.json());
    app.use(session({
        secret: 'cok-gizli-bir-anahtar-kelime',
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({ mongoUrl: connectionString })
    }));
// Multer (Dosya Yükleme) Ayarları
    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, 'public/uploads'); // Dosyaların kaydedileceği klasör
        },
        filename: function (req, file, cb) {
            // Dosyaya benzersiz bir isim veriyoruz (tarih + orijinal isim)
            cb(null, Date.now() + '-' + file.originalname);
        }
    });
    const upload = multer({ storage: storage });
    // ===============================================
    //           KULLANICI YÖNETİMİ API'LARI
    // ===============================================

    app.post('/api/register', async (req, res) => {
        try {
            const { name, email, pass, role } = req.body; // Formdan gelen veriler

            // --- YENİ GÜVENLİK KONTROLÜ ---
            // Kullanıcı adını argo kelimeler için kontrol et
            if (filter.check(name)) {
                return res.status(400).json({ success: false, message: 'Kullanıcı adında uygun olmayan kelimeler tespit edildi. Lütfen farklı bir ad seçin.' });
            }
            // ---------------------------------

            // Bu e-posta zaten kayıtlı mı diye kontrol et
            const existingUser = await db.collection("kullanicilar").findOne({ email: email });
            if (existingUser) {
                return res.json({ success: false, message: 'Bu e-posta adresi zaten kullanılıyor.' });
            }

            // Şifreyi hash'le
            const hashedPassword = await bcrypt.hash(pass, 10);

            // Yeni kullanıcıyı veritabanına kaydet
            await db.collection("kullanicilar").insertOne({
                name: name,
                email: email,
                password: hashedPassword,
                role: role
            });

            console.log('Yeni kullanıcı kaydedildi:', email);
            res.json({ success: true, message: 'Kayıt başarılı! Giriş yapabilirsiniz.' });

        } catch (err) {
            console.error('Kayıt sırasında hata:', err);
            res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' });
        }
    });

    app.post('/api/login', async (req, res) => {
        try {
            const { email, pass, remember } = req.body; // "remember" verisini de alıyoruz
            const user = await db.collection("kullanicilar").findOne({ email: email });

            if (!user) {
                return res.json({ success: false, message: 'Hatalı e-posta veya şifre.' });
            }

            const isPasswordCorrect = await bcrypt.compare(pass, user.password);

            if (!isPasswordCorrect) {
                return res.json({ success: false, message: 'Hatalı e-posta veya şifre.' });
            }

            // Kullanıcı bilgilerini session'a kaydediyoruz
            req.session.user = {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            };

            // YENİ EKLENEN BÖLÜM
            if (remember) {
                // Eğer "Beni Hatırla" seçiliyse, cookie'nin ömrünü 30 gün yap
                req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 gün (milisaniye cinsinden)
            } else {
                // Seçili değilse, tarayıcı kapanınca silinsin (varsayılan davranış)
                req.session.cookie.expires = false;
            }

            console.log('Kullanıcı giriş yaptı:', user.email);
            res.json({ success: true, message: 'Giriş başarılı!' });

        } catch (err) {
            console.error('Giriş sırasında hata:', err);
            res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' });
        }
    });

    // YENİ API ENDPOINT: İşverenin kendi ilanlarına gelen başvuruları (bildirimleri) getirir
    app.get('/api/notifications', async (req, res) => {
        if (!req.session.user || req.session.user.role !== 'employer') {
            return res.status(403).json([]); // Sadece işverenler için çalışır, hata yerine boş liste döneriz
        }
        try {
            const ownerId = new ObjectId(req.session.user.id);

            // "applications" koleksiyonunda bu işverene ait olan başvuruları bul.
            // Ayrıca, başvuran öğrencinin ve ilanın detaylarını da getirmek için $lookup kullanıyoruz.
            const notifications = await db.collection("applications").aggregate([
                { $match: { ownerId: ownerId } }, // Sadece benim ilanlarıma gelen başvuruları bul
                { $sort: { createdAt: -1 } }, // En yeniden eskiye sırala
                {
                    $lookup: { // Başvuran öğrencinin bilgilerini "kullanicilar" koleksiyonundan çek
                        from: "kullanicilar",
                        localField: "applicantId",
                        foreignField: "_id",
                        as: "applicantInfo"
                    }
                },
                {
                    $lookup: { // Başvurulan ilanın bilgilerini "isverenler" koleksiyonundan çek
                        from: "isverenler",
                        localField: "listingId",
                        foreignField: "_id",
                        as: "listingInfo"
                    }
                }
            ]).toArray();

            res.json(notifications);

        } catch (err) {
            console.error("Bildirimler getirilirken hata:", err);
            res.status(500).json([]);
        }
    });

    // YENİ API ENDPOINT: Bir ilanı silmek için
    app.post('/api/delete-listing', async (req, res) => {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Bu işlem için giriş yapmalısınız.' });
        }
        try {
            const { id, type } = req.body; // Silinecek ilanın ID'si ve tipi (student/employer)
            const collectionName = type === 'student' ? 'ogrenciler' : 'isverenler';

            // Güvenlik Kontrolü: İlanı silmeye çalışan kişi, ilanın sahibi mi?
            const listing = await db.collection(collectionName).findOne({ _id: new ObjectId(id) });
            if (!listing) {
                return res.status(404).json({ success: false, message: 'İlan bulunamadı.' });
            }
            if (listing.createdBy !== req.session.user.id) {
                return res.status(403).json({ success: false, message: 'Bu ilanı silme yetkiniz yok.' });
            }

            // Güvenlik kontrolü başarılı, ilanı sil
            await db.collection(collectionName).deleteOne({ _id: new ObjectId(id) });

            res.json({ success: true, message: 'İlan başarıyla silindi.' });

        } catch (err) {
            console.error('İlan silinirken hata:', err);
            res.status(500).json({ success: false, message: 'Bir hata oluştu.' });
        }
    });

    app.get('/api/current-user', (req, res) => {
        if (req.session.user) {
            res.json(req.session.user);
        } else {
            res.json(null);
        }
    });

    // YENİ API ENDPOINT: Bir işveren ilanına başvurmak için
    app.post('/api/apply', async (req, res) => {
        // 1. Kullanıcı giriş yapmış mı ve rolü 'student' mı diye kontrol et
        if (!req.session.user || req.session.user.role !== 'student') {
            return res.status(403).json({ success: false, message: 'Bu işlem için öğrenci olarak giriş yapmalısınız.' });
        }

        try {
            const { listingId } = req.body; // Butona tıklandığında gelen ilan ID'si
            const studentId = new ObjectId(req.session.user.id);

            // 2. Bu öğrenci bu ilana daha önce başvurmuş mu diye kontrol et (spam'i önlemek için)
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

    // YENİ API ENDPOINT: Bir ilanı şikayet etmek için
    app.post('/api/report-listing', async (req, res) => {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'İçerik bildirmek için giriş yapmalısınız.' });
        }
        try {
            const { id, type } = req.body; // Şikayet edilen ilanın ID'si ve tipi
            const collectionName = type === 'student' ? 'ogrenciler' : 'isverenler';

            // MongoDB'nin $inc operatörünü kullanarak reportCount alanını 1 artırıyoruz.
            // Eğer bu alan yoksa, MongoDB onu otomatik olarak 1 değeriyle oluşturur.
            await db.collection(collectionName).updateOne(
                { _id: new ObjectId(id) },
                { $inc: { reportCount: 1 } }
            );

            res.json({ success: true, message: 'İlan bildiriminiz alınmıştır. Teşekkür ederiz.' });

        } catch (err) {
            console.error('İlan şikayet edilirken hata:', err);
            res.status(500).json({ success: false, message: 'Bir hata oluştu.' });
        }
    });

    app.get('/api/logout', (req, res) => {
        req.session.destroy(err => {
            if (err) { return res.json({ success: false }); }
            res.clearCookie('connect.sid');
            res.json({ success: true });
        });
    });

    // ===============================================
    //           İLAN YÖNETİMİ API'LARI
    // ===============================================

    // YENİ API ENDPOINT: Düzenlemek için tek bir ilanın verisini getirir
    app.get('/api/listing/:id', async (req, res) => {
        try {
            const { id } = req.params; // URL'den ID'yi alıyoruz (örn: /api/listing/68ed09...)
            const { type } = req.query; // URL'den tipi alıyoruz (?type=student)
            const collectionName = type === 'student' ? 'ogrenciler' : 'isverenler';

            const listing = await db.collection(collectionName).findOne({ _id: new ObjectId(id) });

            if (!listing) {
                return res.status(404).json({ message: 'İlan bulunamadı.' });
            }
            res.json(listing);
        } catch (err) {
            console.error("Tekil ilan getirilirken sunucu hatası:", err);
            res.status(500).json({ message: 'Sunucu hatası.' });
        }
    });

    // YENİ API ENDPOINT: Şifre sıfırlama isteği için
    app.post('/api/forgot-password', async (req, res) => {
        try {
            const { email } = req.body;
            const user = await db.collection("kullanicilar").findOne({ email: email });

            if (!user) {
                console.log(`Şifre sıfırlama isteği (Kullanıcı bulunamadı): ${email}`);
                return res.json({ success: true, message: 'Eğer bu e-posta adresi sistemimizde kayıtlıysa, şifre sıfırlama linki gönderilecektir.' });
            }

            // 1. Güvenli bir sıfırlama anahtarı (token) oluştur
            const resetToken = crypto.randomBytes(20).toString('hex');

            // 2. Bu anahtarı ve son kullanma tarihini (1 saat sonrası) veritabanına kaydet
            await db.collection("kullanicilar").updateOne(
                { _id: user._id },
                {
                    $set: {
                        resetPasswordToken: resetToken,
                        resetPasswordExpires: Date.now() + 3600000 // 1 saat (milisaniye cinsinden)
                    }
                }
            );

            // 3. E-posta göndermek için sahte bir test hesabı oluştur (Ethereal)
            let testAccount = await nodemailer.createTestAccount();
            let transporter = nodemailer.createTransport({
                host: "smtp.ethereal.email",
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user, // Sahte kullanıcı adı
                    pass: testAccount.pass, // Sahte şifre
                },
            });

            // 4. E-postayı gönder
            const resetURL = `http://localhost:3000/reset-password.html?token=${resetToken}`;
            let info = await transporter.sendMail({
                from: '"Stajla Destek" <destek@stajla.com>',
                to: user.email,
                subject: "Stajla Şifre Sıfırlama İsteği",
                html: `
                <p>Merhaba ${user.name},</p>
                <p>Şifrenizi sıfırlamak için aşağıdaki linke tıklayınız. Bu link 1 saat geçerlidir.</p>
                <a href="${resetURL}">${resetURL}</a>
                <p>Eğer bu isteği siz yapmadıysanız, bu e-postayı görmezden geliniz.</p>
            `,
            });

            console.log("E-posta gönderildi. Mesaj ID:", info.messageId);
            // E-postayı görmek için terminalde çıkacak linki takip et:
            console.log("Test E-postasını Görüntüle: %s", nodemailer.getTestMessageUrl(info));

            res.json({ success: true, message: 'Eğer bu e-posta adresi sistemimizde kayıtlıysa, şifre sıfırlama linki gönderilecektir.' });

        } catch (err) {
            console.error('Şifre sıfırlama sırasında hata:', err);
            res.status(500).json({ success: false, message: 'Bir hata oluştu.' });
        }
    });

    // YENİ API ENDPOINT: Gelen token ile şifreyi güncellemek için
    app.post('/api/reset-password', async (req, res) => {
        try {
            const { token, newPassword } = req.body;

            // 1. Verilen token'a sahip ve token'ın süresi dolmamış bir kullanıcı bul
            const user = await db.collection("kullanicilar").findOne({
                resetPasswordToken: token,
                resetPasswordExpires: { $gt: Date.now() } // Son kullanma tarihi şu anki zamandan büyük olmalı
            });

            if (!user) {
                return res.json({ success: false, message: 'Şifre sıfırlama anahtarı geçersiz veya süresi dolmuş.' });
            }

            // 2. Yeni şifreyi hash'le
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // 3. Kullanıcının şifresini güncelle ve sıfırlama bilgilerini temizle (tekrar kullanılmasın diye)
            await db.collection("kullanicilar").updateOne(
                { _id: user._id },
                {
                    $set: {
                        password: hashedPassword,
                        resetPasswordToken: undefined,
                        resetPasswordExpires: undefined
                    }
                }
            );

            res.json({ success: true, message: 'Şifreniz başarıyla güncellendi. Şimdi giriş yapabilirsiniz.' });

        } catch (err) {
            console.error('Şifre güncellenirken hata:', err);
            res.status(500).json({ success: false, message: 'Bir hata oluştu.' });
        }
    });

    // YENİ API ENDPOINT: Mevcut bir ilanı güncellemek için
    app.post('/api/update-listing', async (req, res) => {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Bu işlem için giriş yapmalısınız.' });
        }
        try {
            const { id, type, data } = req.body;
            const collectionName = type === 'student' ? 'ogrenciler' : 'isverenler';

            // Güvenlik Kontrolü: İlanı düzenlemeye çalışan kişi, ilanın sahibi mi?
            const listing = await db.collection(collectionName).findOne({ _id: new ObjectId(id) });
            if (!listing) {
                return res.status(404).json({ success: false, message: 'İlan bulunamadı.' });
            }
            if (listing.createdBy !== req.session.user.id) {
                return res.status(403).json({ success: false, message: 'Bu ilanı düzenleme yetkiniz yok.' });
            }

            // Güvenlik kontrolü başarılı, ilanı güncelle
            await db.collection(collectionName).updateOne(
                { _id: new ObjectId(id) }, // Hangi ilanı güncelleyeceğimizi belirtiyoruz
                { $set: data } // Hangi alanları yeni veriyle değiştireceğimizi belirtiyoruz
            );

            res.json({ success: true, message: 'İlan başarıyla güncellendi.' });

        } catch (err) {
            console.error('İlan güncellenirken hata:', err);
            res.status(500).json({ success: false, message: 'Bir hata oluştu.' });
        }
    });

    // YENİ API ENDPOINT: Arama yapmak için
    app.get('/api/search', async (req, res) => {
        try {
            const { type, area, city } = req.query; // Tarayıcının gönderdiği arama kriterlerini alıyoruz (?type=...&area=...&city=...)

            const filter = {}; // Boş bir filtre nesnesi oluşturuyoruz
            if (area) filter.area = area; // Eğer alan belirtilmişse, filtreye ekle
            if (city) filter.city = city; // Eğer şehir belirtilmişse, filtreye ekle

            let collectionName = 'ogrenciler'; // Varsayılan olarak öğrencileri ara
            if (type === 'jobs') {
                collectionName = 'isverenler'; // Eğer tip 'jobs' ise işverenleri ara
            }

            // Belirlenen koleksiyonda, oluşturduğumuz filtreye göre arama yap
            const results = await db.collection(collectionName).find(filter).sort({_id: -1}).toArray();

            res.json(results); // Sonuçları tarayıcıya gönder

        } catch (err) {
            console.error('Arama sırasında hata:', err);
            res.status(500).json({ success: false, message: 'Arama sırasında bir hata oluştu.' });
        }
    });

    // Öğrenci ilanı oluşturma - ARTIK DOSYA YÜKLEME DESTEKLİYOR
    app.post('/api/ogrenci-ilan', upload.single('cv'), async (req, res) => {
        // 1. Giriş yapılmış mı diye kontrol et
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'İlan eklemek için giriş yapmalısınız.' });
        }

        // --- YENİ GÜVENLİK KONTROLÜ (ROL KONTROLÜ) ---
        // 2. Kullanıcının rolü 'student' mı diye kontrol et
        if (req.session.user.role !== 'student') {
            return res.status(403).json({ success: false, message: 'Sadece öğrenciler ilan oluşturabilir.' });
        }
        // ---------------------------------------------

        try {
            const yeniIlan = req.body;

            // 3. Argo kelime kontrolü
            if (filter.check(yeniIlan.name) || filter.check(yeniIlan.desc) || filter.check(yeniIlan.dept)) {
                return res.status(400).json({ success: false, message: 'İlan içeriğinde uygun olmayan kelimeler tespit edildi. Lütfen düzeltin.' });
            }

            // 4. Veriyi veritabanına kaydet
            yeniIlan.createdBy = req.session.user.id;
            if (req.file) {
                yeniIlan.cvPath = req.file.path.replace('public', '');
            }
            await db.collection("ogrenciler").insertOne(yeniIlan);

            res.json({ success: true, message: 'İlan başarıyla eklendi!' });

        } catch (err) {
            console.error('İlan eklenirken hata:', err);
            res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' });
        }
    });

    app.get('/api/ogrenci-ilanlari', async (req, res) => {
        try {
            const ilanlar = await db.collection("ogrenciler").find().sort({_id: -1}).limit(6).toArray();
            res.json(ilanlar);
        } catch (err) {
            console.error('İlanlar getirilirken hata:', err);
            res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' });
        }
    });

    app.post('/api/isveren-ilan', async (req, res) => {
        if (!req.session.user) { // Kullanıcı giriş yapmamışsa ilan eklemesini engelle
            return res.status(401).json({ success: false, message: 'İlan eklemek için giriş yapmalısınız.' });
        }
        if (req.session.user.role !== 'student') {
            return res.status(403).json({ success: false, message: 'Sadece öğrenciler ilan oluşturabilir.' });
        }
        try {
            const yeniIlan = req.body;

            // --- YENİ GÜVENLİK KONTROLÜ ---
            // Firma adı, sektör, nitelikler gibi metin alanlarını kontrol et
            if (filter.check(yeniIlan.company) || filter.check(yeniIlan.sector) || filter.check(yeniIlan.req)) {
                return res.status(400).json({ success: false, message: 'İlan içeriğinde uygun olmayan kelimeler tespit edildi. Lütfen düzeltin.' });
            }
            // ---------------------------------

            yeniIlan.createdBy = req.session.user.id; // İlanı oluşturan kullanıcının ID'sini ekle

            const sonuc = await db.collection("isverenler").insertOne(yeniIlan);
            console.log('Yeni işveren ilanı eklendi:', sonuc);
            res.json({ success: true, message: 'İlan başarıyla eklendi!' });
        } catch (err) {
            console.error('İşveren ilanı eklenirken hata:', err);
            res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' });
        }
    });

    app.get('/api/isveren-ilanlari', async (req, res) => {
        try {
            const ilanlar = await db.collection("isverenler").find().sort({_id: -1}).limit(6).toArray();
            res.json(ilanlar);
        } catch (err) {
            console.error('İşveren ilanları getirilirken hata:', err);
            res.status(500).json({ success: false, message: 'Sunucuda bir hata oluştu.' });
        }
    });

    // YENİ API ENDPOINT: Mevcut bir ilanı güncellemek için
    app.post('/api/update-listing', async (req, res) => {
        // Giriş yapılıp yapılmadığını kontrol et
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Bu işlem için giriş yapmalısınız.' });
        }
        try {
            const { id, type, data } = req.body; // Gelen veriyi ayrıştır
            const collectionName = type === 'student' ? 'ogrenciler' : 'isverenler';

            // GÜVENLİK KONTROLÜ: İlanı düzenlemeye çalışan kişi, ilanın sahibi mi?
            const listing = await db.collection(collectionName).findOne({ _id: new ObjectId(id) });

            if (!listing) {
                return res.status(404).json({ success: false, message: 'İlan bulunamadı.' });
            }
            // İlanın sahibi ile giriş yapan kullanıcının ID'si eşleşmiyorsa, yetkisiz işlem hatası ver.
            if (listing.createdBy.toString() !== req.session.user.id.toString()) {
                return res.status(403).json({ success: false, message: 'Bu ilanı düzenleme yetkiniz yok.' });
            }

            // Güvenlik kontrolü başarılı, ilanı güncelle
            await db.collection(collectionName).updateOne(
                { _id: new ObjectId(id) }, // Hangi ilanı güncelleyeceğimizi belirtiyoruz
                { $set: data } // Hangi alanları yeni veriyle değiştireceğimizi belirtiyoruz
            );

            res.json({ success: true, message: 'İlan başarıyla güncellendi.' });

        } catch (err) {
            console.error('İlan güncellenirken hata:', err);
            res.status(500).json({ success: false, message: 'Bir hata oluştu.' });
        }
    });

    // YENİ API ENDPOINT: Sadece giriş yapmış kullanıcının ilanlarını getirir
    app.get('/api/my-listings', async (req, res) => {
        if (!req.session.user) {
            return res.status(401).json({ message: 'Lütfen giriş yapın.' });
        }
        try {
            const userId = req.session.user.id;
            // Hem öğrenci hem de işveren koleksiyonlarında bu kullanıcının ilanlarını ara
            const studentListings = await db.collection("ogrenciler").find({ createdBy: userId }).toArray();
            const employerListings = await db.collection("isverenler").find({ createdBy: userId }).toArray();

            // İki listeyi birleştirip gönder
            res.json({ student: studentListings, employer: employerListings });
        } catch (err) {
            res.status(500).json({ message: 'İlanlar getirilirken bir hata oluştu.' });
        }
    });

    // Sunucu Başlatma
    app.listen(PORT, () => {
        console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
    });
});