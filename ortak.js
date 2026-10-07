// END214 – bütün sayfaların ortak kodu
// • Kart HTML'i veriden üretilir (araclar/veri_cikar.py içindeki kart_html() ile birebir aynı çıktı;
//   bkz. araclar/kart_testi.mjs).
// • Sayfadaki statik kartlar yedektir: veritabanından veri gelirse yeniden çizilir, gelmezse olduğu gibi kalır.
// Bu dosya klasik <script> olarak yüklenir; kartlardaki onclick="toggleCard(this)" global fonksiyon ister.
// Konu sayfalarında yükleme sırası: purify.min.js (DOMPurify) → firebase-ayar.js → ortak.js

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
  // Veri gelmeden önce açılmış kartlar yeniden çizimden sonra da açık kalsın
  var acik = {}, cozumAcik = {};
  grid.querySelectorAll('.q-card').forEach(function (c) {
    var no = c.querySelector('.q-num').textContent;
    if (c.classList.contains('open')) acik[no] = true;
    if (c.querySelector('.solution.visible')) cozumAcik[no] = true;
  });
  grid.innerHTML = konu.sorular.map(function (s) { return kartHtml(temizSoru(s), st); }).join('\n');
  grid.querySelectorAll('.q-card').forEach(function (c) {
    var no = c.querySelector('.q-num').textContent;
    if (acik[no]) c.classList.add('open');
    if (cozumAcik[no]) toggleSolution(c.querySelector('.sol-btn'));
  });
  if (fGrid && konu.formul) {
    fGrid.innerHTML = konu.formul.kartlar.map(function (f) {
      return formulKartHtml({ baslik: window.DOMPurify.sanitize(f.baslik), govde: window.DOMPurify.sanitize(f.govde) });
    }).join('\n');
  }
  return true;
}

// ── Sayaçlar (sayfadaki kartlardan sayılır; içerik veritabanından da yedekten de gelse doğru) ──
var ZORLUK_ADI = { 'badge-easy': 'Temel', 'badge-med': 'Orta', 'badge-hard': 'İleri' };

function konuSayaclari(sira) {
  var kartlar = document.querySelectorAll('.questions-grid > .q-card');
  var formul = document.querySelectorAll('.formula-grid > .f-card').length;
  var say = { 'Soru': kartlar.length, 'Temel': 0, 'Orta': 0, 'İleri': 0 };
  kartlar.forEach(function (c) { var z = kartZorlugu(c); if (z) say[z]++; });
  // "Konu 6 · 18 Soru": sıra numarası veritabanından, yoksa sayfada yazandan
  var etiket = document.querySelector('.page-header .topic-tag');
  var m = etiket && etiket.textContent.match(/Konu\s*([−-]?\d+)/);
  if (etiket && (sira || m)) etiket.textContent = 'Konu ' + (sira || m[1]) + ' · ' + kartlar.length + ' Soru';
  document.querySelectorAll('.page-header .meta-item').forEach(function (el) {
    var t = el.lastChild;
    if (!t || t.nodeType !== 3) return;
    if (/^\s*\d+ çözümlü soru\s*$/.test(t.data)) t.data = kartlar.length + ' çözümlü soru';
    if (/^\s*\d+ formül kartı\s*$/.test(t.data)) t.data = formul + ' formül kartı';
  });
  document.querySelectorAll('.stats-row .stat-cell').forEach(function (h) {
    var ad = h.querySelector('.stat-label').textContent.trim();
    if (ad in say) h.querySelector('.stat-val').textContent = say[ad] || '—';
  });
}

function anaSayfaSayaclari(konular) {
  var soru = 0, formul = 0;
  konular.forEach(function (k) {
    soru += k.sorular.length; formul += k.formul.kartlar.length;
    var kutu = document.querySelector('a.home-card[href="' + k.sayfa + '"] .hc-count');
    if (kutu) kutu.textContent = k.sorular.length + ' SORU · ' + k.formul.kartlar.length + ' FORMÜL KARTI';
  });
  var deger = { 'Toplam Soru': soru, 'Konu Başlığı': konular.length, 'Formül Kartı': formul };
  document.querySelectorAll('.stats-row .stat-cell').forEach(function (h) {
    var ad = h.querySelector('.stat-label').textContent.trim();
    if (ad in deger) h.querySelector('.stat-val').textContent = deger[ad];
  });
}

// ── Soru bağlantıları: ga.html#GA-04 → kart açılır, ekrana kayar ve kısa süre vurgulanır ──
function kartKimligi(no) { return no.trim().replace(/[–—-]+/g, '-'); }

function kartlaraKimlikVer() {
  document.querySelectorAll('.questions-grid > .q-card').forEach(function (c) {
    c.id = kartKimligi(c.querySelector('.q-num').textContent);
  });
}

function vurgula(c) {
  c.classList.remove('vurgu');
  void c.offsetWidth;  // animasyonu baştan başlat
  c.classList.add('vurgu');
}

function bagliKartiAc() {
  var id = decodeURIComponent(location.hash.slice(1));
  var c = id && document.getElementById(id);
  if (!c || !c.classList.contains('q-card')) return;
  if (c.hidden) filtreUygula('Tümü');
  c.classList.add('open');
  c.scrollIntoView({ block: 'start' });
  vurgula(c);
}

// ── Zorluk filtresi: Tümü / Temel / Orta / İleri ──
var aktifZorluk = 'Tümü';

function kartZorlugu(c) {
  var r = c.querySelector('.q-badges .badge:last-child');
  var k = r && Object.keys(ZORLUK_ADI).filter(function (s) { return r.classList.contains(s); })[0];
  return k ? ZORLUK_ADI[k] : '';
}

