// END214 – yönetim paneli (admin.html)
// Yalnızca yönetici kullanır; veritabanı kuralları başkasının yazmasına izin vermez.
// Her bölüm (sekme) ilk açıldığında bir kez kurulur: BOLUMLER[ad](kutu).
const $ = id => document.getElementById(id);
const goster = ad => ['yukleniyor', 'giris', 'yetkisiz', 'yonetici'].forEach(b => { $(b).hidden = b !== ad; });
const mesaj = (el, metin, tur) => { el.textContent = metin; el.className = 'mesaj' + (tur ? ' ' + tur : ''); };

let v;
try {
  v = await import('./veri-katmani.js?v=8d3d4323');
} catch (e) {
  $('yukleniyor').innerHTML = '<p class="mesaj hata">Veritabanına bağlanılamadı. İnternet bağlantınızı kontrol edip sayfayı yenileyin.</p>';
  throw e;
}

// ── Sekmeler ──
const SEKMELER = [
  ['oneriler', 'Düzeltme Önerileri'], ['bildirimler', 'Hata Bildirimleri'], ['sorular', 'Sorular'],
  ['formuller', 'Formül Kartları'], ['duyurular', 'Duyurular'], ['ders', 'Ders Bilgileri'],
  ['ayarlar', 'Ayarlar'], ['kurulum', 'Kurulum'],
];
const BOLUMLER = { kurulum: kurulumBolumu };  // sonraki dilimlerde diğer bölümler eklenecek
const kurulanlar = new Set();

function sekmeleriKur() {
  const cubuk = $('sekmeler');
  for (const [ad, yazi] of SEKMELER) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ys-btn'; b.dataset.sekme = ad; b.setAttribute('role', 'tab');
    b.textContent = yazi;
    b.addEventListener('click', () => { location.hash = ad; });
    cubuk.appendChild(b);
  }
  window.addEventListener('hashchange', sekmeAc);
}

function sekmeAc() {
  const ad = SEKMELER.some(s => s[0] === location.hash.slice(1)) ? location.hash.slice(1) : 'oneriler';
  document.querySelectorAll('.ys-btn').forEach(b => {
    b.classList.toggle('aktif', b.dataset.sekme === ad);
    b.setAttribute('aria-selected', b.dataset.sekme === ad);
  });
  document.querySelectorAll('[data-bolum]').forEach(k => { k.hidden = k.dataset.bolum !== ad; });
  if (!kurulanlar.has(ad) && BOLUMLER[ad]) {
    kurulanlar.add(ad);
    BOLUMLER[ad](document.querySelector(`[data-bolum="${ad}"]`));
  }
}

// Açılıştaki özet ve sekmelerdeki sayı rozetleri
async function ozetiGuncelle() {
  const ozet = $('ozet');
  try {
    const s = await v.bekleyenSayilari();
    const rozet = (ad, n) => {
      const b = document.querySelector(`.ys-btn[data-sekme="${ad}"]`);
      let r = b.querySelector('.ys-sayi');
      if (!r) { r = document.createElement('span'); r.className = 'ys-sayi'; b.appendChild(r); }
      r.textContent = n; r.hidden = !n;
    };
    rozet('oneriler', s.oneri); rozet('bildirimler', s.bildirim);
    ozet.innerHTML = '';
    const satir = (n, varYazi, yokYazi, sekme) => {
      const a = document.createElement('a');
      a.href = '#' + sekme; a.className = 'ozet-satir' + (n ? ' var' : '');
      a.textContent = n ? `${n} ${varYazi}` : yokYazi;
      ozet.appendChild(a);
    };
    satir(s.oneri, 'düzeltme önerisi onayınızı bekliyor', 'Onay bekleyen düzeltme önerisi yok', 'oneriler');
    satir(s.bildirim, 'yeni hata bildirimi var', 'Yeni hata bildirimi yok', 'bildirimler');
  } catch (e) {
    mesaj(ozet, 'Özet yüklenemedi: ' + v.hataMetni(e), 'hata');
  }
}

// Henüz yapılmamış bölümler için
document.querySelectorAll('[data-bolum]').forEach(k => {
  if (!k.children.length) k.innerHTML = '<div class="panel"><p>Bu bölüm hazırlanıyor.</p></div>';
});

// ── Giriş / çıkış ──
let panelKuruldu = false;
v.girisDurumu(async k => {
  if (!k) return goster('giris');
  document.querySelectorAll('[data-kullanici]').forEach(el => { el.textContent = k.eposta; });
  goster('yukleniyor');
  let yetkili = false;
  try { yetkili = await v.yoneticiMi(); } catch (e) { /* yetkisiz say */ }
  if (!yetkili) return goster('yetkisiz');
  goster('yonetici');
  if (!panelKuruldu) { panelKuruldu = true; sekmeleriKur(); }
  sekmeAc();
  ozetiGuncelle();
});

