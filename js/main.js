/* main.js
  Basit client-side prototip:
  - Öğrenci ilanları -> localStorage 'students' listesi
  - İş ilanları -> localStorage 'jobs' listesi
  - Kayıt / giriş -> localStorage 'users' (prototip amaçlı)
  - Arama / filtreleme ana sayfada çalışır
*/

function readList(key) {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
}
function writeList(key, list) {
    localStorage.setItem(key, JSON.stringify(list));
}

if (!localStorage.getItem('initialized_demo')) {
    writeList('students', [
        { id:1, name:'Ali Yılmaz', dept:'Makine - Mehmet Akif', city:'Burdur', area:'Makine Mühendisliği', desc:'2. sınıf, yaz stajı arıyorum', contact:'ali@mail.com', cvBase64:'' }
    ]);
    writeList('jobs', [
        { id:1, company:'ABC Mühendislik', sector:'Üretim', city:'İstanbul', area:'Makine Mühendisliği', req:'AutoCAD bilen, ekip çalışmasına uygun', contact:'hr@abc.com' }
    ]);
    localStorage.setItem('initialized_demo','1');
}

/* --- Öğrenci formu işlemleri --- */
const studentForm = document.getElementById('student-form');
if (studentForm) {
    studentForm.addEventListener('submit', function(e){
        e.preventDefault();
        const cvInput = document.getElementById('s-cv');
        const s = {
            id: Date.now(),
            name: document.getElementById('s-name').value.trim(),
            dept: document.getElementById('s-dept').value.trim(),
            city: document.getElementById('s-city').value,
            area: document.getElementById('s-area').value,
            desc: document.getElementById('s-desc').value.trim(),
            contact: document.getElementById('s-contact').value.trim(),
            cvBase64: ''
        };
        if (cvInput && cvInput.files && cvInput.files[0]) {
            const file = cvInput.files[0];
            const reader = new FileReader();
            reader.onload = function(ev) {
                s.cvBase64 = ev.target.result; // base64 (uyarı: localStorage limitine dikkat)
                const list = readList('students');
                list.unshift(s);
                writeList('students', list);
                alert('Öğrenci ilanınız kaydedildi!');
                studentForm.reset();
                renderStudents();
            };
            reader.readAsDataURL(file);
        } else {
            const list = readList('students');
            list.unshift(s);
            writeList('students', list);
            alert('Öğrenci ilanınız kaydedildi!');
            studentForm.reset();
            renderStudents();
        }
    });
}

/* --- İşveren formu işlemleri --- */
const jobForm = document.getElementById('job-form');
if (jobForm) {
    jobForm.addEventListener('submit', function(e){
        e.preventDefault();
        const j = {
            id: Date.now(),
            company: document.getElementById('j-company').value.trim(),
            sector: document.getElementById('j-sector').value.trim(),
            city: document.getElementById('j-city').value,
            area: document.getElementById('j-area').value,
            req: document.getElementById('j-req').value.trim(),
            contact: document.getElementById('j-contact').value.trim()
        };
        const list = readList('jobs');
        list.unshift(j);
        writeList('jobs', list);
        alert('İlan başarıyla paylaşıldı!');
        jobForm.reset();
        renderJobs();
    });
}

/* --- Render fonksiyonları --- */
function renderStudents(containerId='students-list') {
    const cont = document.getElementById(containerId);
    if (!cont) return;
    const list = readList('students');
    cont.innerHTML = '';
    if (list.length === 0) { cont.innerHTML = '<p>Henüz aday yok.</p>'; return; }
    list.forEach(s => {
        const el = document.createElement('div');
        el.className = 'card';
        el.innerHTML = `<h4>${escapeHtml(s.name)}</h4>
      <p><strong>${escapeHtml(s.area)}</strong> — ${escapeHtml(s.city)}</p>
      <p>${escapeHtml(s.dept)}</p>
      <p>${escapeHtml(s.desc)}</p>
      <p>İletişim: <strong>${escapeHtml(s.contact)}</strong></p>
      ${s.cvBase64 ? `<p><a href="${s.cvBase64}" target="_blank">CV indir</a></p>` : ''}`;
        cont.appendChild(el);
    });
}

function renderJobs(containerId='jobs-list') {
    const cont = document.getElementById(containerId);
    if (!cont) return;
    const list = readList('jobs');
    cont.innerHTML = '';
    if (list.length === 0) { cont.innerHTML = '<p>Henüz ilan yok.</p>'; return; }
    list.forEach(j => {
        const el = document.createElement('div');
        el.className = 'card';
        el.innerHTML = `<h4>${escapeHtml(j.company)}</h4>
      <p><strong>${escapeHtml(j.area)}</strong> — ${escapeHtml(j.city)}</p>
      <p>${escapeHtml(j.sector)}</p>
      <p>${escapeHtml(j.req)}</p>
      <p>İletişim: <strong>${escapeHtml(j.contact)}</strong></p>`;
        cont.appendChild(el);
    });
}