function zorlukFiltresiniKur() {
  var grid = document.querySelector('.questions-grid');
  if (!grid) return;
  var kutu = document.createElement('div');
  kutu.className = 'zorluk-filtre';
  kutu.setAttribute('role', 'group');
  kutu.setAttribute('aria-label', 'Zorluğa göre filtrele');
  ['Tümü', 'Temel', 'Orta', 'İleri'].forEach(function (ad) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'zf-btn'; b.dataset.zorluk = ad; b.textContent = ad;
    kutu.appendChild(b);
  });
  kutu.addEventListener('click', function (e) {
    var b = e.target.closest('.zf-btn');
    if (b) filtreUygula(b.dataset.zorluk);
  });
  grid.parentNode.insertBefore(kutu, grid);
  filtreUygula(aktifZorluk);
}

function filtreUygula(ad) {
  aktifZorluk = ad;
  var bulunan = {};
  document.querySelectorAll('.questions-grid > .q-card').forEach(function (c) {
    var z = kartZorlugu(c);
    bulunan[z] = true;
    c.hidden = ad !== 'Tümü' && z !== ad;  // hidden: stil dosyası olmasa da çalışır
  });
  document.querySelectorAll('.zorluk-filtre .zf-btn').forEach(function (b) {
    var z = b.dataset.zorluk;
    b.hidden = z !== 'Tümü' && !bulunan[z];  // sorusu olmayan zorluk gösterilmez
    b.classList.toggle('aktif', z === ad);
    b.setAttribute('aria-pressed', z === ad ? 'true' : 'false');
  });
}

// ── Arama: bütün konulardaki sorular, Türkçe karakterlere duyarsız ──
var SADE_HARF = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', '–': '-', '—': '-', '−': '-' };

// Metni aramaya uygun hale getirir ("Güven Aralığı" → "guven araligi").
// yer[i]: sade metindeki i. karakterin özgün metindeki sırası (eşleşen yeri işaretlemek için).
function sadelestir(metin) {
  var harfler = Array.from(metin), s = '', yer = [];
  harfler.forEach(function (c, i) {
    var k = c.toLocaleLowerCase('tr');
    k = (SADE_HARF[k] || k).normalize('NFD').replace(/[̀-ͯ]/g, '');
    for (var j = 0; j < k.length; j++) { s += k[j]; yer.push(i); }
  });
  return { s: s, yer: yer, harfler: harfler };
}

// HTML → düz metin (şekiller atılır; hiçbir şey yüklenmez ya da çalışmaz)
function duzMetin(html) {
  var t = document.createElement('template');
  t.innerHTML = String(html).replace(/<(br|\/div|\/td|\/th|\/tr|\/p|\/li)\b[^>]*>/gi, ' $&');
  t.content.querySelectorAll('svg').forEach(function (e) { e.remove(); });
  return t.content.textContent.replace(/\s+/g, ' ').trim();
}

function konulariIndeksle(konular) {
  var liste = [];
  konular.forEach(function (k) {
    k.sorular.forEach(function (s) {
      var baslik = duzMetin(s.baslik);
      var etiket = s.etiketler.map(function (e) { return duzMetin(e.html); }).join(' ');
      var govde = [s.metin].concat(s.siklar.map(function (p) { return p.html; })).map(duzMetin).join(' ');
      liste.push({
        id: s.id, no: duzMetin(s.no), baslik: baslik, konu: k.ad, sayfa: k.sayfa, zorluk: s.zorluk,
        bas: sadelestir([s.no, s.id, s.id.replace('-', ''), baslik, etiket, k.ad].join(' ')).s,
        govde: sadelestir(govde)
      });
    });
  });
  return liste;
}

function ara(sorgu, liste) {
  var kelimeler = sadelestir(sorgu).s.split(/\s+/).filter(Boolean);
  if (!kelimeler.length) return [];
  var sonuc = [];
  liste.forEach(function (q, sira) {
    var puan = 0, ilkYer = -1, ilkUzunluk = 0;
    for (var i = 0; i < kelimeler.length; i++) {
      var w = kelimeler[i];
      if (q.bas.indexOf(w) >= 0) { puan += 3; continue; }
      var y = q.govde.s.indexOf(w);
      if (y < 0) return;  // her kelime bulunmalı
      puan += 1;
      if (ilkYer < 0) { ilkYer = y; ilkUzunluk = w.length; }
    }
    sonuc.push({ q: q, puan: puan, sira: sira, yer: ilkYer, uzunluk: ilkUzunluk });
  });
  return sonuc.sort(function (a, b) { return b.puan - a.puan || a.sira - b.sira; });
}

// Eşleşmenin geçtiği kısa metin parçası: [önce, eşleşen, sonra]
function parca(g, yer, uzunluk) {
  var bas = g.yer[yer], son = g.yer[yer + uzunluk - 1] + 1;
  var a = Math.max(0, bas - 45), b = Math.min(g.harfler.length, son + 75);
  return [(a > 0 ? '…' : '') + g.harfler.slice(a, bas).join(''), g.harfler.slice(bas, son).join(''),
          g.harfler.slice(son, b).join('') + (b < g.harfler.length ? '…' : '')];
}

var aramaVerisi = null;
function aramaVerisiniYukle() {
  if (!aramaVerisi) {
    aramaVerisi = import('./veri-katmani.js?v=e6c6c36d')
      .then(function (v) { return v.tumKonular(); })
      .then(function (k) { if (!k.length) throw new Error('boş'); return k; })
      .catch(function () {  // veritabanına ulaşılamazsa depodaki kopya
        return fetch('veri/konular.json').then(function (r) { return r.json(); }).then(function (d) { return d.konular; });
      })
      .then(konulariIndeksle)
      .catch(function (e) { aramaVerisi = null; throw e; });
  }
  return aramaVerisi;
}