$('giris').addEventListener('submit', async e => {
  e.preventDefault();
  mesaj($('girisMesaj'), 'Giriş yapılıyor…');
  try {
    await v.girisYap($('eposta').value.trim(), $('sifre').value);
    $('sifre').value = '';
    mesaj($('girisMesaj'), '');
  } catch (err) {
    mesaj($('girisMesaj'), v.hataMetni(err), 'hata');
  }
});

$('sifremiUnuttum').addEventListener('click', async () => {
  const eposta = $('eposta').value.trim();
  if (!eposta) return mesaj($('girisMesaj'), 'Önce e-posta adresinizi yazın.', 'hata');
  try {
    await v.sifreSifirla(eposta);
    mesaj($('girisMesaj'), 'Bu adres kayıtlıysa şifre sıfırlama bağlantısı gönderildi. Gelen kutunuzu (ve gereksiz klasörünü) kontrol edin.', 'tamam');
  } catch (err) {
    mesaj($('girisMesaj'), v.hataMetni(err), 'hata');
  }
});

document.querySelectorAll('[data-cikis]').forEach(b => b.addEventListener('click', () => v.cikisYap()));

// ── Kurulum: tek seferlik içe aktarma ──
// Anahtar sırasından bağımsız karşılaştırma (Firestore alanları farklı sırayla döndürebilir)
const kanonik = x => Array.isArray(x) ? '[' + x.map(kanonik).join(',') + ']'
  : x && typeof x === 'object' ? '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + kanonik(x[k])).join(',') + '}'
  : JSON.stringify(x);

async function kurulumBolumu() {
  let konular, oneriler;
  try {
    [konular, oneriler] = await Promise.all([
      fetch('veri/konular.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(d => d.konular),
      fetch('veri/oneriler.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(d => d.oneriler),
    ]);
    const soru = konular.reduce((t, k) => t + k.sorular.length, 0);
    const formul = konular.reduce((t, k) => t + k.formul.kartlar.length, 0);
    $('dosyaOzet').textContent = `Dosyada: ${konular.length} konu, ${soru} soru, ${formul} formül kartı, ${oneriler.length} düzeltme önerisi.`;
    $('iceAktar').disabled = false;
  } catch (e) {
    $('dosyaOzet').textContent = 'Veri dosyaları okunamadı (' + e.message + ').';
  }

  $('iceAktar').addEventListener('click', async () => {
    const dugme = $('iceAktar'), m = $('aktarMesaj');
    dugme.disabled = true;
    try {
      mesaj(m, 'Veritabanındaki mevcut kayıtlar kontrol ediliyor…');
      const mevcut = await v.mevcutKayitlar(konular, oneriler);
      if (mevcut.konular.length || mevcut.oneriler.length) {
        const devam = confirm(`Veritabanında zaten ${mevcut.konular.length} konu ve ${mevcut.oneriler.length} öneri var.\n\n` +
          'Devam ederseniz bunların üzerine dosyadaki hali yazılır; panelden yapılmış değişiklikler ve öneri kararları kaybolur.\n\nYine de devam edilsin mi?');
        if (!devam) { mesaj(m, 'İptal edildi. Hiçbir şey yazılmadı.'); return; }
      }
      mesaj(m, 'Yazılıyor…');
      const sonuc = await v.iceAktar(konular, oneriler);

      // Doğrulama: her konuyu veritabanından geri okuyup dosyayla karşılaştır
      mesaj(m, 'Yazıldı. Doğrulanıyor…');
      let ayni = 0;
      for (const k of konular) {
        const db = await v.konuGetir(k.kod);
        if (db) { delete db.guncellendi; if (kanonik(db) === kanonik(k)) ayni++; }
      }
      mesaj(m, `${sonuc.konu} konu ve ${sonuc.oneri} öneri veritabanına yazıldı.\n` +
        `Doğrulama: ${ayni}/${konular.length} konu veritabanından geri okundu ve dosyayla birebir aynı` + (ayni === konular.length ? ' ✓' : ' ✗'),
        ayni === konular.length ? 'tamam' : 'hata');
      ozetiGuncelle();
    } catch (err) {
      mesaj(m, 'Hata: ' + v.hataMetni(err), 'hata');
    } finally {
      dugme.disabled = false;
    }
  });
}
