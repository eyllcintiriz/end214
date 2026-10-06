"""
END214 – HTML sayfalarından veri çıkarma aracı (veritabanına tek seferlik taşıma için)

Ne yapar?
  1. Hocanın ORİJİNAL sayfalarından (git dalı: main) 8 konunun sorularını ve formül
     kartlarını okur, veri/konular.json dosyasına yazar.
     - Yalnızca "biçim" düzeltmeleri (bozuk karakterler, "Dağılım Ölçüleri" terimi)
       doğrudan uygulanır. Soru içeriğine dokunulmaz.
  2. Kanıt: JSON'dan her kartı yeniden HTML'e çevirir ve orijinal kartla
     birebir karşılaştırır. Tek bir fark bile varsa durur.
  3. Doğrulanmış düzeltmeleri içeren dal (faz1-duzeltmeler) ile soru soru karşılaştırır,
     farkları veri/oneriler.json dosyasına "düzeltme önerisi" olarak yazar.
     Bu öneriler hocanın onayına sunulur, onaysız uygulanmaz.

Kullanım (depo kök klasöründen):
    pip install beautifulsoup4
    python3 araclar/veri_cikar.py
"""
import copy, json, re, subprocess, sys
from bs4 import BeautifulSoup, Comment, NavigableString

KONULAR = ['temel', 'me', 'dag', 'grafik', 'tahmin', 'ga', 'ht', 'reg']
ORIJINAL, DUZELTILMIS = 'main', 'faz1-duzeltmeler'
ZORLUK = {'badge-easy': 'Temel', 'badge-med': 'Orta', 'badge-hard': 'İleri'}
ZORLUK_SINIF = {v: k for k, v in ZORLUK.items()}

# Biçim düzeltmeleri: içerik değil, bozuk karakter / terim. Doğrudan uygulanır.
BICIM = [
    ('&#11338;', '&#11388;'),  # x̄ⱼ: yanlış karakter kodu (Glagolitik harf) -> alt simge j
    ('Medyan = a&#8325;&#x208;&#x2085;&#x2083;&#x208;&#x2085;&#x208A;&#x2081;&#x208B;&#x2094;&#x2082;  = a&#8326;&#x2094;&#x2082; = a&#8323;<br>',
     'Medyan = a<sub>(N+1)/2</sub><br>'),
    ('&#770;&#7465;', '&#770;<sub>MM</sub>'),
    ('&#770;&#7461;', '&#770;<sub>EÇO</sub>'),
    ('&minus;1 &minus; 1/&#x305;(ln X)', '&minus;1 &minus; 1/<span style="text-decoration:overline">ln X</span>'),
    ('Merkezi Dağılım <em class="dag">Ölçüleri</em>', 'Dağılım <em class="dag">Ölçüleri</em>'),
    ('Merkezi Dağılım Ölçüleri', 'Dağılım Ölçüleri'),
]

# Düzeltme önerilerinin gerekçeleri (hocanın panelinde görünecek)
GEREKCE = {
    'GA-04': '√(1/12+1/15) = 0.3801 yazılmış; doğrusu 0.3873. E ve aralık sınırları buna göre değişiyor. Karar değişmiyor (aralık sıfırı içeriyor).',
    'GA-13': '2.576² = 6.6298 yazılmış; doğrusu 6.6358. n ≥ 1353.7 → n ≥ 1354. Kontrol satırı n = 1354 ile yeniden hesaplandı.',
    'GA-17': '√(1/8+1/9) = 0.4726 yazılmış; doğrusu 0.4859. E ≈ 3.099. Karar değişmiyor.',
    'HT-02': 'Σd² = 19400 yazılmış; d = [40,40,50,70,70,60] için doğrusu 19100. s_d ≈ 13.784, t ≈ 9.774. Karar değişmiyor.',
    'HT-11': 'Başlık ve etiket "sol kuyruklu" diyor; hipotez (H₁: μ > 8) ve çözüm sağ kuyruklu.',
    'HT-16': 'Σd² = 406 yazılmış; d = [8,7,2,10,6,3,8] için doğrusu 326. s_d ≈ 2.870, t ≈ 5.794. Karar değişmiyor.',
    'HT-17': '√(1/14+1/16) = 0.3694 yazılmış; doğrusu 0.3660. t ≈ 1.669 < 1.701. Karar değişmiyor.',
    'HT-18': '√(1/18+1/15) = 0.3586 yazılmış; doğrusu 0.3496. t ≈ −2.070 ve |t| > 2.040 olduğundan KARAR DEĞİŞİYOR: H₀ reddedilir. Yorum yeniden yazıldı.',
    'ME-09': 'Mod (Formül 1) hesabında f_s ve f_0 yer değiştirmiş: 20/(20+15) yerine 15/(15+20) olmalı. Mod = 134.29. AO < Medyan < Mod sıralaması değişmiyor.',
    'DAG-05': 'Çözümde taslaktan kalmış bir satır ("… Düzeltme: …") var; tek temiz satıra indirildi. Sonuç değişmiyor.',
    'DAG-09': 'Yorum "sağa çarpık" diyor; veride medyan Q₃\'e yakın, sol bıyık daha uzun, aykırı değer solda ve x̄ = 185.25 < medyan = 200 → sola çarpık. Kutu grafiği ölçekli olarak yeniden çizildi.',
    'DAG-10': 'Soru metnindeki sıralı listede 8.9 eksik ("+ bir değer" yazıyor); liste tamamlandı. (Verilen çeyreklerin veriyle uyuşmaması ayrıca size soruluyor.)',
    'GR-09': 'Frekanslar 3,7,5,8,4,3 yazılmış; verilerden doğrusu 3,8,4,8,3,4. Nispi/birikimli dağılım, histogram ve yorum (iki tepeli dağılım) güncellendi.',
    'NT-10': 'X₍₁₎ − θ̂/n yansız değil, çünkü E(θ̂) = (n−1)θ/n. Yansız tahmin edici X₍₁₎ − θ̂/(n−1). Gerekçe satırı eklendi.',
}
for _r in ['01', '02', '04', '05', '06', '07', '08', '09']:
    GEREKCE[f'REG-{_r}'] = ('Çözümdeki toplamlar (Σxy, Σx², Σy²) soru tablosundaki verilerle uyuşmuyor. '
                           'Veriye dokunmadan bütün adımlar (Sxx, Sxy, β̂₀, β̂₁, TKT, RKT, AKT, R², yorum) doğru toplamlarla yeniden hesaplandı.')