/* --- Ana sayfa: sonuçlar render ve arama --- */
function renderResultsOnHome() {
    const container = document.getElementById('results-container');
    if (!container) return;
    const jobs = readList('jobs');
    const students = readList('students');
    container.innerHTML = '';
    const makeCard = (title, subtitle, text, contact) => {
        const el = document.createElement('div');
        el.className = 'card';
        el.style.width = '280px';
        el.innerHTML = `<h4>${escapeHtml(title)}</h4><p>${escapeHtml(subtitle)}</p><p>${escapeHtml(text)}</p><p>İletişim: <strong>${escapeHtml(contact)}</strong></p>`;
        return el;
    };
    jobs.slice(0,3).forEach(j => container.appendChild(makeCard(j.company, j.area+' — '+j.city, j.req, j.contact)));
    students.slice(0,3).forEach(s => container.appendChild(makeCard(s.name, s.area+' — '+s.city, s.dept, s.contact)));
}

const searchBtn = document.getElementById('search-btn');
if (searchBtn) {
    searchBtn.addEventListener('click', function(){
        const type = document.getElementById('search-type').value;
        const area = document.getElementById('search-area').value;
        const city = document.getElementById('search-city').value;
        performSearch(type, area, city);
    });
}

function performSearch(type, area, city) {
    const results = [];
    if (type === 'students') {
        let list = readList('students');
        if (area) list = list.filter(x => x.area === area);
        if (city) list = list.filter(x => x.city === city);
        results.push(...list);
        displaySearchResults(results, 'Adaylar (Öğrenciler)');
    } else {
        let list = readList('jobs');
        if (area) list = list.filter(x => x.area === area);
        if (city) list = list.filter(x => x.city === city);
        results.push(...list);
        displaySearchResults(results, 'İlanlar (İşverenler)');
    }
}

function displaySearchResults(list, title) {
    const w = window.open('','search-window','width=900,height=700,scrollbars=yes');
    let html = `<html><head><title>Arama Sonuçları</title><link rel="stylesheet" href="css/style.css"></head><body><h2 style="text-align:center">${title}</h2><div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center">`;
    if (list.length===0) html += `<p>Sonuç bulunamadı.</p>`;
    else {
        list.forEach(item => {
            html += `<div class="card" style="width:300px;padding:14px">
        <h4>${escapeHtml(item.company||item.name)}</h4>
        <p><strong>${escapeHtml(item.area)}</strong> — ${escapeHtml(item.city)}</p>
        <p>${escapeHtml(item.dept||item.sector||'')}</p>
        <p>${escapeHtml(item.desc||item.req||'')}</p>
        <p>İletişim: <strong>${escapeHtml(item.contact)}</strong></p>
        ${item.cvBase64 ? `<p><a href="${item.cvBase64}" target="_blank">CV indir</a></p>` : ''}
      </div>`;
        });
    }
    html += `</div></body></html>`;
    w.document.write(html);
    w.document.close();
}

/* --- Basit kayıt/giriş (prototip) --- */
const registerBtn = document.getElementById('register-btn');
if (registerBtn) {
    registerBtn.addEventListener('click', function(){
        const role = document.getElementById('reg-role').value;
        const name = document.getElementById('reg-name').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const pass = document.getElementById('reg-pass').value;
        if (!email || !pass) return alert('Email ve şifre gerekli');
        const users = readList('users');
        if (users.find(u=>u.email===email)) return alert('Bu email zaten kayıtlı');
        users.push({id:Date.now(), role, name, email, pass});
        writeList('users', users);
        alert('Kayıt başarılı. Giriş yapabilirsiniz.');
        document.getElementById('reg-name').value='';
        document.getElementById('reg-email').value='';
        document.getElementById('reg-pass').value='';
    });
}

const loginBtn = document.getElementById('login-btn');
if (loginBtn) {
    loginBtn.addEventListener('click', function(){
        const email = document.getElementById('login-email').value.trim();
        const pass = document.getElementById('login-pass').value;
        const users = readList('users');
        const user = users.find(u=>u.email===email && u.pass===pass);
        if (!user) return alert('Hatalı email veya şifre');
        localStorage.setItem('currentUser', JSON.stringify(user));
        alert('Giriş başarılı: ' + user.name);
        showUserInfo();
    });
}

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', function(){
        localStorage.removeItem('currentUser');
        showUserInfo();
    });
}

function showUserInfo() {
    const container = document.getElementById('user-info');
    const welcome = document.getElementById('user-welcome');
    const curr = localStorage.getItem('currentUser');
    if (!container || !welcome) return;
    if (!curr) {
        container.style.display='none';
        return;
    }
    const user = JSON.parse(curr);
    container.style.display='block';
    welcome.innerText = `Hoş geldin, ${user.name} (${user.role})`;
}

/* --- Güvenlik / yardımcı --- */
function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&<>"'`=/]/g, function(s) {
        return ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;','/':'&#47;','=':'&#61;'
        })[s];
    });
}

/* --- Sayfa yüklendiğinde render --- */
window.addEventListener('load', function(){
    renderStudents();
    renderJobs();
    renderResultsOnHome();
    showUserInfo();
});
