# END214 – Olasılık ve İstatistik II · Soru Bankası

Prof. Dr. Fikri Gökpınar'ın END 214 dersi için çözümlü soru bankası, formül kartları, duyurular ve ders bilgileri.
Site GitHub Pages'te yayınlanır: <https://fikrigokpinar.github.io/END214/>

Site düz HTML, CSS ve JavaScript'ten oluşur. Derleme adımı, framework ya da npm yoktur. Dosyalar olduğu gibi yayınlanır.

## Sayfalar

| Sayfa | İçerik |
|---|---|
| `index.html` | Ana sayfa: konular, toplam sayılar, son 3 duyuru, Google Drive düğmesi |
| `temel`, `me`, `dag`, `grafik`, `tahmin`, `ga`, `ht`, `reg` (`.html`) | 8 konu: çözümlü sorular ve formül kartları |
| `duyurular.html` | Bütün duyurular |
| `ders.html` | Ders bilgileri: sınav tarihleri, değerlendirme, kaynaklar, iletişim |
| `hesap.html` | İsteğe bağlı öğrenci hesabı: "Çözdüm" işaretleri ve ilerleme |
| `tablolar.html`, `cheatsheet.html` | İstatistik tabloları ve formül özeti (sabit sayfalar) |
| `admin.html` | Yönetim paneli (yalnızca ders sorumlusu) |

Öğrenciler için:
- **Soru arama:** menüdeki 🔍 (ya da `/` tuşu). Türkçe karakter yazmak gerekmez.
- **Zorluk filtresi:** Tümü / Temel / Orta / İleri.
- **Soru bağlantısı:** `ga.html#GA-04` gibi bir adres o soruyu açar.
- **⚠ Hata bildir:** her sorunun altında. Bildirim doğrudan yönetim paneline düşer.

## Yönetim paneli (`admin.html`)

Ders sorumlusu e-posta ve şifresiyle girer. Kod ya da GitHub bilmeden şunları yapabilir:

- **Düzeltme Önerileri:** soruların hesap düzeltmeleri. Eski ve önerilen hal yan yana görünür. Onayla, düzenleyip onayla ya da reddet; kararı geri al.
- **Hata Bildirimleri:** öğrencilerden gelen bildirimler. Soruyu aç ya da düzenle, çözüldü olarak işaretle, sil.
- **Sorular** ve **Formül Kartları:** düzenle, yeni ekle, sil, sırala. Kaydetmeden önce sitedeki görünümünü gösteren bir önizleme vardır.
- **Duyurular**, **Ders Bilgileri**, **Ayarlar** (dönem, kurum yazısı, Drive linki).
- **Yedek:** bütün içeriği tek bir JSON dosyası olarak indirir.

Yapılan değişiklik sitede hemen görünür. Sayfaların tasarımı değişmez. Ayrıntılı anlatım "Yönetim Paneli Kullanım Kılavuzu"ndadır.

## Nasıl çalışır?

```
 Öğrenci sayfaları (GitHub Pages)            Yönetim paneli (admin.html)
          │ okur                                    │ okur + yazar (yalnızca yönetici)
          └───────────────┬─────────────────────────┘
                          ▼
         Firebase (ücretsiz Spark planı): Firestore veritabanı + Authentication
```

- **Veritabanı:** Firebase Firestore. Konular (`konular/{kod}`: sorular ve formül kartları), `duyurular`, `site/ayarlar`, `site/ders`, `oneriler`, `hataBildirimleri`, öğrenci ilerlemesi (`ogrenciler/{uid}`) ve yönetici listesi (`yoneticiler/{uid}`) burada tutulur.
- **Veri katmanı:** Sitenin ve panelin bütün veritabanı erişimi `veri-katmani.js` üzerinden yapılır. İleride başka bir veritabanına geçilirse yalnızca bu dosya yeniden yazılır.
- **Güvenlik kuralları (`firestore.rules`):** İçeriği herkes okuyabilir, yalnızca yöneticiler yazabilir. Öğrenciler hata bildirimi gönderebilir ama gönderilenleri okuyamaz. Her öğrenci yalnızca kendi ilerleme kaydını görür. Yönetici, Firebase konsolunda `yoneticiler` koleksiyonuna elle eklenir. **Bu dosyayı değiştirmek tek başına yetmez:** kurallar Firebase konsolunda (Firestore → Rules) yayınlanmalıdır.
- **`firebase-ayar.js`** gizli bilgi içermez. Bu, Firebase'in web uygulamaları için herkese açık bağlantı ayarıdır. Koruma güvenlik kurallarıyla sağlanır.
- **Güvenlik:** Veritabanından gelen soru metinleri sayfaya basılmadan önce DOMPurify ile temizlenir. Duyuru ve ders bilgileri düz yazı olarak basılır. Bağlantılar yalnızca `https://` ya da `mailto:` olabilir.
- **Önbellek:** Konu listesi ve site ayarları ziyaretçinin tarayıcısında 15 dakika saklanır (kotayı korumak için). Konu sayfaları her açılışta günceldir.

### Statik yedek

