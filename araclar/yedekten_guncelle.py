"""
END214 – Sayfalardaki statik yedeği veritabanından güncelleme aracı

Neden?
  Konu sayfaları (ga.html vb.) içlerinde soruların ve formül kartlarının bir kopyasını taşır.
  Veritabanına ulaşılamazsa öğrenci bu kopyayı görür. Hoca yönetim panelinden soru düzenledikçe
  bu kopya eskir; bu araç kopyayı veritabanındaki hale getirir.

Ne yapar?
  1. Yönetim panelindeki "Yedeği indir" ile alınan dosyayı (ya da veri/konular.json) okur.
     Yalnızca "konular" kısmı kullanılır; hata bildirimleri, duyurular vb. sayfalara yazılmaz.
  2. Her konu sayfasında kartları tek tek karşılaştırır. Veritabanıyla aynı olan kart ve önündeki
     yorum (<!-- GA-04 -->, iç notlar) harfi harfine olduğu gibi kalır; yalnızca değişen ya da yeni
     kartlar kart_html() ile (sitenin JS'iyle birebir aynı) yeniden yazılır. Silinen kartlar çıkar.
  3. Ana sayfadaki sabit sayıları (konu kartlarındaki "18 SORU · 6 FORMÜL KARTI", toplamlar) ve
     Ders Bilgileri sayfasındaki konu listesinin soru sayılarını ("18 soru") günceller.
  4. Yazdıktan sonra her sayfayı yeniden okuyup bütün kartların veritabanıyla aynı olduğunu doğrular.

Kullanım (depo kök klasöründen; .venv içinde beautifulsoup4 kurulu):
    python3 araclar/yedekten_guncelle.py ~/Downloads/END214-yedek-2026-10-07.json          # yalnızca rapor
    python3 araclar/yedekten_guncelle.py ~/Downloads/END214-yedek-2026-10-07.json --yaz    # sayfaları güncelle
Yedek dosyasını depoya KOYMAYIN (hata bildirimlerinde öğrenci e-postaları var).
"""
import json, re, sys
from bs4 import BeautifulSoup, Comment

sys.path.insert(0, __file__.rsplit('/', 1)[0])
from veri_cikar import kart_html, kanonik, anchor  # noqa: E402

TOKEN = re.compile(r'<!--.*?-->|<div\b[^>]*>|</div\s*>', re.S)
TEHLIKELI = re.compile(r'<\s*(script|iframe|object|embed)\b|\son\w+\s*=|javascript:', re.I)


def formul_html(f):
    return f'<div class="f-card"><div class="f-title">{f["baslik"]}</div><div class="f-body">{f["govde"]}</div></div>'


def izgara(html, acilis):
    """acilis etiketiyle başlayan div'in içi: (iç başlangıç, iç bitiş, [(parça başı, kart başı, kart sonu)]).
    Parça = önceki karttan sonra gelen boşluk ve yorumlar + kart."""
    if html.count(acilis) != 1:
        sys.exit(f'HATA: sayfada "{acilis}" tam bir kez bulunmalı')
    bas = html.index(acilis) + len(acilis)
    derinlik, cocuklar, parca_bas, kart_bas = 0, [], bas, None
    for m in TOKEN.finditer(html, bas):
        t = m.group()
        if t.startswith('<!--'):
            continue
        if t.startswith('</'):
            if derinlik == 0:
                return bas, m.start(), cocuklar
            derinlik -= 1
            if derinlik == 0:
                cocuklar.append((parca_bas, kart_bas, m.end()))
                parca_bas = m.end()
        else:
            if derinlik == 0:
                kart_bas = m.start()
            derinlik += 1
    sys.exit(f'HATA: "{acilis}" kapanmıyor')


def yorumsuz(html):
    el = BeautifulSoup(html, 'html.parser').find()
    for c in el.find_all(string=lambda t: isinstance(t, Comment)):
        c.extract()
    return kanonik(el)


def esit(kart_kaynak, uretilen):
    """Statik kart, veriden üretilen kartla aynı mı? (boşluklar ve yorumlar yok sayılır: iç notlar,
    SVG çizimlerindeki açıklamalar)"""
    return yorumsuz(kart_kaynak) == yorumsuz(uretilen)


def girinti(html, konum):
    satir_basi = html.rfind('\n', 0, konum) + 1
    return re.match(r'[ \t]*', html[satir_basi:]).group()


