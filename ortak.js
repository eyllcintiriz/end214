// END214 – bütün sayfaların ortak kodu
// • Kart HTML'i veriden üretilir (araclar/veri_cikar.py içindeki kart_html() ile birebir aynı çıktı;
//   bkz. araclar/kart_testi.mjs).
// • Sayfadaki statik kartlar yedektir: veritabanından veri gelirse yeniden çizilir, gelmezse olduğu gibi kalır.
// Bu dosya klasik <script> olarak yüklenir; kartlardaki onclick="toggleCard(this)" global fonksiyon ister.

var ZORLUK_SINIF = { 'Temel': 'badge-easy', 'Orta': 'badge-med', 'İleri': 'badge-hard' };

// ── Veri → HTML (saf string, DOM kullanmaz) ──
function kartHtml(s, st) {
  var rozet = s.etiketler.map(function (e) {
    return '<span class="badge ' + e.sinif.join(' ') + '">' + e.html + '</span>';
  }).join('') + '<span class="badge ' + ZORLUK_SINIF[s.zorluk] + '">' + s.zorluk + '</span>';
  var sik = s.siklar.map(function (p) {
    return '<div class="q-part"><span class="' + st.parca + '">' + p.etiket + '</span>' +
      '<span class="part-text">' + p.html + '</span></div>';
  }).join('');
  var adim = s.adimlar.map(function (a) {
    return '<div class="sol-step"><span class="' + st.adim + '">' + a.etiket + '</span>' +
      '<div class="step-text">' + a.html + '</div></div>';
  }).join('');
  return '<div class="' + st.kart + '"><div class="q-header" onclick="toggleCard(this)">' +
    '<span class="' + st.no + '">' + s.no + '</span><div class="q-title-wrap"><div class="q-title">' + s.baslik + '</div>' +
    '<div class="q-badges">' + rozet + '</div></div><span class="q-toggle">▾</span></div>' +
    '<div class="q-body"><div class="q-text">' + s.metin + '</div>' +
    (s.siklar.length ? '<div class="q-parts">' + sik + '</div>' : '') +
    '<button class="' + st.buton + '" onclick="toggleSolution(this)">' + st.butonMetin + '</button>' +
    '<div class="' + st.cozum + '"><div class="' + st.cozumBaslik + '">' + s.cozumBaslik + '</div>' + adim + '</div></div></div>';
}

function formulKartHtml(f) {
  return '<div class="f-card"><div class="f-title">' + f.baslik + '</div><div class="f-body">' + f.govde + '</div></div>';
}

// ── Sayfaya çizme ──
// Veritabanından gelen metinler ekrana basılmadan önce DOMPurify ile temizlenir.
// DOMPurify yüklenmemişse hiçbir şey çizilmez, statik yedek görünmeye devam eder.
function temizSoru(s) {
  var t = function (h) { return window.DOMPurify.sanitize(h); };
  return {
    no: t(s.no), baslik: t(s.baslik), zorluk: t(s.zorluk), metin: t(s.metin), cozumBaslik: t(s.cozumBaslik),
    etiketler: s.etiketler.map(function (e) {
      return { sinif: e.sinif.map(function (k) { return k.replace(/[^\w-]/g, ''); }), html: t(e.html) };  // sınıf adı: harf, rakam, tire
    }),
    siklar: s.siklar.map(function (p) { return { etiket: t(p.etiket), html: t(p.html) }; }),
    adimlar: s.adimlar.map(function (a) { return { etiket: t(a.etiket), html: t(a.html) }; })
  };
}

function temizStil(st) {
  var t = {};
  Object.keys(st).forEach(function (k) {
    t[k] = k === 'butonMetin' ? window.DOMPurify.sanitize(st[k]) : st[k].replace(/[^\w\s-]/g, '');
  });
  return t;
}

function konuyuCiz(konu) {
  if (!window.DOMPurify || !konu) return false;
  var grid = document.querySelector('.questions-grid');
  var fGrid = document.querySelector('.formula-section .formula-grid');
  if (!grid) return false;
  var st = temizStil(konu.stil);
  grid.innerHTML = konu.sorular.map(function (s) { return kartHtml(temizSoru(s), st); }).join('\n');
  if (fGrid && konu.formul) {
    fGrid.innerHTML = konu.formul.kartlar.map(function (f) {
      return formulKartHtml({ baslik: window.DOMPurify.sanitize(f.baslik), govde: window.DOMPurify.sanitize(f.govde) });
    }).join('\n');
  }
  return true;
}

// ── Kart ve çözüm aç/kapa ──
function toggleCard(h) { h.closest('.q-card').classList.toggle('open'); }
function toggleSolution(btn) {
  var s = btn.nextElementSibling;
  if (!btn.dataset.metin) btn.dataset.metin = btn.textContent;  // sayfanın kendi "Çözümü Göster" yazısı (▶ / ►)
  s.classList.toggle('visible');
  btn.textContent = s.classList.contains('visible') ? '▼ Çözümü Gizle' : btn.dataset.metin;
}