Konu sayfaları (`ga.html` vb.) soruların bir kopyasını içlerinde taşır. Veritabanına ulaşılamazsa öğrenci bu kopyayı görür. Panelden soru düzenlendikçe bu kopya eskir. Ara ara şöyle güncellenir:

1. Panel → **Yedek** → "Yedeği indir".
2. `python3 araclar/yedekten_guncelle.py ~/Downloads/END214-yedek-….json` komutu yalnızca rapor verir; neyin değişeceğini gösterir.
3. Rapor uygunsa aynı komutu sonuna `--yaz` ekleyerek çalıştırın. Değişikliği kontrol edip commit'leyin.

Araç yalnızca değişen kartları yeniden yazar, aynı kartlara harfi harfine dokunmaz. Yazdıktan sonra sonucu doğrular. Ana sayfadaki ve Ders Bilgileri sayfasındaki sayıları da günceller. **Yedek dosyasını depoya koymayın:** hata bildirimlerinde öğrenci adları ve e-postaları bulunabilir (`.gitignore` bunu engeller).

Veritabanına ulaşılamadığında arama, depodaki `veri/konular.json` dosyasını kullanır. Bu dosya veritabanının ilk kurulumdaki halidir.

## Dosyalar

```
index.html, temel.html … reg.html, duyurular.html, ders.html, hesap.html, admin.html, tablolar.html, cheatsheet.html
style.css            bütün sayfaların stili (koyu tema; renkler :root değişkenlerinde)
ortak.js             bütün sayfaların ortak kodu: kart çizimi, arama, filtre, hata bildirimi, öğrenci hesabı
veri-katmani.js      veritabanı erişimi (Firebase)
yonetim.js           yönetim paneli
firebase-ayar.js     Firebase bağlantı ayarı
firestore.rules      veritabanı güvenlik kuralları (konsolda yayınlanır)
veri/                ilk kurulum verisi: konular.json (sorular, formül kartları), oneriler.json (düzeltme önerileri)
araclar/             yardımcı araçlar (aşağıda)
```

### `araclar/`

| Araç | Ne işe yarar |
|---|---|
| `surum.py` | CSS/JS dosyalarının bağlantılarına sürüm ekler (`style.css?v=…`). Böylece tarayıcılar eski dosyayı göstermez. |
| `sunucu.py` | Bilgisayarda deneme için önbelleksiz sunucu: `python3 araclar/sunucu.py`, ardından <http://localhost:8000> |
| `yedekten_guncelle.py` | Statik yedeği paneldeki yedek dosyasından günceller (yukarıda). |
| `veri_cikar.py` | Tek seferlik taşıma: sayfalardaki soruları `veri/konular.json`'a çıkarır ve düzeltme önerilerini üretir. |
| `kart_testi.mjs` | `ortak.js`'in ürettiği her kartın, Python'un ürettiğiyle bayt bayt aynı olduğunu denetler. |

Python araçları için `beautifulsoup4` gerekir (`pip install beautifulsoup4`).

## Değişiklik yaparken

- **CSS ya da JS dosyası değişince** commit'ten önce depo klasöründe `python3 araclar/surum.py` çalıştırın. Çalıştırılmazsa bazı tarayıcılar (özellikle Safari) eski dosyayı göstermeye devam eder.
- Yeni stiller `style.css`'in sonuna, yorum başlığıyla eklenir. Mevcut renk değişkenleri (`--amber`, `--teal`, `--red`, `--card`, `--border` …) kullanılır.
- Kart HTML'ini üreten iki kod vardır: `ortak.js` içindeki `kartHtml` ve `araclar/veri_cikar.py` içindeki `kart_html`. Bu ikisi birebir aynı çıktıyı vermelidir. Birini değiştirirseniz ötekini de değiştirin ve `node araclar/kart_testi.mjs` ile denetleyin.
- Önce bilgisayarda deneyin (`python3 araclar/sunucu.py`), sonra yayınlayın.

## Claude ile düzenleme

Bu depo bir yapay zekâ asistanıyla (ör. Claude Code) düzenlenebilecek şekilde sade tutuldu. Yeni bir oturumda şöyle başlayabilirsiniz:

> Bu klasör END214 ders sitesinin deposu. Önce README.md'yi oku. [Yapılacak iş]. Tasarımı (koyu tema, style.css değişkenleri) koru, veri erişimini veri-katmani.js üzerinden yap, CSS/JS değiştirirsen sonunda `python3 araclar/surum.py` çalıştır. Değişikliği önce `python3 araclar/sunucu.py` ile bilgisayarda göster, onayımdan sonra commit'le.

Soru, duyuru ve ders bilgisi gibi içerik değişiklikleri için koda gerek yoktur. Bunlar yönetim panelinden yapılır.

## Maliyet

Firebase'in ücretsiz **Spark** planı kullanılır. Kredi kartı tanımlı değildir, sürpriz fatura çıkmaz. Günlük ücretsiz sınır (50.000 okuma, 20.000 yazma) dersin ihtiyacının çok üstündedir. Sınır aşılırsa o gün veritabanı okumaları durur ve site statik yedekten açılır.
