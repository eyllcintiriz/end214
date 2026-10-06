// END214 – yönetim paneli (admin.html)
// Yalnızca yönetici kullanır; veritabanı kuralları başkasının yazmasına izin vermez.
// Her bölüm (sekme) ilk açıldığında bir kez kurulur: BOLUMLER[ad](kutu).
const $ = id => document.getElementById(id);
const goster = ad => ['yukleniyor', 'giris', 'yetkisiz', 'yonetici'].forEach(b => { $(b).hidden = b !== ad; });
const mesaj = (el, metin, tur) => { el.textContent = metin; el.className = 'mesaj' + (tur ? ' ' + tur : ''); };

let v;
try {
  v = await import('./veri-katmani.js?v=7ead5441');
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
const BOLUMLER = { oneriler: onerilerBolumu, bildirimler: bildirimlerBolumu, kurulum: kurulumBolumu };  // sonraki dilimlerde diğer bölümler eklenecek
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

// ── Düzeltme önerileri ──
// Her öneride şu anki hal ve önerilen hal, öğrencinin göreceği kartla aynı şekilde yan yana çizilir;
// değişen adımlar vurgulanır, altında kelime kelime fark gösterilir. Karar yalnızca yöneticinin onayıyla uygulanır.
const el = (etiket, sinif, metin) => window.el(etiket, sinif, metin);  // ortak.js

// "adimlar[2].html" → "Çözüm, 3. adım"
function yolEtiketi(yol) {
  const m = yol.match(/^(\w+)(?:\[(\d+)\])?(?:\.(\w+))?$/);
  if (!m) return yol;
  const n = m[2] != null ? +m[2] + 1 : null, alt = m[3] === 'etiket' ? ' (etiketi)' : '';
  return ({
    adimlar: `Çözüm, ${n}. adım`, siklar: `${n}. şık`, etiketler: 'Konu etiketi', metin: 'Soru metni',
    baslik: 'Soru başlığı', zorluk: 'Zorluk', cozumBaslik: 'Çözüm başlığı', no: 'Soru numarası',
  }[m[1]] || yol) + alt;
}

// Değişen alanın kartta vurgulanacak öğesi
function vurguSecici(yol) {
  const m = yol.match(/^(\w+)(?:\[(\d+)\])?/);
  const n = m[2] != null ? +m[2] + 1 : 1;
  return ({
    // .solution'ın ilk çocuğu başlıktır (.sol-title), adımlar ondan sonra gelir
    adimlar: `.solution > .sol-step:nth-child(${n + 1})`, siklar: `.q-parts > .q-part:nth-child(${n})`,
    metin: '.q-text', baslik: '.q-title', etiketler: '.q-badges', zorluk: '.q-badges', cozumBaslik: '.sol-title',
  })[m[1]];
}

// Kelime kelime fark (en uzun ortak alt dizi). Sonuç: [{ t, tur: 'ayni' | 'sil' | 'ekle' }]
function kelimeFarki(a, b) {
  const parca = x => x.match(/[\p{L}\p{N}.]+|\s+|[^\p{L}\p{N}\s]/gu) || [];
  const A = parca(a), B = parca(b), n = A.length, m = B.length;
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const sonuc = []; let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && A[i] === B[j]) { sonuc.push({ t: A[i], tur: 'ayni' }); i++; j++; }
    else if (j < m && (i === n || L[i][j + 1] >= L[i + 1][j])) sonuc.push({ t: B[j++], tur: 'ekle' });
    else sonuc.push({ t: A[i++], tur: 'sil' });
  }
  return sonuc;
}

// Farkı tek satır olarak çizer; uzun değişmeyen kısımlar "…" ile kısaltılır
function farkSatiri(fark, tur) {
  const satir = el('div', 'fark-satir');
  const parcalar = fark.filter(f => f.tur === 'ayni' || f.tur === tur);
  let ayniSayac = [];
  const ayniBosalt = (son) => {
    if (ayniSayac.length > 14) {
      const bas = son === 'bas' ? [] : ayniSayac.slice(0, 6), sonu = son === 'son' ? [] : ayniSayac.slice(-6);
      if (bas.length) satir.appendChild(document.createTextNode(bas.join('')));
      satir.appendChild(el('span', 'fark-kisalt', ' … '));
      if (sonu.length) satir.appendChild(document.createTextNode(sonu.join('')));
    } else if (ayniSayac.length) satir.appendChild(document.createTextNode(ayniSayac.join('')));
    ayniSayac = [];
  };
  let ilk = true;
  for (const f of parcalar) {
    if (f.tur === 'ayni') { ayniSayac.push(f.t); continue; }
    ayniBosalt(ilk ? 'bas' : 'orta'); ilk = false;
    satir.appendChild(el(tur === 'sil' ? 'del' : 'ins', '', f.t));
  }
  ayniBosalt(ilk ? 'bas' : 'son');
  return satir;
}