function aramayiKur() {
  var nav = document.querySelector('.topnav'), marka = nav && nav.querySelector('.brand');
  if (!marka) return;
  var dugme = document.createElement('button');
  dugme.type = 'button'; dugme.className = 'arama-dugme'; dugme.setAttribute('aria-label', 'Soru ara');
  dugme.innerHTML = '<span aria-hidden="true">🔍</span><span class="arama-dugme-yazi">Soru ara</span><kbd>/</kbd>';
  marka.insertAdjacentElement('afterend', dugme);

  var panel = document.createElement('div');
  panel.className = 'arama-panel';
  panel.innerHTML = '<input type="search" class="arama-kutu" placeholder="Örn. guven araligi, medyan, GA-04" aria-label="Soru ara" autocomplete="off" spellcheck="false">' +
    '<div class="arama-sonuc" role="listbox"></div>';
  document.body.appendChild(panel);
  var kutu = panel.querySelector('.arama-kutu'), sonucKutu = panel.querySelector('.arama-sonuc');
  var secili = -1, buSayfa = location.pathname.split('/').pop() || 'index.html';

  function bilgi(metin) { sonucKutu.innerHTML = ''; var p = document.createElement('div'); p.className = 'arama-bilgi'; p.textContent = metin; sonucKutu.appendChild(p); }

  function goster() {
    var sorgu = kutu.value;
    if (!sorgu.trim()) return bilgi('Bütün konulardaki sorularda arar. Türkçe karakter yazmanız gerekmez.');
    aramaVerisiniYukle().then(function (liste) {
      if (kutu.value !== sorgu) return;  // bu arada yazı değişti
      var sonuc = ara(sorgu, liste);
      if (!sonuc.length) return bilgi('Sonuç bulunamadı.');
      sonucKutu.innerHTML = ''; secili = -1;
      sonuc.slice(0, 30).forEach(function (r) {
        var a = document.createElement('a');
        a.className = 'arama-oge'; a.href = r.q.sayfa + '#' + r.q.id; a.setAttribute('role', 'option');
        var ust = document.createElement('div'); ust.className = 'arama-ust';
        var no = document.createElement('span'); no.className = 'arama-no'; no.textContent = r.q.no;
        var bas = document.createElement('span'); bas.className = 'arama-baslik'; bas.textContent = r.q.baslik;
        ust.appendChild(no); ust.appendChild(bas); a.appendChild(ust);
        var alt = document.createElement('div'); alt.className = 'arama-alt';
        alt.textContent = r.q.konu + ' · ' + r.q.zorluk;
        a.appendChild(alt);
        if (r.yer >= 0) {
          var p = parca(r.q.govde, r.yer, r.uzunluk), pd = document.createElement('div'), m = document.createElement('mark');
          pd.className = 'arama-parca'; m.textContent = p[1];
          pd.appendChild(document.createTextNode(p[0])); pd.appendChild(m); pd.appendChild(document.createTextNode(p[2]));
          a.appendChild(pd);
        }
        a.addEventListener('click', function () {
          kapat();
          if (r.q.sayfa === buSayfa && location.hash === '#' + r.q.id) bagliKartiAc();  // aynı bağlantı: hashchange olmaz
        });
        sonucKutu.appendChild(a);
      });
      if (sonuc.length > 30) { var d = document.createElement('div'); d.className = 'arama-bilgi'; d.textContent = '… ve ' + (sonuc.length - 30) + ' sonuç daha. Aramayı daraltın.'; sonucKutu.appendChild(d); }
    }).catch(function () { bilgi('Arama şu an kullanılamıyor. İnternet bağlantınızı kontrol edin.'); });
    if (!sonucKutu.querySelector('.arama-oge')) bilgi('Aranıyor…');
  }

  function sec(i) {
    var ogeler = sonucKutu.querySelectorAll('.arama-oge');
    if (!ogeler.length) return;
    secili = (i + ogeler.length) % ogeler.length;
    ogeler.forEach(function (o, j) { o.classList.toggle('secili', j === secili); });
    ogeler[secili].scrollIntoView({ block: 'nearest' });
  }

  function ac() {
    var alt = nav.getBoundingClientRect().bottom;
    panel.style.top = (alt + 6) + 'px';
    sonucKutu.style.maxHeight = (window.innerHeight - alt - 90) + 'px';
    panel.classList.add('acik');
    kutu.focus(); kutu.select();
    goster();
    aramaVerisiniYukle().catch(function () {});
  }
  function kapat() { panel.classList.remove('acik'); }

  dugme.addEventListener('click', function () { panel.classList.contains('acik') ? kapat() : ac(); });
  kutu.addEventListener('input', goster);
  kutu.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); sec(secili + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sec(secili - 1); }
    else if (e.key === 'Enter') {
      var o = sonucKutu.querySelectorAll('.arama-oge')[Math.max(secili, 0)];
      if (o) { e.preventDefault(); o.click(); }
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') kapat();
    var yaziyor = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    if (e.key === '/' && !yaziyor && !e.metaKey && !e.ctrlKey) { e.preventDefault(); ac(); }
  });
  document.addEventListener('click', function (e) {
    if (!panel.contains(e.target) && !dugme.contains(e.target)) kapat();
  });
}

