// END214 – yönetim paneli (admin.html)
// Yalnızca yönetici kullanır; veritabanı kuralları başkasının yazmasına izin vermez.
// Her bölüm (sekme) ilk açıldığında bir kez kurulur: BOLUMLER[ad](kutu).
const $ = id => document.getElementById(id);
const goster = ad => ['yukleniyor', 'giris', 'yetkisiz', 'yonetici'].forEach(b => { $(b).hidden = b !== ad; });
const mesaj = (el, metin, tur) => { el.textContent = metin; el.className = 'mesaj' + (tur ? ' ' + tur : ''); };

let v;
try {
  v = await import('./veri-katmani.js?v=862f0688');
} catch (e) {
  $('yukleniyor').innerHTML = '<p class="mesaj hata">Veritabanına bağlanılamadı. İnternet bağlantınızı kontrol edip sayfayı yenileyin.</p>';
  throw e;
}

// ── Sekmeler ──
const SEKMELER = [
  ['oneriler', 'Düzeltme Önerileri'], ['bildirimler', 'Hata Bildirimleri'], ['sorular', 'Sorular'],
  ['formuller', 'Formül Kartları'], ['duyurular', 'Duyurular'], ['ders', 'Ders Bilgileri'],
  ['ayarlar', 'Ayarlar'], ['yedek', 'Yedek'],
];
const BOLUMLER = {
  oneriler: onerilerBolumu, bildirimler: bildirimlerBolumu, sorular: sorularBolumu, formuller: formullerBolumu,
  duyurular: duyurularBolumu, ders: dersBolumu, ayarlar: ayarlarBolumu, yedek: yedekBolumu,
};
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

// Siteden gelen kısayollar sekmenin ardından hedefi de taşır: #sorular/ga/GA-04, #sorular/ga/yeni, #formuller/ga, #duyurular/yeni.
// Hedef, bölüm kurulunca açılır; adres çubuğunda yalnızca sekme adı kalır.
const hedefAcicilar = {};
let bekleyenHedef = null;
function hedefIste(ad, ek) {
  if (hedefAcicilar[ad]) hedefAcicilar[ad](ek); else bekleyenHedef = { ad, ek };
}
function hedefKaydet(ad, fn) {
  hedefAcicilar[ad] = fn;
  if (bekleyenHedef && bekleyenHedef.ad === ad) { const h = bekleyenHedef; bekleyenHedef = null; fn(h.ek); }
}