def denetle(konu):
    for s in konu['sorular']:
        alanlar = [s['baslik'], s['metin'], s['cozumBaslik']] + [e['html'] for e in s['etiketler']] + \
                  [p['etiket'] for p in s['siklar']] + [p['html'] for p in s['siklar']] + \
                  [a['etiket'] for a in s['adimlar']] + [a['html'] for a in s['adimlar']]
        if any(TEHLIKELI.search(a) for a in alanlar):
            sys.exit(f'HATA {s["id"]}: içerikte çalıştırılabilir kod var (script / on…= / javascript:). Sayfaya yazılmadı.')
    for f in konu['formul']['kartlar']:
        if TEHLIKELI.search(f['baslik']) or TEHLIKELI.search(f['govde']):
            sys.exit(f'HATA {konu["kod"]} formül kartı "{f["baslik"]}": içerikte çalıştırılabilir kod var. Sayfaya yazılmadı.')


def sorulari_guncelle(html, konu, rapor):
    bas, son, cocuklar = izgara(html, '<div class="questions-grid">')
    statik = {}
    for parca_bas, kart_bas, kart_son in cocuklar:
        no = BeautifulSoup(html[kart_bas:kart_son], 'html.parser').select_one('.q-num')
        statik[anchor(no.get_text(strip=True))] = (parca_bas, kart_bas, kart_son)
    ic = girinti(html, cocuklar[0][1]) if cocuklar else '    '
    parcalar, ayni, degisen, yeni = [], 0, [], []
    for s in konu['sorular']:
        uretilen = kart_html(s, konu['stil'])
        if s['id'] in statik and esit(html[statik[s['id']][1]:statik[s['id']][2]], uretilen):
            pb, _, ks = statik[s['id']]
            parcalar.append(html[pb:ks]); ayni += 1
        else:
            (degisen if s['id'] in statik else yeni).append(s['id'])
            parcalar.append(f'\n\n{ic}<!-- {s["id"]} -->\n{ic}{uretilen}')
    silinen = [i for i in statik if i not in {s['id'] for s in konu['sorular']}]
    eski_sira = [i for i in statik if i not in silinen]
    sira = [s['id'] for s in konu['sorular'] if s['id'] in statik] != eski_sira
    kuyruk = html[cocuklar[-1][2]:son] if cocuklar else f'\n\n{ic[:-2]}'
    rapor.append(f'  sorular: {ayni} aynı' + (f', değişen {", ".join(degisen)}' if degisen else '')
                 + (f', yeni {", ".join(yeni)}' if yeni else '') + (f', silinen {", ".join(silinen)}' if silinen else '')
                 + (', sıra değişti' if sira else ''))
    degisti = bool(degisen or yeni or silinen or sira)
    return (html[:bas] + ''.join(parcalar) + kuyruk + html[son:]) if degisti else html, degisti


def formulleri_guncelle(html, konu, rapor):
    bas, son, cocuklar = izgara(html, '<div class="formula-grid">')
    ic = girinti(html, cocuklar[0][1]) if cocuklar else '      '
    kullanilan, parcalar, ayni, uretilen_sayi = [], [], 0, 0  # kullanilan: eşleşen statik kartların sırası, veri sırasıyla
    for f in konu['formul']['kartlar']:
        uretilen = formul_html(f)
        eslesen = next((i for i, (_, kb, ks) in enumerate(cocuklar)
                        if i not in kullanilan and esit(html[kb:ks], uretilen)), None)
        if eslesen is None:
            parcalar.append(f'\n\n{ic}{uretilen}'); uretilen_sayi += 1
        else:
            kullanilan.append(eslesen); pb, _, ks = cocuklar[eslesen]
            parcalar.append(html[pb:ks]); ayni += 1
    silinen = len(cocuklar) - len(kullanilan)
    sira = kullanilan != sorted(kullanilan)
    kuyruk = html[cocuklar[-1][2]:son] if cocuklar else f'\n\n{ic[:-2]}'
    degisti = bool(uretilen_sayi or silinen or sira)
    rapor.append(f'  formül kartları: {ayni} aynı' + (f', yeni/değişen {uretilen_sayi}' if uretilen_sayi else '')
                 + (f', silinen {silinen}' if silinen else '') + (', sıra değişti' if sira else ''))
    return (html[:bas] + ''.join(parcalar) + kuyruk + html[son:]) if degisti else html, degisti