// Soruyu öğrencinin gördüğü kart olarak çizer (açık, çözüm görünür) ve değişen alanları vurgular
function kartCiz(soru, stil, degisiklikler, vurguSinif) {
  const kutu = el('div', 'karsilastir-kart');
  kutu.innerHTML = window.kartHtml(window.temizSoru(soru), window.temizStil(stil));
  const kart = kutu.firstElementChild;
  kart.classList.add('open');
  kart.querySelector('.solution').classList.add('visible');
  kart.querySelector('.sol-btn').hidden = true;
  for (const d of degisiklikler) {
    const s = vurguSecici(d.yol), hedef = s && kart.querySelector(s);
    if (hedef) hedef.classList.add(vurguSinif);
  }
  return kutu;
}

async function onerilerBolumu(kutu) {
  kutu.innerHTML = '';
  const ust = el('div', 'oneri-ust');
  const filtreler = el('div', 'oneri-filtre');
  const toplu = el('button', 'dugme', ''); toplu.type = 'button'; toplu.hidden = true;
  const topluMesaj = el('div', 'mesaj');
  ust.appendChild(filtreler); ust.appendChild(toplu);
  const liste = el('div', 'oneri-liste');
  kutu.appendChild(ust); kutu.appendChild(topluMesaj); kutu.appendChild(liste);

  let tum = [], konular = [], filtre = 'bekliyor';
  const secili = new Set();
  const FILTRE = [['bekliyor', 'Bekleyen'], ['onaylandi', 'Onaylanan'], ['reddedildi', 'Reddedilen']];

  async function yukle() {
    liste.innerHTML = '<p class="bos-mesaj">Yükleniyor…</p>';
    try {
      [tum, konular] = await Promise.all([v.oneriler(), v.tumKonularTaze()]);
    } catch (e) {
      liste.innerHTML = ''; liste.appendChild(el('p', 'mesaj hata', 'Öneriler yüklenemedi: ' + v.hataMetni(e)));
      return;
    }
    const sira = o => { const k = konular.find(x => x.kod === o.konu); return k ? k.sira * 1000 + k.sorular.findIndex(s => s.id === o.soruId) : 1e9; };
    tum.sort((a, b) => sira(a) - sira(b));
    secili.clear();
    ciz();
  }

  function ciz() {
    filtreler.innerHTML = '';
    for (const [ad, yazi] of FILTRE) {
      const n = tum.filter(o => o.durum === ad).length;
      const b = el('button', 'of-btn' + (ad === filtre ? ' aktif' : ''), `${yazi} (${n})`);
      b.type = 'button';
      b.addEventListener('click', () => { filtre = ad; secili.clear(); ciz(); });
      filtreler.appendChild(b);
    }
    topluGuncelle();
    liste.innerHTML = '';
    const gorunen = tum.filter(o => o.durum === filtre);
    if (!gorunen.length) {
      liste.appendChild(el('p', 'bos-mesaj', filtre === 'bekliyor' ? 'Onay bekleyen öneri yok.' : 'Bu grupta öneri yok.'));
      return;
    }
    for (const o of gorunen) {
      try { liste.appendChild(oneriKarti(o)); }
      catch (e) {  // tek bir bozuk kayıt bütün listeyi boş bırakmasın
        const k = el('article', 'panel oneri');
        k.appendChild(el('p', 'mesaj hata', `${o.soruId || o.id}: bu öneri gösterilemedi (${e.message}).`));
        liste.appendChild(k);
      }
    }
  }

  function topluGuncelle() {
    toplu.hidden = filtre !== 'bekliyor' || !secili.size;
    toplu.textContent = `Seçilenleri onayla (${secili.size})`;
  }

  toplu.addEventListener('click', async () => {
    const secilenler = tum.filter(o => secili.has(o.id));
    if (!confirm(`${secilenler.length} öneri onaylanacak ve sorulara uygulanacak. Devam edilsin mi?`)) return;
    toplu.disabled = true;
    let tamam = 0; const hatalar = [];
    for (const o of secilenler) {
      mesaj(topluMesaj, `Onaylanıyor… ${tamam + hatalar.length + 1} / ${secilenler.length}`);
      try { await v.oneriyiOnayla(o); tamam++; } catch (e) { hatalar.push(`${o.soruId}: ${e.message}`); }
    }
    toplu.disabled = false;
    mesaj(topluMesaj, `${tamam} öneri onaylandı.` + (hatalar.length ? `\nOnaylanamayanlar:\n${hatalar.join('\n')}` : ''), hatalar.length ? 'hata' : 'tamam');
    await yukle(); ozetiGuncelle();
  });

  function oneriKarti(o) {
    const konu = konular.find(k => k.kod === o.konu);
    const soru = konu && konu.sorular.find(s => s.id === o.soruId);
    const kart = el('article', 'panel oneri');

    // Başlık satırı
    const bas = el('div', 'oneri-baslik');
    if (o.durum === 'bekliyor') {
      const sec = el('input'); sec.type = 'checkbox'; sec.className = 'oneri-sec'; sec.title = 'Toplu onay için seç';
      sec.checked = secili.has(o.id);
      sec.addEventListener('change', () => { sec.checked ? secili.add(o.id) : secili.delete(o.id); topluGuncelle(); });
      bas.appendChild(sec);
    }
    bas.appendChild(el('span', 'oneri-no', soru ? soru.no : o.soruId));
    bas.appendChild(el('span', 'oneri-ad', window.duzMetin(o.soruBaslik || '')));
    if (o.kararDegisiyor) bas.appendChild(el('span', 'karar-rozet', 'KARAR DEĞİŞİYOR'));
    kart.appendChild(bas);
    const alt = el('div', 'oneri-alt');
    alt.appendChild(el('span', '', (konu ? konu.ad : o.konu) + ' · ' + (o.kaynak || '')));
    if (konu) { const a = el('a', '', 'Sitede gör →'); a.href = `${konu.sayfa}#${o.soruId}`; a.target = '_blank'; a.rel = 'noopener'; alt.appendChild(a); }
    if (o.durum !== 'bekliyor') {
      const t = o.kararTarihi && !isNaN(o.kararTarihi) ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long', timeStyle: 'short' }).format(o.kararTarihi) : '';
      alt.appendChild(el('span', 'durum-rozet ' + o.durum,
        (o.durum === 'onaylandi' ? 'Onaylandı' + (o.duzenlendi ? ' (düzenlenerek)' : '') : 'Reddedildi') + (t ? ' · ' + t : '')));
    }
    kart.appendChild(alt);
    kart.appendChild(el('p', 'oneri-gerekce', o.gerekce || ''));

    if (!soru) {
      kart.appendChild(el('p', 'mesaj hata', 'Bu öneriye ait soru veritabanında bulunamadı (silinmiş olabilir).'));
      return kart;
    }

    // Karşılaştırma: onaylanmışsa soru zaten yeni halde; sol tarafı geri hesapla
    const degisiklikler = o.durum === 'onaylandi' ? (o.uygulanan || o.degisiklikler) : o.degisiklikler;
    let eskiSoru, yeniSoru, cakisma = [];
    try {
      if (o.durum === 'onaylandi') { yeniSoru = soru; eskiSoru = v.degisiklikleriUygula(soru, degisiklikler, 'eski'); }
      else { cakisma = v.cakismalar(soru, o.degisiklikler); eskiSoru = soru; yeniSoru = v.degisiklikleriUygula(soru, degisiklikler); }
    } catch (e) { cakisma = ['?']; eskiSoru = soru; yeniSoru = soru; }
    if (cakisma.length && o.durum === 'bekliyor') {
      kart.appendChild(el('p', 'mesaj hata', 'Bu soru, öneri hazırlandıktan sonra değiştirilmiş. Öneri otomatik uygulanamaz; ' +
        'gerekirse soruyu "Sorular" bölümünden elle düzeltip öneriyi reddedin.'));
    }
    const grid = el('div', 'karsilastir');
    const solBaslik = o.durum === 'onaylandi' ? 'Önceki hal' : 'Şu anki hal (sitede görünen)';
    const sagBaslik = o.durum === 'onaylandi' ? 'Uygulanan hal (sitede görünen)' : 'Önerilen hal';
    const sol = el('div', 'karsilastir-sutun'), sag = el('div', 'karsilastir-sutun');
    sol.appendChild(el('h4', '', solBaslik)); sag.appendChild(el('h4', '', sagBaslik));
    sol.appendChild(kartCiz(eskiSoru, konu.stil, degisiklikler, 'degisti-eski'));
    sag.appendChild(kartCiz(yeniSoru, konu.stil, degisiklikler, 'degisti-yeni'));
    grid.appendChild(sol); grid.appendChild(sag);
    kart.appendChild(grid);

    // Değişen kısımlar (kelime kelime)
    const farklar = el('div', 'fark-liste');
    const farklariCiz = degs => {
      farklar.innerHTML = '';
      farklar.appendChild(el('h4', '', 'Değişen kısımlar'));
      for (const d of degs) {
        const blok = el('div', 'fark-blok');
        blok.appendChild(el('div', 'fark-etiket', yolEtiketi(d.yol)));
        const a = window.duzMetin(typeof d.eski === 'string' ? d.eski : JSON.stringify(d.eski));
        const b = window.duzMetin(typeof d.yeni === 'string' ? d.yeni : JSON.stringify(d.yeni));
        if (a === b) blok.appendChild(el('div', 'fark-satir', 'Yazı aynı; yalnızca şekil ya da biçim değişti (yukarıdaki kartlara bakın).'));
        else { const f = kelimeFarki(a, b); blok.appendChild(farkSatiri(f, 'sil')); blok.appendChild(farkSatiri(f, 'ekle')); }
        farklar.appendChild(blok);
      }
    };
    farklariCiz(degisiklikler);
    kart.appendChild(farklar);

    // Düğmeler
    const dugmeler = el('div', 'oneri-dugmeler'), m = el('div', 'mesaj');
    const dugme = (yazi, sinif, fn) => { const b = el('button', 'dugme ' + sinif, yazi); b.type = 'button'; b.addEventListener('click', fn); dugmeler.appendChild(b); return b; };
    const islem = async (fn, bekleme, basari) => {
      dugmeler.querySelectorAll('button').forEach(b => { b.disabled = true; });
      mesaj(m, bekleme);
      try { await fn(); mesaj(m, basari, 'tamam'); setTimeout(async () => { await yukle(); ozetiGuncelle(); }, 900); }
      catch (e) { mesaj(m, e.message || v.hataMetni(e), 'hata'); dugmeler.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
    };

    if (o.durum === 'bekliyor') {
      const onay = dugme('Onayla', '', () => islem(() => v.oneriyiOnayla(o), 'Onaylanıyor…', 'Onaylandı; soru sitede güncellendi.'));
      const duzenle = dugme('Düzenleyip onayla', 'dugme-ikincil', () => duzenlemeAc());
      dugme('Reddet', 'dugme-tehlike', () => {
        if (confirm('Öneri reddedilecek; soru olduğu gibi kalacak. Devam edilsin mi?')) islem(() => v.oneriyiReddet(o), 'Reddediliyor…', 'Reddedildi.');
      });
      if (cakisma.length) { onay.disabled = true; duzenle.disabled = true; }

      // Düzenleyip onayla: önerilen metinler düzenlenir, sağdaki kart ve farklar anında güncellenir
      const duzen = el('div', 'oneri-duzen'); duzen.hidden = true;
      const duzenlemeAc = () => {
        duzen.hidden = false; dugmeler.hidden = true;
        duzen.innerHTML = '';
        duzen.appendChild(el('h4', '', 'Önerilen hali düzenleyin'));
        duzen.appendChild(el('p', 'oneri-ipucu', 'Metinler sitedeki biçimiyle (HTML) duruyor: <sub>…</sub> alt simge, <sup>…</sup> üst simge, <span class="result">…</span> sonuç vurgusu, <br> satır sonu.'));
        const alanlar = o.degisiklikler.map(d => {
          const l = el('label', '', yolEtiketi(d.yol));
          const ta = el('textarea', 'oneri-ta'); ta.value = typeof d.yeni === 'string' ? d.yeni : JSON.stringify(d.yeni);
          ta.rows = Math.min(10, 2 + Math.ceil(ta.value.length / 90));
          ta.disabled = typeof d.yeni !== 'string';
          duzen.appendChild(l); duzen.appendChild(ta);
          return { d, ta };
        });
        const sonHal = () => alanlar.map(({ d, ta }) => (typeof d.yeni === 'string' ? { ...d, yeni: ta.value } : d));
        const onizle = () => {
          try {
            const y = v.degisiklikleriUygula(soru, sonHal());
            sag.replaceChild(kartCiz(y, konu.stil, o.degisiklikler, 'degisti-yeni'), sag.querySelector('.karsilastir-kart'));
            farklariCiz(sonHal());
          } catch (e) { /* yazarken geçici hata */ }
        };
        alanlar.forEach(({ ta }) => ta.addEventListener('input', onizle));
        const db = el('div', 'oneri-dugmeler');
        const kaydet = el('button', 'dugme', 'Düzenlenmiş hali onayla'); kaydet.type = 'button';
        const vazgec = el('button', 'dugme dugme-ikincil', 'Vazgeç'); vazgec.type = 'button';
        kaydet.addEventListener('click', async () => {
          kaydet.disabled = vazgec.disabled = true; mesaj(m, 'Onaylanıyor…');
          try { await v.oneriyiOnayla(o, sonHal()); mesaj(m, 'Düzenlenmiş hali onaylandı; soru sitede güncellendi.', 'tamam'); setTimeout(async () => { await yukle(); ozetiGuncelle(); }, 900); }
          catch (e) { mesaj(m, e.message || v.hataMetni(e), 'hata'); kaydet.disabled = vazgec.disabled = false; }
        });
        vazgec.addEventListener('click', () => {
          duzen.hidden = true; dugmeler.hidden = false; mesaj(m, '');
          sag.replaceChild(kartCiz(yeniSoru, konu.stil, degisiklikler, 'degisti-yeni'), sag.querySelector('.karsilastir-kart'));
          farklariCiz(degisiklikler);
        });
        db.appendChild(kaydet); db.appendChild(vazgec); duzen.appendChild(db);
      };
      kart.appendChild(dugmeler); kart.appendChild(duzen);
    } else {
      dugme('Kararı geri al', 'dugme-ikincil', () => {
        const yazi = o.durum === 'onaylandi'
          ? 'Onay geri alınacak: soru önceki haline dönecek, öneri tekrar onay bekleyecek. Devam edilsin mi?'
          : 'Ret geri alınacak: öneri tekrar onay bekleyecek. Devam edilsin mi?';
        if (confirm(yazi)) islem(() => v.oneriKarariniGeriAl(o), 'Geri alınıyor…', 'Karar geri alındı.');
      });
      kart.appendChild(dugmeler);
    }
    kart.appendChild(m);
    return kart;
  }

  await yukle();
}

// ── Hata bildirimleri (gelen kutusu) ──
async function bildirimlerBolumu(kutu) {
  kutu.innerHTML = '';
  const filtreler = el('div', 'oneri-filtre');
  const liste = el('div', 'bildirim-liste');
  kutu.appendChild(filtreler); kutu.appendChild(liste);
  let tum = [], konular = [], filtre = 'yeni';
  const FILTRE = [['yeni', 'Yeni'], ['cozuldu', 'Çözüldü'], ['tumu', 'Tümü']];
  const zaman = t => t && !isNaN(t) ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long', timeStyle: 'short' }).format(t) : '';

  async function yukle() {
    liste.innerHTML = '<p class="bos-mesaj">Yükleniyor…</p>';
    try {
      [tum, konular] = await Promise.all([v.hataBildirimleri(), v.tumKonular()]);
    } catch (e) {
      liste.innerHTML = ''; liste.appendChild(el('p', 'mesaj hata', 'Bildirimler yüklenemedi: ' + v.hataMetni(e)));
      return;
    }
    ciz();
  }

  function ciz() {
    filtreler.innerHTML = '';
    for (const [ad, yazi] of FILTRE) {
      const n = ad === 'tumu' ? tum.length : tum.filter(b => b.durum === ad).length;
      const b = el('button', 'of-btn' + (ad === filtre ? ' aktif' : ''), `${yazi} (${n})`);
      b.type = 'button';
      b.addEventListener('click', () => { filtre = ad; ciz(); });
      filtreler.appendChild(b);
    }
    liste.innerHTML = '';
    const gorunen = tum.filter(b => filtre === 'tumu' || b.durum === filtre);
    if (!gorunen.length) {
      liste.appendChild(el('p', 'bos-mesaj', filtre === 'yeni' ? 'Yeni hata bildirimi yok.' : 'Bu grupta bildirim yok.'));
      return;
    }
    for (const b of gorunen) {
      try { liste.appendChild(bildirimKarti(b)); }
      catch (e) { liste.appendChild(el('p', 'mesaj hata', `Bir bildirim gösterilemedi (${e.message}).`)); }
    }
  }

  function bildirimKarti(b) {
    let konu = null, soru = null;
    for (const k of konular) { const s = k.sorular.find(x => x.id === b.soruId); if (s) { konu = k; soru = s; break; } }
    const kart = el('article', 'panel bildirim' + (b.durum === 'yeni' ? ' yeni' : ''));

    const bas = el('div', 'oneri-baslik');
    if (b.soruId) {
      bas.appendChild(el('span', 'oneri-no', soru ? soru.no : b.soruId));
      bas.appendChild(el('span', 'oneri-ad', soru ? window.duzMetin(soru.baslik) : '(soru bulunamadı)'));
    } else {
      bas.appendChild(el('span', 'oneri-no genel', 'Genel'));
      bas.appendChild(el('span', 'oneri-ad', 'Genel bildirim'));
    }
    if (b.durum === 'cozuldu') bas.appendChild(el('span', 'durum-rozet onaylandi', '✓ Çözüldü'));
    kart.appendChild(bas);

    const alt = el('div', 'oneri-alt');
    alt.appendChild(el('span', '', zaman(b.tarih)));
    alt.appendChild(el('span', '', (konu ? konu.ad + ' · ' : '') + (b.sayfa || '')));
    alt.appendChild(el('span', '', 'Gönderen: ' + (b.ad || 'isimsiz') + (b.uid ? ' (öğrenci hesabı)' : '')));
    if (b.eposta) alt.appendChild(el('span', 'kullanici', b.eposta));
    kart.appendChild(alt);

    kart.appendChild(el('p', 'bildirim-mesaj', b.mesaj || ''));

    const dugmeler = el('div', 'oneri-dugmeler'), m = el('div', 'mesaj');
    const bag = (yazi, href, sinif) => {
      const a = el('a', 'dugme ' + (sinif || 'dugme-ikincil'), yazi);
      a.href = href;
      if (!href.startsWith('mailto:')) { a.target = '_blank'; a.rel = 'noopener'; }
      dugmeler.appendChild(a);
    };
    const dugme = (yazi, sinif, fn) => { const x = el('button', 'dugme ' + sinif, yazi); x.type = 'button'; x.addEventListener('click', fn); dugmeler.appendChild(x); };
    const islem = async (fn, basari) => {
      dugmeler.querySelectorAll('button').forEach(x => { x.disabled = true; });
      try { await fn(); mesaj(m, basari, 'tamam'); setTimeout(() => { ciz(); ozetiGuncelle(); }, 600); }
      catch (e) { mesaj(m, v.hataMetni(e), 'hata'); dugmeler.querySelectorAll('button').forEach(x => { x.disabled = false; }); }
    };

    if (b.durum === 'yeni') dugme('Çözüldü olarak işaretle', '', () => islem(async () => { await v.bildirimDurumu(b.id, 'cozuldu'); b.durum = 'cozuldu'; }, 'Çözüldü olarak işaretlendi.'));
    else dugme('Yeniden aç', 'dugme-ikincil', () => islem(async () => { await v.bildirimDurumu(b.id, 'yeni'); b.durum = 'yeni'; }, 'Yeniden açıldı.'));
    if (konu) bag('Soruyu sitede aç →', `${konu.sayfa}#${b.soruId}`);
    else if (b.sayfa && /^[a-z]+\.html$/.test(b.sayfa)) bag('Sayfayı aç →', b.sayfa);
    if (b.eposta && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.eposta)) {
      const konuSatiri = 'END214 – ' + (b.soruId ? (soru ? soru.no : b.soruId) + ' hata bildiriminiz' : 'bildiriminiz');
      bag('E-postayla yanıtla', `mailto:${b.eposta}?subject=${encodeURIComponent(konuSatiri)}`);
    }
    dugme('Sil', 'dugme-tehlike', () => {
      if (confirm('Bu bildirim kalıcı olarak silinecek. Devam edilsin mi?')) {
        islem(async () => { await v.bildirimSil(b.id); tum = tum.filter(x => x.id !== b.id); }, 'Silindi.');
      }
    });
    kart.appendChild(dugmeler); kart.appendChild(m);
    return kart;
  }

  await yukle();
}