// Siteden gelindiyse "Siteye Dön" geldiği sayfaya (ör. ga.html#GA-04) götürür; yalnızca bu sitenin bir sayfası olabilir
const donus = new URLSearchParams(location.search).get('donus') || '';
if (/^[a-z]+\.html(#[A-Za-z]+-\d+)?$/.test(donus)) {
  const geri = document.querySelector('.topnav .nav-links a');
  if (geri) { geri.href = donus; geri.textContent = '← Siteye Dön'; }
}

function sekmeAc() {
  const [ilk, ...ek] = decodeURIComponent(location.hash.slice(1)).split('/');
  const ad = SEKMELER.some(s => s[0] === ilk) ? ilk : 'oneriler';
  if (ek.length) history.replaceState(null, '', location.pathname + location.search + '#' + ad);
  document.querySelectorAll('.ys-btn').forEach(b => {
    b.classList.toggle('aktif', b.dataset.sekme === ad);
    b.setAttribute('aria-selected', b.dataset.sekme === ad);
  });
  document.querySelectorAll('[data-bolum]').forEach(k => { k.hidden = k.dataset.bolum !== ad; });
  if (!kurulanlar.has(ad) && BOLUMLER[ad]) {
    kurulanlar.add(ad);
    BOLUMLER[ad](document.querySelector(`[data-bolum="${ad}"]`));
  }
  if (ek.length) hedefIste(ad, ek);
}

// Kaydettikten sonra: "… sitede hemen görünür. Sitede gör →"
function basariMesaji(kutu, metin, adres) {
  mesaj(kutu, metin + ' ', 'tamam');
  const a = el('a', '', 'Sitede gör →'); a.href = adres;
  kutu.appendChild(a);
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

// ── Yedek: bütün içeriği tek JSON dosyası olarak indir ──
async function yedekBolumu() {
  $('yedekIndir').addEventListener('click', async () => {
    const dugme = $('yedekIndir'), m = $('yedekMesaj');
    dugme.disabled = true; mesaj(m, 'Veriler okunuyor…');
    try {
      const yedek = await v.yedekVerisi();
      const ad = `END214-yedek-${window.gunYazi(new Date())}.json`;
      const url = URL.createObjectURL(new Blob([JSON.stringify(yedek, null, 1)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = ad;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      const soru = yedek.konular.reduce((t, k) => t + k.sorular.length, 0);
      const formul = yedek.konular.reduce((t, k) => t + k.formul.kartlar.length, 0);
      mesaj(m, `${ad} indirildi: ${yedek.konular.length} konu, ${soru} soru, ${formul} formül kartı, ` +
        `${yedek.oneriler.length} öneri, ${yedek.duyurular.length} duyuru, ${yedek.hataBildirimleri.length} hata bildirimi.`, 'tamam');
    } catch (e) { mesaj(m, 'Yedek alınamadı: ' + v.hataMetni(e), 'hata'); }
    finally { dugme.disabled = false; }
  });
  kurulumBolumu();
}

// ── İlk kurulum: tek seferlik içe aktarma (Yedek sekmesinde, "Gelişmiş" altında) ──

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
          'Devam ederseniz bunların üzerine dosyadaki ilk hal yazılır; panelden yapılmış BÜTÜN değişiklikler (soru düzenlemeleri, yeni sorular, ' +
          'formül kartları, öneri kararları) kaybolur. Önce yedeği indirdiğinizden emin olun.\n\nYine de devam edilsin mi?');
        if (!devam) { mesaj(m, 'İptal edildi. Hiçbir şey yazılmadı.'); return; }
      }
      mesaj(m, 'Yazılıyor…');
      const sonuc = await v.iceAktar(konular, oneriler);

      // Doğrulama: her konuyu veritabanından geri okuyup dosyayla karşılaştır
      mesaj(m, 'Yazıldı. Doğrulanıyor…');
      let ayni = 0;
      for (const k of konular) {
        const db = await v.konuGetir(k.kod);
        if (db) { delete db.guncellendi; if (v.kanonik(db) === v.kanonik(k)) ayni++; }
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
      try { await v.oneriyiOnayla(o); tamam++; } catch (e) { hatalar.push(`${o.soruId}: ${v.hataMetni(e)}`); }
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
      catch (e) { mesaj(m, v.hataMetni(e), 'hata'); dugmeler.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
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
          catch (e) { mesaj(m, v.hataMetni(e), 'hata'); kaydet.disabled = vazgec.disabled = false; }
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
      [tum, konular] = await Promise.all([v.hataBildirimleri(), v.tumKonularTaze()]);
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
    if (konu) dugme('Soruyu düzenle', 'dugme-ikincil', () => soruyuDuzenle(konu.kod, b.soruId));
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

// ── Form yardımcıları (duyurular, ders bilgileri, ayarlar) ──
// Kaydedilmemiş değişiklik varken sayfa kapatılır ya da yenilenirse tarayıcı uyarır.
const kaydedilmemis = new Set();
window.addEventListener('beforeunload', e => { if (kaydedilmemis.size) { e.preventDefault(); e.returnValue = ''; } });

let alanNo = 0;
// Etiketli giriş alanı. tur: 'textarea' ya da input türü ('text', 'date', 'url', 'email')
function alanEkle(ust, etiket, tur = 'text', ipucu = '') {
  const g = tur === 'textarea' ? el('textarea') : el('input');
  if (tur !== 'textarea') g.type = tur;
  g.id = 'ys-alan-' + (++alanNo);
  const l = el('label', '', etiket); l.htmlFor = g.id;
  ust.appendChild(l); ust.appendChild(g);
  if (ipucu) ust.appendChild(el('p', 'ys-ipucu', ipucu));
  return g;
}
const dugmeYap = (yazi, sinif = '') => { const b = el('button', ('dugme ' + sinif).trim(), yazi); b.type = 'button'; return b; };

// Satır ekle-sil listesi (sınavlar, değerlendirme, kaynaklar). sutunlar: [{ ad, etiket, tur?, dar? }]
function satirListesi(ust, sutunlar, degerler, ekleYazi, degisti) {
  const govde = el('div', 'ys-satirlar');
  const ekle = el('button', 'baglanti ys-ekle', ekleYazi); ekle.type = 'button';
  ust.appendChild(govde); ust.appendChild(ekle);
  const satirEkle = (deger = {}) => {
    const satir = el('div', 'ys-satir');
    for (const s of sutunlar) {
      const g = el('input'); g.type = s.tur || 'text';
      g.placeholder = s.etiket; g.setAttribute('aria-label', s.etiket); g.dataset.ad = s.ad;
      if (s.dar) g.classList.add('dar');
      if (s.ad === 'yuzde') g.inputMode = 'decimal';
      g.value = deger[s.ad] != null ? deger[s.ad] : '';
      satir.appendChild(g);
    }
    const sil = el('button', 'ys-satir-sil', '✕'); sil.type = 'button'; sil.title = 'Satırı sil'; sil.setAttribute('aria-label', 'Satırı sil');
    sil.addEventListener('click', () => { satir.remove(); degisti(); });
    satir.appendChild(sil);
    govde.appendChild(satir);
    return satir;
  };
  (degerler || []).forEach(d => satirEkle(d));
  ekle.addEventListener('click', () => { satirEkle().querySelector('input').focus(); });
  return { oku: () => [...govde.children].map(satir => Object.fromEntries([...satir.querySelectorAll('input')].map(g => [g.dataset.ad, g.value]))) };
}

// ── Duyurular ──
// Liste, sitedeki duyuru kartlarıyla (ortak.js duyuruKarti) aynı görünür; formda yazarken önizleme anında güncellenir.
async function duyurularBolumu(kutu) {
  kutu.innerHTML = '';
  const ust = el('div', 'oneri-ust');
  ust.appendChild(el('p', 'ys-aciklama', 'Duyurular en yeni üstte sıralanır. Ana sayfada son 3 duyuru, Duyurular sayfasında hepsi görünür.'));
  const yeniBtn = dugmeYap('+ Yeni duyuru');
  yeniBtn.addEventListener('click', () => formAc(null));
  ust.appendChild(yeniBtn);
  const formKutu = el('div'), listeMesaj = el('div', 'mesaj'), liste = el('div', 'ys-duyurular');
  kutu.appendChild(ust); kutu.appendChild(formKutu); kutu.appendChild(listeMesaj); kutu.appendChild(liste);
  let tum = [], acikId = null;

  async function yukle() {
    liste.innerHTML = '<p class="bos-mesaj">Yükleniyor…</p>';
    try { tum = await v.duyurular(); }
    catch (e) { liste.innerHTML = ''; liste.appendChild(el('p', 'mesaj hata', 'Duyurular yüklenemedi: ' + v.hataMetni(e))); return; }
    ciz();
  }

  function ciz() {
    liste.innerHTML = '';
    if (!tum.length) { liste.appendChild(el('p', 'bos-mesaj', 'Henüz duyuru yok. "+ Yeni duyuru" ile ilk duyuruyu ekleyebilirsiniz.')); return; }
    for (const d of tum) {
      const sar = el('div', 'ys-duyuru');
      sar.appendChild(window.duyuruKarti(d));
      const dugmeler = el('div', 'oneri-dugmeler'), m = el('div', 'mesaj');
      const duzenle = dugmeYap('Düzenle', 'dugme-ikincil'), sil = dugmeYap('Sil', 'dugme-tehlike');
      duzenle.addEventListener('click', () => formAc(d));
      sil.addEventListener('click', async () => {
        if (!confirm(`"${d.baslik}" duyurusu kalıcı olarak silinecek. Devam edilsin mi?`)) return;
        duzenle.disabled = sil.disabled = true;
        try {
          await v.duyuruSil(d.id);
          if (acikId === d.id) formuKapat();
          tum = tum.filter(x => x.id !== d.id);
          mesaj(listeMesaj, 'Duyuru silindi.', 'tamam');
          ciz();
        } catch (e) { mesaj(m, v.hataMetni(e), 'hata'); duzenle.disabled = sil.disabled = false; }
      });
      dugmeler.appendChild(duzenle); dugmeler.appendChild(sil);
      sar.appendChild(dugmeler); sar.appendChild(m);
      liste.appendChild(sar);
    }
  }

  function formuKapat() { kaydedilmemis.delete('duyuru'); formKutu.innerHTML = ''; acikId = null; }

  // d: düzenlenecek duyuru, null: yeni duyuru
  function formAc(d) {
    if (kaydedilmemis.has('duyuru') && !confirm('Açık formdaki kaydedilmemiş değişiklikler kaybolacak. Devam edilsin mi?')) return;
    formuKapat();
    acikId = d ? d.id : null;
    mesaj(listeMesaj, '');
    const panel = el('div', 'panel ys-form');
    panel.appendChild(el('h2', '', d ? 'Duyuruyu düzenle' : 'Yeni duyuru'));
    const duzen = el('div', 'ys-duzen'), sol = el('div'), sag = el('div', 'ys-onizleme');
    const tarih = alanEkle(sol, 'Tarih', 'date');
    const baslik = alanEkle(sol, 'Başlık'); baslik.classList.add('genis'); baslik.maxLength = 200;
    const metin = alanEkle(sol, 'Metin', 'textarea', 'Düz yazı. Satır sonları sitede aynen korunur.'); metin.rows = 6;
    const link = alanEkle(sol, 'Bağlantı (isteğe bağlı)', 'url', 'Örneğin bir Drive dosyası ya da sayfa. https:// ile başlamalı.'); link.classList.add('genis');
    const linkUyari = el('p', 'ys-ipucu uyari', 'Bağlantı https:// ile başlamalı; bu haliyle sitede gösterilmez.'); linkUyari.hidden = true;
    sol.appendChild(linkUyari);
    const linkYazi = alanEkle(sol, 'Bağlantı yazısı (isteğe bağlı)', 'text', 'Boş bırakılırsa "Bağlantıyı aç" yazar.');
    const gecerliTarih = d && d.tarih instanceof Date && !isNaN(d.tarih);
    tarih.value = window.gunYazi(gecerliTarih ? d.tarih : new Date());
    if (d) { baslik.value = d.baslik || ''; metin.value = d.metin || ''; link.value = d.link || ''; linkYazi.value = d.linkYazi || ''; }

    // Gün değişmediyse eski zaman aynen kalır; yeni gün seçilirse o anki saat eklenir
    // (aynı gün eklenen duyurular eklenme sırasıyla dizilsin)
    const tarihHesapla = () => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tarih.value);
      if (!m) return new Date(NaN);
      if (gecerliTarih && window.gunYazi(d.tarih) === tarih.value) return d.tarih;
      const simdi = new Date();
      return new Date(+m[1], m[2] - 1, +m[3], simdi.getHours(), simdi.getMinutes(), simdi.getSeconds());
    };
    const veri = () => ({ tarih: tarihHesapla(), baslik: baslik.value, metin: metin.value, link: link.value, linkYazi: linkYazi.value });

    sag.appendChild(el('h4', '', 'Önizleme · sitede böyle görünecek'));
    const onizKutu = el('div', 'duyuru-liste');
    sag.appendChild(onizKutu);
    const onizle = () => {
      const x = veri();
      x.baslik = x.baslik.trim() || '(başlık)'; x.metin = x.metin.trim(); x.link = x.link.trim(); x.linkYazi = x.linkYazi.trim();
      onizKutu.innerHTML = '';
      onizKutu.appendChild(window.duyuruKarti(x));
      linkUyari.hidden = !x.link || /^(https?:|mailto:)/i.test(x.link);
    };

    const dugmeler = el('div', 'oneri-dugmeler'), m = el('div', 'mesaj');
    const kaydet = dugmeYap(d ? 'Değişiklikleri kaydet' : 'Duyuruyu yayınla'), vazgec = dugmeYap('Vazgeç', 'dugme-ikincil');
    kaydet.addEventListener('click', async () => {
      kaydet.disabled = vazgec.disabled = true; mesaj(m, 'Kaydediliyor…');
      try {
        if (d) await v.duyuruGuncelle(d.id, veri()); else await v.duyuruEkle(veri());
        formuKapat();
        basariMesaji(listeMesaj, d ? 'Duyuru güncellendi.' : 'Duyuru yayınlandı; sitede hemen görünür.', 'duyurular.html');
        await yukle();
      } catch (e) { mesaj(m, v.hataMetni(e), 'hata'); kaydet.disabled = vazgec.disabled = false; }
    });
    vazgec.addEventListener('click', () => {
      if (kaydedilmemis.has('duyuru') && !confirm('Kaydedilmemiş değişiklikler kaybolacak. Vazgeçilsin mi?')) return;
      formuKapat();
    });
    dugmeler.appendChild(kaydet); dugmeler.appendChild(vazgec);

    duzen.appendChild(sol); duzen.appendChild(sag);
    panel.appendChild(duzen); panel.appendChild(dugmeler); panel.appendChild(m);
    panel.addEventListener('input', () => { kaydedilmemis.add('duyuru'); onizle(); });
    formKutu.appendChild(panel);
    onizle();
    if (panel.scrollIntoView) panel.scrollIntoView({ block: 'start', behavior: 'smooth' });
    baslik.focus();
  }

  hedefKaydet('duyurular', ([ne]) => { if (ne === 'yeni') formAc(null); });
  await yukle();
}

// ── Ders bilgileri (site/ders) ──
// Boş bırakılan her bölüm sitede "Henüz eklenmedi." olarak görünür; hiçbir bilgi tahmin edilip doldurulmaz.
async function dersBolumu(kutu) {
  kutu.innerHTML = '<p class="bos-mesaj">Yükleniyor…</p>';
  let ders;
  try { ders = await v.dersBilgileri(); }
  catch (e) { kutu.innerHTML = ''; kutu.appendChild(el('p', 'mesaj hata', 'Ders bilgileri yüklenemedi: ' + v.hataMetni(e))); return; }
  kutu.innerHTML = '';
  const panel = el('div', 'panel ys-form');
  panel.appendChild(el('p', '', 'Bu bilgiler sitedeki Ders Bilgileri sayfasında görünür. Boş bıraktığınız bölümlerde sitede "Henüz eklenmedi." yazar.'));
  const bolum = baslik => { const b = el('div', 'ys-bolum'); b.appendChild(el('h3', '', baslik)); panel.appendChild(b); return b; };
  const degisti = () => { kaydedilmemis.add('ders'); toplamGuncelle(); };

  const genel = bolum('Ders hakkında');
  const tanim = alanEkle(genel, 'Dersin tanımı', 'textarea'); tanim.rows = 4; tanim.value = ders.tanim || '';
  const dersSaatleri = alanEkle(genel, 'Ders saatleri'); dersSaatleri.classList.add('genis'); dersSaatleri.value = ders.dersSaatleri || '';
  const derslik = alanEkle(genel, 'Derslik'); derslik.value = ders.derslik || '';

  const sinavlar = satirListesi(bolum('Sınav tarihleri'), [
    { ad: 'ad', etiket: 'Sınav adı' }, { ad: 'tarih', etiket: 'Tarih', tur: 'date', dar: true },
    { ad: 'saat', etiket: 'Saat', dar: true }, { ad: 'yer', etiket: 'Yer' },
  ], ders.sinavlar, '+ Sınav ekle', degisti);

  const degBolum = bolum('Değerlendirme');
  const degerlendirme = satirListesi(degBolum, [
    { ad: 'ad', etiket: 'Kalem (ör. Arasınav)' }, { ad: 'yuzde', etiket: 'Yüzde', dar: true },
  ], ders.degerlendirme, '+ Satır ekle', degisti);
  const toplam = el('p', 'ys-ipucu'); degBolum.appendChild(toplam);
  function toplamGuncelle() {
    const sayilar = degerlendirme.oku().filter(k => k.yuzde.trim()).map(k => Number(k.yuzde.trim().replace(',', '.')));
    const t = sayilar.reduce((a, b) => a + b, 0), yuz = Math.abs(t - 100) < 1e-9;
    toplam.textContent = !sayilar.length ? '' : isNaN(t) ? 'Yüzdelerden biri sayı değil.' : `Toplam: %${+t.toFixed(2)}` + (yuz ? ' ✓' : ' (100 değil)');
    toplam.classList.toggle('uyari', sayilar.length > 0 && (isNaN(t) || !yuz));
  }

  const kaynaklar = satirListesi(bolum('Kaynaklar'), [{ ad: 'metin', etiket: 'Kaynak (kitap, ders notu, bağlantı…)' }],
    (ders.kaynaklar || []).map(k => ({ metin: k })), '+ Kaynak ekle', degisti);

  const il = bolum('İletişim'), i = ders.iletisim || {};
  il.appendChild(el('p', 'ys-ipucu', 'Öğretim üyesinin adı sayfada zaten yazılı.'));
  const eposta = alanEkle(il, 'E-posta', 'email'); eposta.value = i.eposta || '';
  const ofis = alanEkle(il, 'Ofis'); ofis.value = i.ofis || '';
  const ofisSaatleri = alanEkle(il, 'Ofis saatleri'); ofisSaatleri.classList.add('genis'); ofisSaatleri.value = i.ofisSaatleri || '';

  const dugmeler = el('div', 'oneri-dugmeler'), m = el('div', 'mesaj');
  const kaydet = dugmeYap('Kaydet');
  const sayfa = el('a', 'dugme dugme-ikincil', 'Ders Bilgileri sayfasını aç →'); sayfa.href = 'ders.html'; sayfa.target = '_blank'; sayfa.rel = 'noopener';
  kaydet.addEventListener('click', async () => {
    kaydet.disabled = true; mesaj(m, 'Kaydediliyor…');
    try {
      await v.dersBilgileriniKaydet({
        tanim: tanim.value, dersSaatleri: dersSaatleri.value, derslik: derslik.value,
        sinavlar: sinavlar.oku(), degerlendirme: degerlendirme.oku(), kaynaklar: kaynaklar.oku().map(k => k.metin),
        iletisim: { eposta: eposta.value, ofis: ofis.value, ofisSaatleri: ofisSaatleri.value },
      });
      kaydedilmemis.delete('ders');
      mesaj(m, 'Kaydedildi. Ders Bilgileri sayfasında hemen görünür.', 'tamam');
    } catch (e) { mesaj(m, v.hataMetni(e), 'hata'); }
    finally { kaydet.disabled = false; }
  });
  dugmeler.appendChild(kaydet); dugmeler.appendChild(sayfa);
  panel.appendChild(dugmeler); panel.appendChild(m);
  panel.addEventListener('input', degisti);
  kutu.appendChild(panel);
  toplamGuncelle();
}

// ── Ayarlar (site/ayarlar) ──
// Boş alan: sayfalardaki sabit yazı kalır (aşağıdaki STATIK ile aynı).
const STATIK = { donem: 'Bahar 2025–2026', kurum: 'TOBB ETÜ Mühendislik Fakültesi Endüstri Mühendisliği Bölümü' };
async function ayarlarBolumu(kutu) {
  kutu.innerHTML = '<p class="bos-mesaj">Yükleniyor…</p>';
  let ayar;
  try { ayar = await v.siteAyarlariTaze(); }
  catch (e) { kutu.innerHTML = ''; kutu.appendChild(el('p', 'mesaj hata', 'Ayarlar yüklenemedi: ' + v.hataMetni(e))); return; }
  kutu.innerHTML = '';
  const panel = el('div', 'panel ys-form');
  panel.appendChild(el('h2', '', 'Site ayarları'));
  const donem = alanEkle(panel, 'Dönem', 'text', `Sayfaların altında ve ana sayfanın üstünde görünür. Boş bırakılırsa şu anki yazı kalır: "${STATIK.donem}".`);
  const kurum = alanEkle(panel, 'Kurum / bölüm yazısı', 'text', `Sayfaların altında görünür. Boş bırakılırsa şu anki yazı kalır: "${STATIK.kurum}".`);
  const drive = alanEkle(panel, 'Google Drive klasörü linki', 'url', 'Ana sayfadaki "📁 Ders Materyalleri (Google Drive)" düğmesi bu linke gider. Boşsa düğme görünmez.');
  kurum.classList.add('genis'); drive.classList.add('genis');
  donem.value = ayar.donem || ''; kurum.value = ayar.kurum || ''; drive.value = ayar.driveLink || '';

  const dugmeler = el('div', 'oneri-dugmeler'), m = el('div', 'mesaj');
  const kaydet = dugmeYap('Kaydet');
  kaydet.addEventListener('click', async () => {
    kaydet.disabled = true; mesaj(m, 'Kaydediliyor…');
    try {
      await v.siteAyarlariniKaydet({ donem: donem.value, kurum: kurum.value, driveLink: drive.value });
      kaydedilmemis.delete('ayarlar');
      mesaj(m, 'Kaydedildi. Sizin tarayıcınızda hemen, diğer ziyaretçilerde en geç 15 dakika içinde görünür.', 'tamam');
    } catch (e) { mesaj(m, v.hataMetni(e), 'hata'); }
    finally { kaydet.disabled = false; }
  });
  dugmeler.appendChild(kaydet);
  panel.appendChild(dugmeler); panel.appendChild(m);
  panel.addEventListener('input', () => kaydedilmemis.add('ayarlar'));
  kutu.appendChild(panel);
}

// ── Biçim düğmeleri ──
// En son tıklanan metin kutusunda seçili yazıyı etiketle sarar (seçim yoksa etiketi imlecin yerine koyar).
const BICIM_TEMEL = [
  ['Alt simge (log₂, x₁)', 'Seçili yazıyı aşağıda küçük yazar: log₂ tabanı, x₁ gibi. <sub>…</sub>', '<sub>', '</sub>'],
  ['Üs (x², eˣ)', 'Seçili yazıyı yukarıda küçük yazar: x², eˣ gibi. <sup>…</sup>', '<sup>', '</sup>'],
  ['Kalın', 'Seçili yazıyı kalın yapar. <strong>…</strong>', '<strong>', '</strong>'],
];
const SATIR_SONU = ['↵ Yeni satır', 'İmlecin olduğu yere satır sonu koyar (sitede yeni satıra geçer). <br>', '<br>', ''];
const BICIM_SORU = [...BICIM_TEMEL, ['Sonuç vurgusu', 'Seçili yazıyı sonuç olarak (yeşil, eşit aralıklı) gösterir. <span class="result">…</span>', '<span class="result">', '</span>'], SATIR_SONU];
const BICIM_FORMUL = [...BICIM_TEMEL,
  ['Yeşil vurgu', 'Seçili yazıyı yeşil yapar. <span class="hi">…</span>', '<span class="hi">', '</span>'],
  ['Mavi vurgu', 'Seçili yazıyı mavi yapar. <span class="hi2">…</span>', '<span class="hi2">', '</span>'],
  ['Soluk (gri)', 'Seçili yazıyı soluk gri yapar (açıklama notları için). <span class="dim">…</span>', '<span class="dim">', '</span>'], SATIR_SONU];

function bicimCubugu(form, dugmeler) {
  const cubuk = el('div', 'ys-bicim');
  cubuk.appendChild(el('span', 'ys-bicim-yazi', 'Biçim:'));
  let son = null;
  form.addEventListener('focusin', e => { if (e.target.matches('textarea, input[type="text"]')) son = e.target; });
  for (const [yazi, ipucu, ac, kapa] of dugmeler) {
    const b = el('button', 'ys-bicim-btn', yazi); b.type = 'button'; b.title = ipucu;
    b.addEventListener('mousedown', e => e.preventDefault());  // odak metin kutusunda kalsın
    b.addEventListener('click', () => {
      if (!son || !son.isConnected) return;
      const a = son.selectionStart, z = son.selectionEnd, deger = son.value;
      son.value = deger.slice(0, a) + ac + deger.slice(a, z) + kapa + deger.slice(z);
      son.focus();
      son.setSelectionRange(a + ac.length, z + ac.length);
      son.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    cubuk.appendChild(b);
  }
  return cubuk;
}

// Küçük kare düğme (↑ ↓ ✕)
function kucukDugme(yazi, ipucu, sinif = '') {
  const b = el('button', ('ys-kucuk ' + sinif).trim(), yazi); b.type = 'button'; b.title = ipucu; b.setAttribute('aria-label', ipucu);
  return b;
}

// Konu seçici: "Konu 6 · Güven Aralığı"
function konuSecici(konular) {
  const sec = el('select', 'ys-sec'); sec.setAttribute('aria-label', 'Konu');
  for (const k of konular) { const o = el('option', '', `Konu ${k.sira} · ${k.ad}`); o.value = k.kod; sec.appendChild(o); }
  return sec;
}

// Değişmeyen metin olduğu gibi kalır (öneri çakışma denetimi birebir karşılaştırır); değişen metin DOMPurify'dan geçer.
const temizle = (yeni, eski) => (yeni === eski ? eski : window.DOMPurify.sanitize(yeni));

// Şık ya da çözüm adımı listesi: her satırda etiket + metin, ↑ ↓ ✕
function parcaListesi(ust, baslik, degerler, ekleYazi, yeniEtiket, degisti) {
  const bolum = el('div', 'ys-parcalar');
  bolum.appendChild(el('label', '', baslik));
  const govde = el('div', 'ys-satirlar');
  const ekle = el('button', 'baglanti ys-ekle', ekleYazi); ekle.type = 'button';
  bolum.appendChild(govde); bolum.appendChild(ekle);
  ust.appendChild(bolum);
  const satirEkle = (p) => {
    const satir = el('div', 'ys-parca');
    const etiket = el('input', 'ys-parca-etiket'); etiket.type = 'text'; etiket.value = p.etiket; etiket.setAttribute('aria-label', 'Etiket'); etiket.placeholder = 'Etiket';
    const metin = el('textarea', 'ys-parca-metin ys-html'); metin.value = p.html; metin.setAttribute('aria-label', baslik + ' metni');
    metin.rows = Math.min(8, 2 + Math.ceil(p.html.length / 80));
    const d = el('div', 'ys-parca-dugmeler');
    const yukari = kucukDugme('↑', 'Yukarı taşı'), asagi = kucukDugme('↓', 'Aşağı taşı'), sil = kucukDugme('✕', 'Sil', 'sil');
    yukari.addEventListener('click', () => { if (satir.previousElementSibling) { govde.insertBefore(satir, satir.previousElementSibling); degisti(); } });
    asagi.addEventListener('click', () => { if (satir.nextElementSibling) { govde.insertBefore(satir.nextElementSibling, satir); degisti(); } });
    sil.addEventListener('click', () => { satir.remove(); degisti(); });
    d.appendChild(yukari); d.appendChild(asagi); d.appendChild(sil);
    satir.appendChild(etiket); satir.appendChild(metin); satir.appendChild(d);
    govde.appendChild(satir);
    return satir;
  };
  degerler.forEach(satirEkle);
  ekle.addEventListener('click', () => { satirEkle({ etiket: yeniEtiket(govde.children.length), html: '' }).querySelector('textarea').focus(); degisti(); });
  return { oku: () => [...govde.children].map(x => ({ etiket: x.querySelector('input').value, html: x.querySelector('textarea').value })) };
}

// ── Sorular ──
// Konu seçilir, sorular listelenir; düzenleme formunda yazdıkça kart öğrencinin göreceği şekilde önizlenir.
// Soru numaraları kalıcıdır: silinen sorunun numarası yeniden verilmez, sıralama numaraları değiştirmez.
// Hata bildiriminden "Soruyu düzenle"
function soruyuDuzenle(kod, id) {
  location.hash = 'sorular';
  sekmeAc();  // sekme hemen açılsın (hashchange olayı sonra gelir, ikinci çağrı bir şey değiştirmez)
  hedefIste('sorular', [kod, id]);
}

async function sorularBolumu(kutu) {
  kutu.innerHTML = '<p class="bos-mesaj">Yükleniyor…</p>';
  let konular, oneriListe;
  try { [konular, oneriListe] = await Promise.all([v.tumKonularTaze(), v.oneriler()]); }
  catch (e) { kutu.innerHTML = ''; kutu.appendChild(el('p', 'mesaj hata', 'Sorular yüklenemedi: ' + v.hataMetni(e))); return; }
  kutu.innerHTML = '';
  const ust = el('div', 'ys-arac');
  const konuSec = konuSecici(konular);
  const ara = el('input', 'ys-ara'); ara.type = 'search'; ara.placeholder = 'Bu konuda ara: numara, başlık, etiket'; ara.setAttribute('aria-label', 'Soru ara');
  const yeniBtn = dugmeYap('+ Yeni soru');
  ust.appendChild(konuSec); ust.appendChild(ara); ust.appendChild(yeniBtn);
  const formKutu = el('div'), listeMesaj = el('div', 'mesaj'), liste = el('div', 'ys-soru-liste');
  kutu.appendChild(ust); kutu.appendChild(formKutu); kutu.appendChild(listeMesaj); kutu.appendChild(liste);

  let konu = konular[0];
  const bekleyenOneri = id => oneriListe.some(o => o.durum === 'bekliyor' && o.soruId === id);

  async function konuyuYenile() {
    const taze = await v.konuGetir(konu.kod);
    konular[konular.findIndex(k => k.kod === konu.kod)] = konu = taze;
  }

  function listeCiz() {
    liste.innerHTML = '';
    // Türkçe karakterlere duyarsız; yazılan her kelime numara, başlık ya da etikette geçmeli
    const kelimeler = window.sadelestir(ara.value).s.split(/\s+/).filter(Boolean), q = kelimeler.length > 0, sorular = konu.sorular;
    const gorunen = sorular.filter(s => {
      if (!q) return true;
      const metin = window.sadelestir(window.duzMetin([s.no, s.id, s.baslik, ...s.etiketler.map(e => e.html)].join(' '))).s;
      return kelimeler.every(k => metin.includes(k));
    });
    liste.appendChild(el('p', 'ys-sayi-satir', `${sorular.length} soru` + (q ? ` · aramada ${gorunen.length} sonuç (sıralama düğmeleri aramada kapalı)` : '')));
    for (const s of gorunen) {
      const i = sorular.indexOf(s);
      const satir = el('div', 'ys-soru');
      const bilgi = el('div', 'ys-soru-bilgi');
      bilgi.appendChild(el('span', 'oneri-no', s.no));
      bilgi.appendChild(el('span', 'ys-soru-ad', window.duzMetin(s.baslik)));
      bilgi.appendChild(el('span', 'badge ' + (window.ZORLUK_SINIF[s.zorluk] || ''), s.zorluk));
      if (bekleyenOneri(s.id)) bilgi.appendChild(el('span', 'ys-isaret', 'öneri bekliyor'));
      const d = el('div', 'ys-soru-dugmeler'), m = el('div', 'mesaj');
      const yukari = kucukDugme('↑', 'Yukarı taşı'), asagi = kucukDugme('↓', 'Aşağı taşı');
      yukari.disabled = !!q || i === 0; asagi.disabled = !!q || i === sorular.length - 1;
      const tasi = async yon => {
        const idler = sorular.map(x => x.id);
        [idler[i], idler[i + yon]] = [idler[i + yon], idler[i]];
        liste.querySelectorAll('button').forEach(b => { b.disabled = true; });
        try { await v.sorulariSirala(konu.kod, idler); await konuyuYenile(); mesaj(listeMesaj, ''); }
        catch (e) { mesaj(listeMesaj, v.hataMetni(e), 'hata'); }
        listeCiz();
      };
      yukari.addEventListener('click', () => tasi(-1)); asagi.addEventListener('click', () => tasi(1));
      const duzenle = dugmeYap('Düzenle', 'dugme-ikincil'), sil = dugmeYap('Sil', 'dugme-tehlike');
      duzenle.addEventListener('click', () => duzenlemeAc(s.id));
      sil.addEventListener('click', async () => {
        const yazi = `${s.no} "${window.duzMetin(s.baslik)}" kalıcı olarak silinecek.\n\n` +
          (bekleyenOneri(s.id) ? 'Bu soru için onay bekleyen bir düzeltme önerisi var; silinirse öneri uygulanamaz.\n\n' : '') +
          `Bu sorunun bağlantısı (${konu.sayfa}#${s.id}) çalışmaz olur; numarası yeni sorulara verilmez. Devam edilsin mi?`;
        if (!confirm(yazi)) return;
        liste.querySelectorAll('button').forEach(b => { b.disabled = true; });
        try {
          await v.soruSil(konu.kod, s);
          if (formKutu.dataset.soru === s.id) formuKapat();
          await konuyuYenile();
          mesaj(listeMesaj, `${s.no} silindi.`, 'tamam');
        } catch (e) { mesaj(listeMesaj, v.hataMetni(e), 'hata'); }
        listeCiz();
      });
      const gor = el('a', 'dugme dugme-ikincil', 'Sitede gör →'); gor.href = `${konu.sayfa}#${s.id}`; gor.target = '_blank'; gor.rel = 'noopener';
      d.appendChild(yukari); d.appendChild(asagi); d.appendChild(duzenle); d.appendChild(gor); d.appendChild(sil);
      satir.appendChild(bilgi); satir.appendChild(d); satir.appendChild(m);
      liste.appendChild(satir);
    }
  }

  function formuKapat() { kaydedilmemis.delete('soru'); formKutu.innerHTML = ''; delete formKutu.dataset.soru; }

  // Düzenleme her zaman sorunun veritabanındaki son haliyle açılır (bu arada başka sekmede bir öneri onaylanmış olabilir)
  async function duzenlemeAc(id) {
    try { await konuyuYenile(); } catch (e) { mesaj(listeMesaj, v.hataMetni(e), 'hata'); return; }
    listeCiz();
    const s = konu.sorular.find(x => x.id === id);
    if (s) formAc(s);
    else mesaj(listeMesaj, `${id} bu konuda bulunamadı (silinmiş olabilir).`, 'hata');
  }

  // Konudaki en sık kullanılan değer (yeni soru için varsayılanlar)
  const enSik = degerler => { const n = {}; degerler.forEach(x => { n[x] = (n[x] || 0) + 1; }); return Object.keys(n).sort((a, b) => n[b] - n[a])[0]; };
  const HARF = 'abcdefghijklmnopqrstuvwxyz';

  // s: düzenlenecek soru, null: yeni soru. Form açılamazsa (kullanıcı vazgeçerse) false.
  function formAc(s) {
    if (kaydedilmemis.has('soru') && !confirm('Açık formdaki kaydedilmemiş değişiklikler kaybolacak. Devam edilsin mi?')) return false;
    formuKapat();
    mesaj(listeMesaj, '');
    const eski = s ? JSON.parse(JSON.stringify(s)) : null;
    const kimlik = s ? { id: s.id, no: s.no } : v.yeniSoruKimligi(konu);
    const ilkEtiket = (konu.sorular.find(x => x.etiketler.length) || { etiketler: [{ sinif: [] }] }).etiketler[0];
    const etiketSinif = s && s.etiketler.length ? s.etiketler[0].sinif : ilkEtiket.sinif;
    if (s) formKutu.dataset.soru = s.id;

    const panel = el('div', 'panel ys-form');
    panel.appendChild(el('h2', '', s ? `${s.no} düzenleniyor` : `Yeni soru · ${kimlik.no}`));
    if (s && bekleyenOneri(s.id)) {
      panel.appendChild(el('p', 'ys-uyari', 'Bu soru için onay bekleyen bir düzeltme önerisi var. Önerinin değiştirdiği kısımları burada ' +
        'değiştirirseniz öneri artık otomatik uygulanamaz. Önce "Düzeltme Önerileri" bölümünden karar vermeniz önerilir.'));
    }
    panel.appendChild(el('p', 'ys-ipucu', 'Metinler sitedeki biçimiyle (HTML) duruyor. Biçim düğmeleri en son tıkladığınız kutudaki seçili yazıya uygulanır. ' +
      'Önce kutudaki yazıyı fareyle seçin, sonra düğmeye basın. Yeni satır için "↵ Yeni satır" düğmesini kullanın (Enter tuşuyla açılan satır sitede görünmez). Yazdıkça önizleme (geniş ekranda sağda, telefonda formun altında) güncellenir.'));
    const degisti = () => { kaydedilmemis.add('soru'); onizle(); };
    panel.appendChild(bicimCubugu(panel, BICIM_SORU));

    const duzen = el('div', 'ys-duzen'), sol = el('div'), sag = el('div', 'ys-onizleme');
    const baslik = alanEkle(sol, 'Soru başlığı'); baslik.classList.add('genis');
    const etiket = alanEkle(sol, 'Konu etiketi', 'text', 'Kartın üstündeki küçük etiket.'); etiket.classList.add('genis');
    const zl = el('label', '', 'Zorluk'), zorluk = el('select', 'ys-sec');
    zorluk.id = 'ys-alan-' + (++alanNo); zl.htmlFor = zorluk.id;
    for (const z of ['Temel', 'Orta', 'İleri']) { const o = el('option', '', z); o.value = z; zorluk.appendChild(o); }
    sol.appendChild(zl); sol.appendChild(zorluk);
    const metin = alanEkle(sol, 'Soru metni', 'textarea'); metin.classList.add('ys-html');
    const siklar = parcaListesi(sol, 'Şıklar', s ? s.siklar : [], '+ Şık ekle', n => HARF[n] + ')', degisti);
    const cozumBaslik = alanEkle(sol, 'Çözüm başlığı');
    const adimlar = parcaListesi(sol, 'Çözüm adımları', s ? s.adimlar : [], '+ Adım ekle', n => HARF[n], degisti);

    baslik.value = s ? s.baslik : '';
    etiket.value = s && s.etiketler.length ? s.etiketler[0].html : '';
    zorluk.value = s ? s.zorluk : 'Orta';
    metin.value = s ? s.metin : '';
    metin.rows = Math.min(14, 3 + Math.ceil(metin.value.length / 80));
    cozumBaslik.value = s ? s.cozumBaslik : (enSik(konu.sorular.map(x => x.cozumBaslik)) || 'Çözüm');

    // Formdaki hal → soru (boş satırlar atlanır; değişmeyen metinler birebir korunur)
    const soruOku = () => {
      const parcalar = (liste, eskiler) => liste.filter(p => p.etiket.trim() || p.html.trim())
        .map((p, i) => ({ etiket: temizle(p.etiket, eskiler[i] && eskiler[i].etiket), html: temizle(p.html, eskiler[i] && eskiler[i].html) }));
      const eskiEtiket = eski && eski.etiketler[0];
      return {
        id: kimlik.id, no: kimlik.no,
        baslik: temizle(baslik.value, eski && eski.baslik),
        etiketler: etiket.value.trim()
          ? [{ sinif: etiketSinif, html: temizle(etiket.value, eskiEtiket && eskiEtiket.html) }, ...(eski ? eski.etiketler.slice(1) : [])]
          : [],
        zorluk: zorluk.value,
        metin: temizle(metin.value, eski && eski.metin),
        siklar: parcalar(siklar.oku(), eski ? eski.siklar : []),
        cozumBaslik: temizle(cozumBaslik.value, eski && eski.cozumBaslik),
        adimlar: parcalar(adimlar.oku(), eski ? eski.adimlar : []),
      };
    };

    sag.appendChild(el('h4', '', 'Önizleme · sitede böyle görünecek'));
    const onizKutu = el('div');
    sag.appendChild(onizKutu);
    function onizle() {
      onizKutu.innerHTML = '';
      try { onizKutu.appendChild(kartCiz(soruOku(), konu.stil, [], '')); }
      catch (e) { onizKutu.appendChild(el('p', 'mesaj hata', 'Önizleme çizilemedi: ' + e.message)); }
    }

    const dugmeler = el('div', 'oneri-dugmeler'), m = el('div', 'mesaj');
    const kaydet = dugmeYap(s ? 'Değişiklikleri kaydet' : 'Soruyu ekle'), vazgec = dugmeYap('Vazgeç', 'dugme-ikincil');
    kaydet.addEventListener('click', async () => {
      kaydet.disabled = vazgec.disabled = true; mesaj(m, 'Kaydediliyor…');
      try {
        const kayit = await v.soruKaydet(konu.kod, soruOku(), eski);
        formuKapat();
        await konuyuYenile();
        ara.value = '';
        listeCiz();
        basariMesaji(listeMesaj, `${kayit.no} ${s ? 'kaydedildi' : 'eklendi'}; sitede hemen görünür.`, `${konu.sayfa}#${kayit.id}`);
      } catch (e) { mesaj(m, v.hataMetni(e), 'hata'); kaydet.disabled = vazgec.disabled = false; }
    });
    vazgec.addEventListener('click', () => {
      if (kaydedilmemis.has('soru') && !confirm('Kaydedilmemiş değişiklikler kaybolacak. Vazgeçilsin mi?')) return;
      formuKapat();
    });
    dugmeler.appendChild(kaydet); dugmeler.appendChild(vazgec);

    duzen.appendChild(sol); duzen.appendChild(sag);
    panel.appendChild(duzen); panel.appendChild(dugmeler); panel.appendChild(m);
    panel.addEventListener('input', degisti);
    panel.addEventListener('change', degisti);  // zorluk seçimi
    formKutu.appendChild(panel);
    onizle();
    kaydedilmemis.delete('soru');
    if (panel.scrollIntoView) panel.scrollIntoView({ block: 'start', behavior: 'smooth' });
    baslik.focus();
    return true;
  }

  konuSec.addEventListener('change', () => {
    if (kaydedilmemis.has('soru') && !confirm('Açık formdaki kaydedilmemiş değişiklikler kaybolacak. Devam edilsin mi?')) { konuSec.value = konu.kod; return; }
    formuKapat(); mesaj(listeMesaj, '');
    konu = konular.find(k => k.kod === konuSec.value);
    ara.value = '';
    listeCiz();
  });
  ara.addEventListener('input', listeCiz);
  yeniBtn.addEventListener('click', () => formAc(null));

  listeCiz();
  // [kod, id]: o soruyu düzenle; [kod, 'yeni']: o konuda yeni soru
  hedefKaydet('sorular', ([kod, id]) => {
    if (!konular.some(k => k.kod === kod)) return;
    if (konu.kod !== kod) {
      if (kaydedilmemis.has('soru') && !confirm('Açık formdaki kaydedilmemiş değişiklikler kaybolacak. Devam edilsin mi?')) return;
      formuKapat();
      konu = konular.find(k => k.kod === kod);
      konuSec.value = konu.kod; ara.value = '';
      listeCiz();
    }
    if (id === 'yeni') formAc(null); else if (id) duzenlemeAc(id);
  });
}

// ── Formül kartları ──
// Bir konunun kartları birlikte kaydedilir (ekleme, düzenleme, silme, sıralama); önizleme sitedeki kartla aynıdır.
async function formullerBolumu(kutu) {
  kutu.innerHTML = '<p class="bos-mesaj">Yükleniyor…</p>';
  let konular;
  try { konular = await v.tumKonularTaze(); }
  catch (e) { kutu.innerHTML = ''; kutu.appendChild(el('p', 'mesaj hata', 'Formül kartları yüklenemedi: ' + v.hataMetni(e))); return; }
  kutu.innerHTML = '';
  const ust = el('div', 'ys-arac');
  const konuSec = konuSecici(konular), yeniBtn = dugmeYap('+ Yeni formül kartı');
  ust.appendChild(konuSec); ust.appendChild(yeniBtn);
  const formKutu = el('div'), listeMesaj = el('div', 'mesaj'), liste = el('div', 'ys-formul-liste');
  kutu.appendChild(ust); kutu.appendChild(formKutu); kutu.appendChild(listeMesaj); kutu.appendChild(liste);
  let konu = konular[0], acikKart = null;  // acikKart: formda düzenlenen kartın okunduğu hal
  const ayniKart = (a, b) => a.baslik === b.baslik && a.govde === b.govde;

  const kartHtmlTemiz = f => window.formulKartHtml({ baslik: window.DOMPurify.sanitize(f.baslik), govde: window.DOMPurify.sanitize(f.govde) });

  // Yeni kart listesini kaydeder, konuyu veritabanından tazeler
  async function kaydet(yeniKartlar, basari) {
    await v.formulKartlariniKaydet(konu.kod, yeniKartlar, konu.formul.kartlar);
    const taze = await v.konuGetir(konu.kod);
    konular[konular.findIndex(k => k.kod === konu.kod)] = konu = taze;
    mesaj(listeMesaj, basari, 'tamam');
  }

  function listeCiz() {
    liste.innerHTML = '';
    const kartlar = konu.formul.kartlar;
    liste.appendChild(el('p', 'ys-sayi-satir', `${kartlar.length} formül kartı`));
    const izgara = el('div', 'formula-grid');
    kartlar.forEach((f, i) => {
      const sar = el('div', 'ys-formul');
      sar.innerHTML = kartHtmlTemiz(f);
      const d = el('div', 'ys-soru-dugmeler');
      const yukari = kucukDugme('↑', 'Öne al'), asagi = kucukDugme('↓', 'Sona doğru taşı');
      yukari.disabled = i === 0; asagi.disabled = i === kartlar.length - 1;
      const tasi = async yon => {
        const yeni = kartlar.slice();
        [yeni[i], yeni[i + yon]] = [yeni[i + yon], yeni[i]];
        liste.querySelectorAll('button').forEach(b => { b.disabled = true; });
        try { await kaydet(yeni, ''); } catch (e) { mesaj(listeMesaj, v.hataMetni(e), 'hata'); }
        listeCiz();
      };
      yukari.addEventListener('click', () => tasi(-1)); asagi.addEventListener('click', () => tasi(1));
      const duzenle = dugmeYap('Düzenle', 'dugme-ikincil'), sil = dugmeYap('Sil', 'dugme-tehlike');
      duzenle.addEventListener('click', () => formAc(i));
      sil.addEventListener('click', async () => {
        if (!confirm(`"${window.duzMetin(f.baslik)}" formül kartı kalıcı olarak silinecek. Devam edilsin mi?`)) return;
        if (acikKart && ayniKart(acikKart, f)) formuKapat();
        liste.querySelectorAll('button').forEach(b => { b.disabled = true; });
        try { await kaydet(kartlar.filter((_, j) => j !== i), 'Formül kartı silindi.'); } catch (e) { mesaj(listeMesaj, v.hataMetni(e), 'hata'); }
        listeCiz();
      });
      d.appendChild(yukari); d.appendChild(asagi); d.appendChild(duzenle); d.appendChild(sil);
      sar.appendChild(d);
      izgara.appendChild(sar);
    });
    liste.appendChild(izgara);
  }

  function formuKapat() { kaydedilmemis.delete('formul'); formKutu.innerHTML = ''; acikKart = null; }

  // i: düzenlenecek kartın sırası, null: yeni kart
  function formAc(i) {
    if (kaydedilmemis.has('formul') && !confirm('Açık formdaki kaydedilmemiş değişiklikler kaybolacak. Devam edilsin mi?')) return;
    formuKapat(); mesaj(listeMesaj, '');
    const eski = i == null ? null : konu.formul.kartlar[i];
    acikKart = eski;
    const panel = el('div', 'panel ys-form');
    panel.appendChild(el('h2', '', eski ? 'Formül kartını düzenle' : 'Yeni formül kartı'));
    panel.appendChild(el('p', 'ys-ipucu', 'Metin sitedeki biçimiyle (HTML) duruyor. Önce kutudaki yazıyı fareyle seçin, sonra düğmeye basın. Yeni satır için "↵ Yeni satır" düğmesini kullanın.'));
    panel.appendChild(bicimCubugu(panel, BICIM_FORMUL));
    const duzen = el('div', 'ys-duzen'), sol = el('div'), sag = el('div', 'ys-onizleme');
    const baslik = alanEkle(sol, 'Kart başlığı'); baslik.classList.add('genis');
    const govde = alanEkle(sol, 'Kart içeriği', 'textarea'); govde.classList.add('ys-html');
    baslik.value = eski ? eski.baslik : ''; govde.value = eski ? eski.govde : '';
    govde.rows = Math.min(16, 4 + Math.ceil(govde.value.length / 70));
    sag.appendChild(el('h4', '', 'Önizleme · sitede böyle görünecek'));
    const oniz = el('div', 'formula-grid ys-tek');
    sag.appendChild(oniz);
    const kart = () => ({ baslik: temizle(baslik.value, eski && eski.baslik), govde: temizle(govde.value, eski && eski.govde) });
    const onizle = () => { oniz.innerHTML = kartHtmlTemiz(kart()); };

    const dugmeler = el('div', 'oneri-dugmeler'), m = el('div', 'mesaj');
    const kaydetBtn = dugmeYap(eski ? 'Değişiklikleri kaydet' : 'Kartı ekle'), vazgec = dugmeYap('Vazgeç', 'dugme-ikincil');
    kaydetBtn.addEventListener('click', async () => {
      kaydetBtn.disabled = vazgec.disabled = true; mesaj(m, 'Kaydediliyor…');
      // Form açıkken kartların sırası değişmiş ya da başka kart silinmiş olabilir: düzenlenen kart içeriğiyle bulunur
      const yeni = konu.formul.kartlar.slice(), j = eski ? yeni.findIndex(f => ayniKart(f, eski)) : -1;
      if (eski && j < 0) { mesaj(m, 'Bu kart bu arada değiştirilmiş ya da silinmiş. Yazdıklarınızı kopyalayıp formu kapatın, sonra tekrar deneyin.', 'hata'); kaydetBtn.disabled = vazgec.disabled = false; return; }
      if (eski) yeni[j] = kart(); else yeni.push(kart());
      try {
        await kaydet(yeni, eski ? 'Formül kartı kaydedildi; sitede hemen görünür.' : 'Formül kartı eklendi; sitede hemen görünür.');
        formuKapat(); listeCiz();
      } catch (e) { mesaj(m, v.hataMetni(e), 'hata'); kaydetBtn.disabled = vazgec.disabled = false; }
    });
    vazgec.addEventListener('click', () => {
      if (kaydedilmemis.has('formul') && !confirm('Kaydedilmemiş değişiklikler kaybolacak. Vazgeçilsin mi?')) return;
      formuKapat();
    });
    dugmeler.appendChild(kaydetBtn); dugmeler.appendChild(vazgec);
    duzen.appendChild(sol); duzen.appendChild(sag);
    panel.appendChild(duzen); panel.appendChild(dugmeler); panel.appendChild(m);
    panel.addEventListener('input', () => { kaydedilmemis.add('formul'); onizle(); });
    formKutu.appendChild(panel);
    onizle();
    if (panel.scrollIntoView) panel.scrollIntoView({ block: 'start', behavior: 'smooth' });
    baslik.focus();
  }

  konuSec.addEventListener('change', () => {
    if (kaydedilmemis.has('formul') && !confirm('Açık formdaki kaydedilmemiş değişiklikler kaybolacak. Devam edilsin mi?')) { konuSec.value = konu.kod; return; }
    formuKapat(); mesaj(listeMesaj, '');
    konu = konular.find(k => k.kod === konuSec.value);
    listeCiz();
  });
  yeniBtn.addEventListener('click', () => formAc(null));
  listeCiz();
  hedefKaydet('formuller', ([kod]) => {
    if (konu.kod === kod || !konular.some(k => k.kod === kod)) return;
    konuSec.value = kod;
    konuSec.dispatchEvent(new Event('change'));
  });
}