// ── Duyurular ve ders bilgileri ──
// Veritabanındaki metinler textContent ile basılır (HTML olarak işlenmez); bağlantılar yalnızca http(s)/mailto.
function el(etiket, sinif, metin) {
  var e = document.createElement(etiket);
  if (sinif) e.className = sinif;
  if (metin != null) e.textContent = metin;
  return e;
}
function guvenliLink(url) {
  var u = String(url || '').trim();
  return /^(https?:|mailto:)/i.test(u) ? u : null;
}
function disLink(a, url) { a.href = url; if (!/^mailto:/i.test(url)) { a.target = '_blank'; a.rel = 'noopener'; } return a; }
function tarihYazi(t) { return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(t); }
// Tarihin yerel saate göre günü: 'YYYY-AA-GG' (toISOString UTC'ye çevirir, gece yarısına yakın saatlerde bir gün kayar)
function gunYazi(t) { var p = function (n) { return (n < 10 ? '0' : '') + n; }; return t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate()); }
function bosMesaj(kutu, metin) { kutu.innerHTML = ''; kutu.appendChild(el('p', 'bos-mesaj', metin)); }

function duyuruKarti(d) {
  var k = el('article', 'duyuru');
  if (d.tarih && !isNaN(d.tarih)) {
    var t = el('time', 'duyuru-tarih', tarihYazi(d.tarih));
    t.dateTime = gunYazi(d.tarih);
    k.appendChild(t);
  }
  k.appendChild(el('h3', 'duyuru-baslik', d.baslik || ''));
  if (d.metin) k.appendChild(el('p', 'duyuru-metin', d.metin));
  var u = guvenliLink(d.link);
  if (u) k.appendChild(disLink(el('a', 'duyuru-link', (d.linkYazi || 'Bağlantıyı aç') + ' →'), u));
  return k;
}

function duyurulariCiz(kutu, liste) {
  if (!liste.length) return bosMesaj(kutu, 'Henüz duyuru yok.');
  kutu.innerHTML = '';
  liste.forEach(function (d) { kutu.appendChild(duyuruKarti(d)); });
}

// Ana sayfa: son duyurular kutusu ve Drive düğmesi (veri yoksa gizli kalır)
function anaSayfaDuyurulari(liste) {
  var bolum = document.querySelector('.duyuru-ozet');
  if (!bolum || !liste.length) return;
  duyurulariCiz(bolum.querySelector('.duyuru-liste'), liste);
  bolum.hidden = false;
}
function driveDugmesi(ayar) {
  var a = document.querySelector('.drive-btn'), u = guvenliLink(ayar.driveLink);
  if (!a || !u) return;
  disLink(a, u);
  a.hidden = false;
}

// Site ayarları (yönetim panelindeki "Ayarlar"): <span data-ayar="donem|kurum"> içindeki sabit yazının yerine geçer.
// Ayar boşsa ya da veritabanına ulaşılamazsa sayfadaki sabit yazı olduğu gibi kalır.
function siteAyarlariniUygula(ayar) {
  document.querySelectorAll('[data-ayar]').forEach(function (e) {
    var deger = ayar[e.dataset.ayar];
    if (typeof deger === 'string' && deger.trim()) e.textContent = deger.trim();
  });
  driveDugmesi(ayar);
}

// Ders Bilgileri sayfası. Girilmemiş bölümlerde "Henüz eklenmedi." yazar; hiçbir bilgi uydurulmaz.
function dersBilgileriniCiz(ders) {
  var alan = function (ad) { return document.querySelector('[data-alan="' + ad + '"]'); };
  var bos = 'Henüz eklenmedi.';

  var hakkinda = alan('hakkinda');
  hakkinda.innerHTML = '';
  if (ders.tanim) hakkinda.appendChild(el('p', 'bilgi-metin', ders.tanim));
  [['Ders saatleri', ders.dersSaatleri], ['Derslik', ders.derslik]].forEach(function (s) {
    if (s[1]) { var p = el('p', 'bilgi-satir'); p.appendChild(el('span', 'bilgi-etiket', s[0])); p.appendChild(el('span', '', s[1])); hakkinda.appendChild(p); }
  });
  if (!hakkinda.children.length) bosMesaj(hakkinda, bos);

  var sinav = alan('sinavlar'), sinavlar = ders.sinavlar || [];
  if (!sinavlar.length) bosMesaj(sinav, bos);
  else {
    sinav.innerHTML = '';
    var bugun = new Date(); bugun.setHours(0, 0, 0, 0);
    sinavlar.slice().sort(function (a, b) { return String(a.tarih).localeCompare(String(b.tarih)); }).forEach(function (s) {
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.tarih || ''), t = m && new Date(+m[1], m[2] - 1, +m[3]);
      var satir = el('div', 'sinav');
      satir.appendChild(el('div', 'sinav-ad', s.ad || ''));
      satir.appendChild(el('div', 'sinav-tarih', [t ? tarihYazi(t) : (s.tarih || ''), s.saat, s.yer].filter(Boolean).join(' · ')));
      if (t) {
        var gun = Math.round((t - bugun) / 864e5);
        satir.appendChild(el('span', 'sinav-kalan' + (gun < 0 ? ' gecti' : ''), gun < 0 ? 'Tamamlandı' : gun === 0 ? 'Bugün' : gun + ' gün kaldı'));
      }
      sinav.appendChild(satir);
    });
  }

  var deg = alan('degerlendirme'), kalemler = ders.degerlendirme || [];
  if (!kalemler.length) bosMesaj(deg, bos);
  else {
    deg.innerHTML = '';
    kalemler.forEach(function (k) {
      var s = el('div', 'deg-kalem');
      s.appendChild(el('span', '', k.ad || ''));
      s.appendChild(el('span', 'deg-yuzde', k.yuzde != null ? '%' + k.yuzde : ''));
      deg.appendChild(s);
    });
  }

  var kay = alan('kaynaklar'), kaynaklar = ders.kaynaklar || [];
  if (!kaynaklar.length) bosMesaj(kay, bos);
  else {
    kay.innerHTML = '';
    var ul = el('ul', 'bilgi-liste');
    kaynaklar.forEach(function (k) { ul.appendChild(el('li', '', k)); });
    kay.appendChild(ul);
  }

  var il = alan('iletisim'), i = ders.iletisim || {};
  il.querySelectorAll('.bilgi-satir.dinamik, .bos-mesaj').forEach(function (e) { e.remove(); });
  var eklendi = 0;
  [['E-posta', i.eposta], ['Ofis', i.ofis], ['Ofis saatleri', i.ofisSaatleri]].forEach(function (s) {
    if (!s[1]) return;
    var p = el('p', 'bilgi-satir dinamik'); p.appendChild(el('span', 'bilgi-etiket', s[0]));
    if (s[0] === 'E-posta' && /^[^\s@]+@[^\s@]+$/.test(s[1])) p.appendChild(disLink(el('a', '', s[1]), 'mailto:' + s[1]));
    else p.appendChild(el('span', '', s[1]));
    il.appendChild(p); eklendi++;
  });
  if (!eklendi) il.appendChild(el('p', 'bos-mesaj', 'E-posta, ofis ve ofis saatleri henüz eklenmedi.'));
}