KARAR_DEGISIYOR = {'HT-18'}  # hipotez testi kararı tersine dönenler


def kaynak(ref, dosya):
    s = subprocess.run(['git', 'show', f'{ref}:{dosya}'], capture_output=True, text=True, check=True).stdout
    for eski, yeni in BICIM:
        s = s.replace(eski, yeni)
    return s


def ic(el):
    """Bir öğenin iç HTML'i (yorumlar dahil)."""
    return el.decode_contents().strip()


def anchor(no):
    return re.sub(r'[–—\-]+', '-', no)


def tek(kume, ad, dosya):
    if len(kume) != 1:
        sys.exit(f'HATA {dosya}: "{ad}" sınıfı kartlar arasında tutarsız: {kume}')
    return kume.pop()


def konu_cikar(ref, kod, ana):
    soup = BeautifulSoup(kaynak(ref, f'{kod}.html'), 'html.parser')
    kartlar = soup.select('.questions-grid > .q-card')
    stil_k = {k: set() for k in ['kart', 'no', 'parca', 'adim', 'cozum', 'cozumBaslik', 'buton', 'butonMetin']}
    sorular = []
    for c in kartlar:
        for hocaya in c.find_all(string=lambda t: isinstance(t, Comment) and 'HOCAYA SOR' in t):
            hocaya.extract()  # iç not, öneri sayılmaz
        no = c.select_one('.q-num')
        stil_k['kart'].add(' '.join(c['class'])); stil_k['no'].add(' '.join(no['class']))
        stil_k['cozum'].add(' '.join(c.select_one('.solution')['class']))
        stil_k['cozumBaslik'].add(' '.join(c.select_one('.sol-title')['class']))
        stil_k['buton'].add(' '.join(c.select_one('.sol-btn')['class']))
        stil_k['butonMetin'].add(c.select_one('.sol-btn').get_text(strip=True))
        for p in c.select('.part-label'): stil_k['parca'].add(' '.join(p['class']))
        for p in c.select('.step-n'): stil_k['adim'].add(' '.join(p['class']))
        rozetler = c.select('.q-badges .badge')
        zor = [b for b in rozetler if set(b['class']) & set(ZORLUK)]
        if len(zor) != 1 or rozetler[-1] is not zor[0]:
            sys.exit(f'HATA {kod} {no.get_text()}: zorluk rozeti beklenen yerde değil')
        sorular.append({
            'id': anchor(no.get_text(strip=True)),
            'no': no.get_text(strip=True),
            'baslik': ic(c.select_one('.q-title')),
            'etiketler': [{'sinif': [k for k in b['class'] if k != 'badge'], 'html': ic(b)} for b in rozetler[:-1]],
            'zorluk': ZORLUK[next(k for k in zor[0]['class'] if k in ZORLUK)],
            'metin': ic(c.select_one('.q-text')),
            'siklar': [{'etiket': ic(p.select_one('.part-label')), 'html': ic(p.select_one('.part-text'))}
                       for p in c.select('.q-parts > .q-part')],
            'cozumBaslik': ic(c.select_one('.sol-title')),
            'adimlar': [{'etiket': ic(s.select_one('.step-n')), 'html': ic(s.select_one('.step-text'))}
                        for s in c.select('.solution > .sol-step')],
        })
    stil = {k: (tek(v, k, kod) if v else '') for k, v in stil_k.items()}
    bas = soup.select_one('header.page-header')
    fs = soup.select_one('.formula-section')
    return {
        'kod': kod, 'sayfa': f'{kod}.html', **ana,
        'sayfaBaslik': soup.title.get_text(strip=True),
        'ust': {
            'sinif': ' '.join(bas['class']),
            'etiketSinif': ' '.join(bas.select_one('.topic-tag')['class']),
            'baslikHtml': ic(bas.h1),
            'altBaslik': ic(bas.select_one('.subtitle')),
            'meta': [m.get_text(strip=True) for m in bas.select('.meta-item')],
        },
        'bolumBaslikSinif': ' '.join(soup.select_one('main > .section-heading')['class']),
        'stil': stil,
        'sorular': sorular,
        'formul': {
            'baslikSinif': ' '.join(fs.select_one('.section-heading')['class']),
            'baslik': ic(fs.select_one('.section-heading')),
            'kartlar': [{'baslik': ic(f.select_one('.f-title')), 'govde': ic(f.select_one('.f-body'))}
                        for f in fs.select('.f-card')],
        },
    }, kartlar, fs.select('.f-card')