def dogrula(html, konu):
    soup = BeautifulSoup(html, 'html.parser')
    kartlar = soup.select('.questions-grid > .q-card')
    fkartlar = soup.select('.formula-grid > .f-card')
    if len(kartlar) != len(konu['sorular']) or len(fkartlar) != len(konu['formul']['kartlar']):
        return False
    return all(esit(str(el), kart_html(s, konu['stil'])) for el, s in zip(kartlar, konu['sorular'])) and \
        all(esit(str(el), formul_html(f)) for el, f in zip(fkartlar, konu['formul']['kartlar']))


def ana_sayfa(konular, yaz, rapor):
    html = open('index.html', encoding='utf-8').read()
    yeni = html
    for k in konular:
        desen = re.compile(r'(<a href="' + re.escape(k['sayfa']) + r'" class="home-card\b[^>]*>(?:(?!</a>).)*?<div class="hc-count">)[^<]*(</div>)', re.S)
        yeni = desen.sub(lambda m: f'{m.group(1)}{len(k["sorular"])} SORU · {len(k["formul"]["kartlar"])} FORMÜL KARTI{m.group(2)}', yeni, count=1)
    toplam = {'Toplam Soru': sum(len(k['sorular']) for k in konular), 'Konu Başlığı': len(konular),
              'Formül Kartı': sum(len(k['formul']['kartlar']) for k in konular)}
    for ad, n in toplam.items():
        yeni = re.sub(r'(<div class="stat-val[^"]*">)[^<]*(</div><div class="stat-label">' + ad + '</div>)',
                      lambda m: f'{m.group(1)}{n}{m.group(2)}', yeni, count=1)
    rapor.append('index.html: ' + ('sayılar güncellenecek' if yeni != html else 'sayılar aynı')
                 + f' ({toplam["Toplam Soru"]} soru, {toplam["Formül Kartı"]} formül kartı)')
    if yaz and yeni != html:
        open('index.html', 'w', encoding='utf-8').write(yeni)
    return yeni != html


def ders_sayfasi(konular, yaz, rapor):
    html = open('ders.html', encoding='utf-8').read()
    yeni = html
    for k in konular:
        desen = re.compile(r'(<a href="' + re.escape(k['sayfa']) + r'">[^<]*</a><span class="konu-sayi">)\d+ soru(</span>)')
        yeni = desen.sub(lambda m: f'{m.group(1)}{len(k["sorular"])} soru{m.group(2)}', yeni, count=1)
    rapor.append('ders.html: ' + ('soru sayıları güncellenecek' if yeni != html else 'soru sayıları aynı'))
    if yaz and yeni != html:
        open('ders.html', 'w', encoding='utf-8').write(yeni)
    return yeni != html


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    yaz = '--yaz' in sys.argv[2:]
    konular = json.load(open(sys.argv[1], encoding='utf-8'))['konular']
    rapor, degisen_sayfa, hata = [], 0, 0
    for k in sorted(konular, key=lambda x: x['sira']):
        denetle(k)
        html = open(k['sayfa'], encoding='utf-8').read()
        rapor.append(f'{k["sayfa"]}:')
        yeni, d1 = sorulari_guncelle(html, k, rapor)
        yeni, d2 = formulleri_guncelle(yeni, k, rapor)
        if not dogrula(yeni, k):
            rapor.append('  ✗ DOĞRULAMA BAŞARISIZ: sayfa veritabanıyla aynı olmadı, yazılmadı'); hata += 1
            continue
        if d1 or d2:
            degisen_sayfa += 1
            if yaz:
                open(k['sayfa'], 'w', encoding='utf-8').write(yeni)
        rapor.append('  ✓ ' + ('güncellendi, doğrulandı' if yaz and (d1 or d2) else 'güncellenecek' if d1 or d2 else 'zaten aynı'))
    if ana_sayfa(konular, yaz, rapor):
        degisen_sayfa += 1
    if ders_sayfasi(konular, yaz, rapor):
        degisen_sayfa += 1
    print('\n'.join(rapor))
    if hata:
        sys.exit(f'HATA: {hata} sayfa doğrulanamadı')
    if not degisen_sayfa:
        print('\nBütün sayfalar zaten veritabanıyla aynı.')
    elif not yaz:
        print(f'\n{degisen_sayfa} sayfa güncellenecek. Yazmak için komutu sonuna --yaz ekleyerek çalıştırın.')
    else:
        print(f'\n{degisen_sayfa} sayfa güncellendi. CSS/JS değişmediği için surum.py gerekmez; değişiklikleri git diff ile kontrol edip commit edin.')


if __name__ == '__main__':
    main()