function dersKonulariniCiz(konular) {
  var kutu = document.querySelector('[data-alan="konular"]');
  if (!kutu || !konular.length) return;
  kutu.innerHTML = '';
  [['oncesi', '▲ Arasınav Öncesi'], ['sonrasi', '▼ Arasınav Sonrası']].forEach(function (b) {
    var grup = konular.filter(function (k) { return k.bolum === b[0]; });
    if (!grup.length) return;
    kutu.appendChild(el('div', 'konu-grup-baslik', b[1]));
    var ul = el('ul', 'bilgi-liste konu-liste');
    grup.forEach(function (k) {
      var li = el('li'), a = el('a', '', 'Konu ' + k.sira + ' · ' + k.ad);
      a.href = k.sayfa;
      li.appendChild(a); li.appendChild(el('span', 'konu-sayi', k.sorular.length + ' soru'));
      ul.appendChild(li);
    });
    kutu.appendChild(ul);
  });
}

// ── Hata bildirimi: kartlarda "⚠ Hata bildir", footer'da "Hata / öneri bildir" ──
// Bildirim doğrudan veritabanına gider (hataBildirimleri); öğrenciler okuyamaz, yalnızca ders sorumlusu görür.
var bildirPencere = null, BEKLEME = 30 * 1000;

function sayfaAdi() { return location.pathname.split('/').pop() || 'index.html'; }

function bildirPenceresiniKur() {
  var d = document.createElement('dialog');
  d.className = 'bildir-pencere';
  d.innerHTML =
    '<form class="bildir-form">' +
      '<h2 class="bildir-baslik"></h2>' +
      '<p class="bildir-aciklama">Soruda, çözümde ya da sitede gördüğünüz hatayı kısaca yazın. Bildiriminiz doğrudan ders sorumlusuna iletilir.</p>' +
      '<label for="bildirMesaj">Mesajınız</label>' +
      '<textarea id="bildirMesaj" rows="5" maxlength="2000" required placeholder="Örn. 3. adımdaki karekök sonucu hatalı görünüyor."></textarea>' +
      '<label for="bildirEposta">E-posta <span>(isteğe bağlı, size dönüş yapılabilmesi için)</span></label>' +
      '<input id="bildirEposta" type="email" maxlength="100" autocomplete="email">' +
      '<p class="bildir-not">E-posta adresiniz yalnızca bu bildirimle ilgili size dönüş yapmak için kullanılır.</p>' +
      '<p class="bildir-not bildir-kim" hidden></p>' +
      '<div class="bildir-durum" role="status"></div>' +
      '<div class="bildir-dugmeler"><button type="button" class="bildir-vazgec">Vazgeç</button>' +
      '<button type="submit" class="bildir-gonder">Gönder</button></div>' +
    '</form>';
  document.body.appendChild(d);
  var form = d.querySelector('form'), mesaj = d.querySelector('#bildirMesaj'), eposta = d.querySelector('#bildirEposta');
  var durumKutu = d.querySelector('.bildir-durum'), gonder = d.querySelector('.bildir-gonder');
  var durum = function (metin, tur) { durumKutu.textContent = metin; durumKutu.className = 'bildir-durum' + (tur ? ' ' + tur : ''); };
  var kapat = function () { if (d.open) d.close(); };

  d.querySelector('.bildir-vazgec').addEventListener('click', kapat);
  d.addEventListener('click', function (e) { if (e.target === d) kapat(); });  // karartılmış alana tıklayınca
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var m = mesaj.value.trim(), ep = eposta.value.trim();
    if (!m) return durum('Lütfen mesajınızı yazın.', 'hata');
    if (ep && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ep)) return durum('E-posta adresi geçerli görünmüyor.', 'hata');
    var son = 0;
    try { son = +localStorage.getItem('end214-son-bildirim') || 0; } catch (x) { /* tarayıcı izin vermiyor */ }
    if (Date.now() - son < BEKLEME) return durum('Az önce bir bildirim gönderdiniz. Lütfen biraz bekleyip tekrar deneyin.', 'hata');
    gonder.disabled = true;
    durum('Gönderiliyor…');
    import('./veri-katmani.js?v=e6c6c36d')
      .then(function (v) { return v.hataBildir({ soruId: d.dataset.soruId, sayfa: sayfaAdi(), mesaj: m, eposta: ep }); })
      .then(function () {
        try { localStorage.setItem('end214-son-bildirim', String(Date.now())); } catch (x) { /* önemli değil */ }
        mesaj.value = '';
        durum('Teşekkürler, bildiriminiz iletildi.', 'tamam');
        setTimeout(kapat, 1800);
      })
      .catch(function () { durum('Gönderilemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.', 'hata'); })
      .then(function () { gonder.disabled = false; });
  });
  return d;
}