def anasayfa_cikar(ref):
    soup = BeautifulSoup(kaynak(ref, 'index.html'), 'html.parser')
    ana, sira, bolum = {}, 0, None
    for el in soup.select('.exam-divider-label, a.home-card'):
        if 'exam-divider-label' in el['class']:
            bolum = 'oncesi' if 'edl-oncesi' in el['class'] else 'sonrasi'
            continue
        sira += 1
        ana[el['href'].replace('.html', '')] = {
            'ad': el.select_one('.hc-title').get_text(strip=True), 'sira': sira, 'bolum': bolum,
            'ikon': el.select_one('.hc-icon').get_text(strip=True),
            'aciklama': ic(el.select_one('.hc-desc')),
            'kartSinif': ' '.join(el['class']),
        }
    return ana


# ── JSON -> HTML (sitenin ileride JS ile yapacağının aynısı) ──
def kart_html(s, st):
    rozet = ''.join(f'<span class="badge {" ".join(e["sinif"])}">{e["html"]}</span>' for e in s['etiketler'])
    rozet += f'<span class="badge {ZORLUK_SINIF[s["zorluk"]]}">{s["zorluk"]}</span>'
    sik = ''.join(f'<div class="q-part"><span class="{st["parca"]}">{p["etiket"]}</span>'
                  f'<span class="part-text">{p["html"]}</span></div>' for p in s['siklar'])
    adim = ''.join(f'<div class="sol-step"><span class="{st["adim"]}">{a["etiket"]}</span>'
                   f'<div class="step-text">{a["html"]}</div></div>' for a in s['adimlar'])
    return (f'<div class="{st["kart"]}"><div class="q-header" onclick="toggleCard(this)">'
            f'<span class="{st["no"]}">{s["no"]}</span><div class="q-title-wrap"><div class="q-title">{s["baslik"]}</div>'
            f'<div class="q-badges">{rozet}</div></div><span class="q-toggle">▾</span></div>'
            f'<div class="q-body"><div class="q-text">{s["metin"]}</div>'
            + (f'<div class="q-parts">{sik}</div>' if s['siklar'] else '')
            + f'<button class="{st["buton"]}" onclick="toggleSolution(this)">{st["butonMetin"]}</button>'
            f'<div class="{st["cozum"]}"><div class="{st["cozumBaslik"]}">{s["cozumBaslik"]}</div>{adim}</div></div></div>')


def kanonik(el):
    """Karşılaştırma için: boşluk farklarını yok sayan ağaç gösterimi."""
    if isinstance(el, Comment):
        return ('#yorum', ' '.join(el.split()))
    if isinstance(el, NavigableString):
        t = ' '.join(el.split())
        return t or None
    at = tuple(sorted((k, ' '.join(sorted(v)) if isinstance(v, list) else v) for k, v in el.attrs.items()))
    cocuk = [k for k in (kanonik(c) for c in el.children) if k is not None]
    return (el.name, at, tuple(cocuk))


def ayni_mi(orijinal_el, html):
    yeni = BeautifulSoup(html, 'html.parser').find()
    return kanonik(orijinal_el) == kanonik(yeni)


