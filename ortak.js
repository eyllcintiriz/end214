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
    aramaVerisi = import('./veri-katmani.js?v=52648b9a')
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

// ── Sayfa açılışı ──
// <body data-konu="ga">: içerik veritabanından çekilip yeniden çizilir; ulaşılamazsa statik içerik kalır.
// <body data-sayfa="ana">: konu kartlarındaki sayılar veritabanından hesaplanır.
// İçeriğin nereden geldiği <body data-icerik="…"> üzerinde görünür: "veritabani" ya da "yedek".
function sayfayiBaslat() {
  aramayiKur();
  var kod = document.body.dataset.konu;
  if (kod) {
    document.body.dataset.icerik = 'yedek';
    kartlaraKimlikVer(); konuSayaclari(); zorlukFiltresiniKur(); bagliKartiAc();
    window.addEventListener('hashchange', bagliKartiAc);
    import('./veri-katmani.js?v=52648b9a')
      .then(function (v) { return v.konuGetir(kod); })
      .then(function (konu) {
        if (!konuyuCiz(konu)) return;
        document.body.dataset.icerik = 'veritabani';
        kartlaraKimlikVer(); konuSayaclari(konu.sira); filtreUygula(aktifZorluk);
        var c = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
        if (c && c.classList.contains('q-card')) vurgula(c);
      })
      .catch(function (e) { console.warn('END214: veritabanına ulaşılamadı, sayfadaki kayıtlı içerik gösteriliyor.', e); });
  } else if (document.body.dataset.sayfa === 'ana') {
    document.body.dataset.icerik = 'yedek';
    import('./veri-katmani.js?v=52648b9a')
      .then(function (v) { return v.tumKonular(); })
      .then(function (konular) {
        if (!konular.length) return;
        anaSayfaSayaclari(konular);
        document.body.dataset.icerik = 'veritabani';
      })
      .catch(function (e) { console.warn('END214: veritabanına ulaşılamadı, sayfadaki kayıtlı sayılar gösteriliyor.', e); });
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