function hataBildirAc(soruId, no) {
  if (!bildirPencere) bildirPencere = bildirPenceresiniKur();
  var d = bildirPencere;
  d.dataset.soruId = soruId || '';
  d.querySelector('.bildir-baslik').textContent = soruId ? '⚠ Hata bildir · ' + no : 'Hata / öneri bildir';
  d.querySelector('.bildir-durum').textContent = '';
  var kim = d.querySelector('.bildir-kim'), ep = d.querySelector('#bildirEposta');
  kim.hidden = !kullanici;
  if (kullanici) {
    kim.textContent = 'Bildiriminiz adınızla gönderilecek: ' + (kullanici.ad || kullanici.eposta);
    if (!ep.value) ep.value = kullanici.eposta || '';
  }
  if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
  d.querySelector('#bildirMesaj').focus();
}

// Kartın altındaki satır: solda "Çözdüm", sağda "⚠ Hata bildir"
function kartAltlariniEkle() {
  document.querySelectorAll('.questions-grid > .q-card').forEach(function (c) {
    var govde = c.querySelector('.q-body');
    if (!govde || govde.querySelector('.kart-alt')) return;
    var satir = el('div', 'kart-alt');
    var coz = el('button', 'cozdum-dugme');
    coz.type = 'button';
    coz.addEventListener('click', function () { cozdumTikla(c, coz); });
    var bildir = el('button', 'bildir-link', '⚠ Hata bildir');
    bildir.type = 'button';
    bildir.addEventListener('click', function () { hataBildirAc(c.id, c.querySelector('.q-num').textContent.trim()); });
    satir.appendChild(coz); satir.appendChild(bildir);
    govde.appendChild(satir);
  });
  isaretleriGoster();
}

function footerBildirLinki() {
  var f = document.querySelector('footer');
  if (!f || f.querySelector('.bildir-genel')) return;
  var b = el('button', 'bildir-genel', 'Hata / öneri bildir');
  b.type = 'button';
  b.addEventListener('click', function () { hataBildirAc('', ''); });
  f.appendChild(document.createElement('br'));
  f.appendChild(b);
}

// ── Öğrenci hesabı: menüdeki düğme, "Çözdüm" işaretleri, ilerleme ──
// Giriş zorunlu değildir; hesabı olmayan öğrenci siteyi aynen kullanır, yalnızca işaretleyemez.
var kullanici = null, cozulen = {}, hesapBilindi = false;

function hesapDugmesiniKur() {
  var arama = document.querySelector('.topnav .arama-dugme');
  if (!arama) return;
  var a = el('a', 'hesap-dugme');
  a.href = 'hesap.html';
  a.innerHTML = '<span aria-hidden="true">👤</span><span class="hesap-dugme-yazi">Giriş</span>';
  a.setAttribute('aria-label', 'Hesabım');
  if (sayfaAdi() === 'hesap.html') a.classList.add('active');
  arama.insertAdjacentElement('afterend', a);
}

function hesapDugmesiniGuncelle() {
  var y = document.querySelector('.hesap-dugme-yazi');
  if (y) y.textContent = kullanici ? (kullanici.ad || 'Hesabım').split(' ')[0] : 'Giriş';
}

function donusAdresi() { return encodeURIComponent(sayfaAdi() + location.hash); }

function cozdumTikla(c, dugme) {
  var ipucu = c.querySelector('.kart-ipucu');
  if (ipucu) ipucu.remove();
  if (!kullanici) {
    var p = el('span', 'kart-ipucu');
    var a = el('a', '', 'İşaretlemek için giriş yapın →');
    a.href = 'hesap.html?donus=' + encodeURIComponent(sayfaAdi() + '#' + c.id);
    p.appendChild(a);
    dugme.insertAdjacentElement('afterend', p);
    return;
  }
  var yeni = !cozulen[c.id];
  if (yeni) cozulen[c.id] = true; else delete cozulen[c.id];
  isaretleriGoster();
  import('./veri-katmani.js?v=e6c6c36d')
    .then(function (v) { return v.cozulduIsaretle(c.id, yeni); })
    .catch(function () {  // kaydedilemediyse geri al
      if (yeni) delete cozulen[c.id]; else cozulen[c.id] = true;
      isaretleriGoster();
      dugme.insertAdjacentElement('afterend', el('span', 'kart-ipucu hata', 'Kaydedilemedi, tekrar deneyin.'));
    });
}

function isaretleriGoster() {
  var kartlar = document.querySelectorAll('.questions-grid > .q-card'), say = 0;
  kartlar.forEach(function (c) {
    var isaretli = !!(kullanici && cozulen[c.id]);
    if (isaretli) say++;
    c.classList.toggle('cozuldu', isaretli);
    var b = c.querySelector('.cozdum-dugme');
    if (b) {
      b.textContent = isaretli ? '✓ Çözdüm' : '○ Çözdüm';
      b.setAttribute('aria-pressed', isaretli ? 'true' : 'false');
      b.title = isaretli ? 'İşareti kaldırmak için tıklayın' : 'Bu soruyu çözdüm olarak işaretle';
    }
  });
  var filtre = document.querySelector('.zorluk-filtre');
  if (!filtre) return;
  var il = filtre.querySelector('.ilerleme');
  if (!il) { il = el('span', 'ilerleme'); filtre.appendChild(il); }
  il.hidden = !kullanici;
  il.textContent = 'İlerlemeniz: ' + say + ' / ' + kartlar.length;
}