def farklar(eski, yeni, yol=''):
    if not isinstance(eski, (dict, list)) or type(eski) != type(yeni):
        return [] if eski == yeni else [{'yol': yol, 'eski': eski, 'yeni': yeni}]
    if isinstance(eski, dict):
        return [f for k in eski for f in farklar(eski[k], yeni[k], f'{yol}.{k}' if yol else k)]
    if len(eski) != len(yeni):
        return [{'yol': yol, 'eski': eski, 'yeni': yeni}]
    return [f for i, (a, b) in enumerate(zip(eski, yeni)) for f in farklar(a, b, f'{yol}[{i}]')]


def uygula(soru, degisiklikler):
    s = copy.deepcopy(soru)
    for d in degisiklikler:
        parcalar = re.findall(r'[^.\[\]]+|\[\d+\]', d['yol'])
        hedef = s
        for p in parcalar[:-1]:
            hedef = hedef[int(p[1:-1])] if p.startswith('[') else hedef[p]
        son = parcalar[-1]
        anahtar = int(son[1:-1]) if son.startswith('[') else son
        assert hedef[anahtar] == d['eski'], f'çakışma: {d["yol"]}'
        hedef[anahtar] = d['yeni']
    return s


def main():
    rapor = []
    ana = anasayfa_cikar(ORIJINAL)
    konular, sorun = [], 0
    for kod in KONULAR:
        k, kartlar, fkartlar = konu_cikar(ORIJINAL, kod, ana[kod])
        ok = sum(ayni_mi(el, kart_html(s, k['stil'])) for el, s in zip(kartlar, k['sorular']))
        fok = sum(ayni_mi(el, f'<div class="f-card"><div class="f-title">{f["baslik"]}</div><div class="f-body">{f["govde"]}</div></div>')
                  for el, f in zip(fkartlar, k['formul']['kartlar']))
        sorun += (len(kartlar) - ok) + (len(fkartlar) - fok)
        rapor.append(f'{kod:7} {k["ad"]:28} soru {len(k["sorular"]):2} (birebir: {ok:2})  formül kartı {len(fkartlar)} (birebir: {fok})')
        konular.append(k)
    if sorun:
        print('\n'.join(rapor)); sys.exit(f'HATA: {sorun} kart JSON\'dan birebir üretilemedi')
    toplam_s = sum(len(k['sorular']) for k in konular); toplam_f = sum(len(k['formul']['kartlar']) for k in konular)
    rapor.append(f'TOPLAM: {toplam_s} soru, {toplam_f} formül kartı — hepsi JSON\'dan birebir yeniden üretildi ✓')

    # Düzeltme önerileri: orijinal ↔ doğrulanmış dal
    oneriler = []
    for k in konular:
        duz, _, _ = konu_cikar(DUZELTILMIS, k['kod'], ana[k['kod']])
        yeni_sorular = {s['id']: s for s in duz['sorular']}
        for s in k['sorular']:
            fark = farklar(s, yeni_sorular[s['id']])
            if not fark:
                continue
            if s['id'] not in GEREKCE:
                sys.exit(f'HATA: {s["id"]} için gerekçe yazılmamış')
            assert uygula(s, fark) == yeni_sorular[s['id']]
            oneriler.append({
                'id': f'oneri-{s["id"]}', 'konu': k['kod'], 'soruId': s['id'], 'soruBaslik': s['baslik'],
                'gerekce': GEREKCE[s['id']], 'kararDegisiyor': s['id'] in KARAR_DEGISIYOR,
                'kaynak': 'Python ile yeniden hesaplama (6 Ekim 2026)', 'durum': 'bekliyor',
                'degisiklikler': fark,
            })
    fazla = set(GEREKCE) - {o['soruId'] for o in oneriler}
    if fazla:
        sys.exit(f'HATA: gerekçesi olup farkı bulunmayan sorular: {fazla}')
    rapor.append(f'DÜZELTME ÖNERİSİ: {len(oneriler)} — her biri orijinale uygulanınca doğrulanmış hali birebir veriyor ✓')
    for o in oneriler:
        rapor.append(f'  {o["soruId"]:7} {len(o["degisiklikler"]):2} alan' + ('  [KARAR DEĞİŞİYOR]' if o['kararDegisiyor'] else ''))

    json.dump({'surum': 1, 'kaynak': f'git:{ORIJINAL}', 'konular': konular},
              open('veri/konular.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump({'surum': 1, 'oneriler': oneriler}, open('veri/oneriler.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    open('veri/rapor.txt', 'w', encoding='utf-8').write('\n'.join(rapor) + '\n')
    print('\n'.join(rapor))


if __name__ == '__main__':
    main()