// Hesap durumunu bütün sayfalarda izler (menüdeki ad, kartlardaki işaretler, bildirim penceresi)
function hesabiIzle() {
  import('./veri-katmani.js?v=e6c6c36d').then(function (v) {
    v.girisDurumu(function (k) {
      kullanici = k; hesapBilindi = true;
      hesapDugmesiniGuncelle();
      document.dispatchEvent(new CustomEvent('end214-hesap'));
      if (!k) { cozulen = {}; isaretleriGoster(); return; }
      if (document.body.dataset.konu) v.cozulenler().then(function (c) { cozulen = c; isaretleriGoster(); }).catch(function () {});
    });
  }).catch(function () { /* veritabanına ulaşılamıyor: herkes misafir */ });
}

// ── Hesap sayfası (hesap.html) ──
// Girişten sonra dönülecek adres yalnızca bu sitenin bir sayfası olabilir (ör. ga.html#GA-04); başka siteye yönlendirmez.
function gecerliDonus(d) { return /^[a-z]+\.html(#[A-Za-z]+-\d+)?$/.test(d || ''); }

function hesapSayfasi() {
  var $ = function (s) { return document.querySelector(s); };
  var goster = function (d) { document.querySelectorAll('[data-durum]').forEach(function (b) { b.hidden = b.dataset.durum !== d; }); };
  var mesaj = function (kutu, metin, tur) { kutu.textContent = metin; kutu.className = 'mesaj' + (tur ? ' ' + tur : ''); };
  var donus = new URLSearchParams(location.search).get('donus') || '';
  var geriDon = function () { if (gecerliDonus(donus)) location.href = donus; };

  document.querySelectorAll('.hesap-sekmeler button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.hesap-sekmeler button').forEach(function (x) { x.classList.toggle('aktif', x === b); x.setAttribute('aria-selected', x === b); });
      $('#girisForm').hidden = b.dataset.sekme !== 'giris';
      $('#kayitForm').hidden = b.dataset.sekme !== 'kayit';
    });
  });

  import('./veri-katmani.js?v=e6c6c36d').then(function (v) {
    $('#girisForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var m = $('#girisMesaj');
      mesaj(m, 'Giriş yapılıyor…');
      v.girisYap($('#girisEposta').value.trim(), $('#girisSifre').value)
        .then(function () { $('#girisSifre').value = ''; mesaj(m, ''); geriDon(); })
        .catch(function (err) { mesaj(m, v.hataMetni(err), 'hata'); });
    });
    $('#sifremiUnuttum').addEventListener('click', function () {
      var ep = $('#girisEposta').value.trim(), m = $('#girisMesaj');
      if (!ep) return mesaj(m, 'Önce e-posta adresinizi yazın.', 'hata');
      v.sifreSifirla(ep)
        .then(function () { mesaj(m, 'Bu adres kayıtlıysa şifre sıfırlama bağlantısı gönderildi. Gelen kutunuzu (ve gereksiz klasörünü) kontrol edin.', 'tamam'); })
        .catch(function (err) { mesaj(m, v.hataMetni(err), 'hata'); });
    });
    $('#kayitForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var m = $('#kayitMesaj'), ad = $('#kayitAd').value.trim();
      if (!ad) return mesaj(m, 'Lütfen adınızı ve soyadınızı yazın.', 'hata');
      if (!$('#kayitOnay').checked) return mesaj(m, 'Devam etmek için aydınlatma metnini okuduğunuzu onaylayın.', 'hata');
      mesaj(m, 'Hesap oluşturuluyor…');
      v.kayitOl({ ad: ad, eposta: $('#kayitEposta').value.trim(), sifre: $('#kayitSifre').value })
        .then(function () {
          // giriş olayı ad profile yazılmadan önce gelir; adı burada tamamla
          if (kullanici) kullanici.ad = ad;
          $('#kayitSifre').value = ''; mesaj(m, ''); hesapDugmesiniGuncelle(); ogrenciGoster(); geriDon();
        })
        .catch(function (err) { mesaj(m, v.hataMetni(err), 'hata'); });
    });
    document.querySelectorAll('[data-cikis]').forEach(function (b) { b.addEventListener('click', function () { v.cikisYap(); }); });
    $('#silForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var m = $('#silMesaj');
      if (!confirm('Hesabınız ve işaretlediğiniz bütün sorular kalıcı olarak silinecek. Emin misiniz?')) return;
      mesaj(m, 'Siliniyor…');
      v.hesabiSil($('#silSifre').value)
        .then(function () { mesaj(m, ''); $('#silSifre').value = ''; })
        .catch(function (err) { mesaj(m, v.hataMetni(err), 'hata'); });
    });

    function ogrenciGoster() {
      goster('ogrenci');
      $('[data-ad]').textContent = (kullanici && kullanici.ad) || '';
      $('[data-eposta]').textContent = (kullanici && kullanici.eposta) || '';
      var liste = $('.ilerleme-liste');
      Promise.all([v.tumKonular(), v.cozulenler()]).then(function (r) {
        var konular = r[0], coz = r[1], toplam = 0, toplamCoz = 0;
        liste.innerHTML = '';
        konular.forEach(function (k) {
          var n = k.sorular.length, c = k.sorular.filter(function (s) { return coz[s.id]; }).length;
          toplam += n; toplamCoz += c;
          var a = el('a', 'ilerleme-satir'); a.href = k.sayfa;
          var ust = el('div', 'ilerleme-ust');
          ust.appendChild(el('span', '', 'Konu ' + k.sira + ' · ' + k.ad));
          ust.appendChild(el('span', 'ilerleme-sayi', c + ' / ' + n));
          var cubuk = el('div', 'ilerleme-cubuk'), dolu = el('div', 'ilerleme-dolu');
          dolu.style.width = (n ? Math.round(100 * c / n) : 0) + '%';
          cubuk.appendChild(dolu); a.appendChild(ust); a.appendChild(cubuk);
          liste.appendChild(a);
        });
        $('.ilerleme-toplam').textContent = 'Toplam: ' + toplamCoz + ' / ' + toplam + ' soru';
      }).catch(function () { bosMesaj(liste, 'İlerleme şu an yüklenemedi.'); });
    }

    document.addEventListener('end214-hesap', function () { if (kullanici) ogrenciGoster(); else goster('misafir'); });
    if (hesapBilindi) { if (kullanici) ogrenciGoster(); else goster('misafir'); }
  }).catch(function () {
    $('[data-durum="yukleniyor"]').innerHTML = '';
    $('[data-durum="yukleniyor"]').appendChild(el('p', 'mesaj hata', 'Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip sayfayı yenileyin.'));
  });
}

// ── Sayfa açılışı ──
// <body data-konu="ga">: içerik veritabanından çekilip yeniden çizilir; ulaşılamazsa statik içerik kalır.
// <body data-sayfa="ana">: konu kartlarındaki sayılar veritabanından hesaplanır.
// İçeriğin nereden geldiği <body data-icerik="…"> üzerinde görünür: "veritabani" ya da "yedek".
function sayfayiBaslat() {
  if (document.body.dataset.sayfa === 'yonetim') return;  // yönetim paneli yalnızca çizim fonksiyonlarını kullanır
  aramayiKur();
  hesapDugmesiniKur();
  footerBildirLinki();
  hesabiIzle();
  import('./veri-katmani.js?v=e6c6c36d')
    .then(function (v) { return v.siteAyarlari(); })
    .then(siteAyarlariniUygula)
    .catch(function () {});
  if (document.body.dataset.sayfa === 'hesap') hesapSayfasi();
  var kod = document.body.dataset.konu;
  if (kod) {
    document.body.dataset.icerik = 'yedek';
    kartlaraKimlikVer(); konuSayaclari(); zorlukFiltresiniKur(); kartAltlariniEkle(); bagliKartiAc();
    window.addEventListener('hashchange', bagliKartiAc);
    import('./veri-katmani.js?v=e6c6c36d')
      .then(function (v) { return v.konuGetir(kod); })
      .then(function (konu) {
        if (!konuyuCiz(konu)) return;
        document.body.dataset.icerik = 'veritabani';
        kartlaraKimlikVer(); konuSayaclari(konu.sira); filtreUygula(aktifZorluk); kartAltlariniEkle();
        var c = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
        if (c && c.classList.contains('q-card')) vurgula(c);
      })
      .catch(function (e) { console.warn('END214: veritabanına ulaşılamadı, sayfadaki kayıtlı içerik gösteriliyor.', e); });
  } else if (document.body.dataset.sayfa === 'ana') {
    document.body.dataset.icerik = 'yedek';
    var vk = import('./veri-katmani.js?v=e6c6c36d');
    vk.then(function (v) { return v.tumKonular(); })
      .then(function (konular) {
        if (!konular.length) return;
        anaSayfaSayaclari(konular);
        document.body.dataset.icerik = 'veritabani';
      })
      .catch(function (e) { console.warn('END214: veritabanına ulaşılamadı, sayfadaki kayıtlı sayılar gösteriliyor.', e); });
    vk.then(function (v) { return v.duyurular(3); }).then(anaSayfaDuyurulari).catch(function () {});
  } else if (document.body.dataset.sayfa === 'duyurular') {
    var liste = document.querySelector('.duyuru-liste');
    import('./veri-katmani.js?v=e6c6c36d')
      .then(function (v) { return v.duyurular(); })
      .then(function (d) { duyurulariCiz(liste, d); })
      .catch(function () { bosMesaj(liste, 'Duyurular şu an yüklenemedi. İnternet bağlantınızı kontrol edip sayfayı yenileyin.'); });
  } else if (document.body.dataset.sayfa === 'ders') {
    var vd = import('./veri-katmani.js?v=e6c6c36d');
    vd.then(function (v) { return v.dersBilgileri(); })
      .then(dersBilgileriniCiz)
      .catch(function () {
        document.querySelectorAll('[data-alan]:not([data-alan="konular"]):not([data-alan="iletisim"])').forEach(function (k) {
          bosMesaj(k, 'Şu an yüklenemedi. İnternet bağlantınızı kontrol edip sayfayı yenileyin.');
        });
      });
    vd.then(function (v) { return v.tumKonular(); }).then(dersKonulariniCiz).catch(function () {});
  }
}
if (typeof document !== 'undefined') sayfayiBaslat();

// ── Kart ve çözüm aç/kapa ──
function toggleCard(h) { h.closest('.q-card').classList.toggle('open'); }
function toggleSolution(btn) {
  var s = btn.nextElementSibling;
  if (!btn.dataset.metin) btn.dataset.metin = btn.textContent;  // sayfanın kendi "Çözümü Göster" yazısı (▶ / ►)
  s.classList.toggle('visible');
  btn.textContent = s.classList.contains('visible') ? '▼ Çözümü Gizle' : btn.dataset.metin;
}
