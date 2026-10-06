"""
END214 – CSS/JS dosyalarına sürüm ekleme (tarayıcı önbelleği için)

Tarayıcılar style.css, ortak.js gibi dosyaları önbellekte tutar; dosya değişse bile eski hali
kullanılmaya devam edebilir. Bu script her dosyanın içeriğinden kısa bir özet üretir ve
sayfalardaki bağlantılara ekler:  style.css  →  style.css?v=3f9a1c2e
Dosya değişince özet de değişir, tarayıcı yeni dosyayı indirmek zorunda kalır.

CSS veya JS dosyalarından biri her değiştiğinde, commit'ten önce çalıştırın (depo kök klasöründen):
    python3 araclar/surum.py
"""
import glob, hashlib, re


def ozet(dosya):
    return hashlib.sha256(open(dosya, 'rb').read()).hexdigest()[:8]


def yaz(dosya, desen, yeni):
    s = open(dosya, encoding='utf-8').read()
    t = re.sub(desen, yeni, s)
    if t != s:
        open(dosya, 'w', encoding='utf-8').write(t)
        print('güncellendi:', dosya)


# 1) veri-katmani.js, ortak.js ve admin.html içinden import ediliyor
vk = ozet('veri-katmani.js')
for d in ['ortak.js', 'admin.html']:
    yaz(d, r"'\./veri-katmani\.js(\?v=[0-9a-f]+)?'", f"'./veri-katmani.js?v={vk}'")

# 2) sayfalardaki <link>/<script> bağlantıları (ortak.js'in özeti 1. adımdan SONRA alınır)
surum = {d: ozet(d) for d in ['style.css', 'ortak.js', 'firebase-ayar.js']}
for sayfa in sorted(glob.glob('*.html')):
    for d, v in surum.items():
        yaz(sayfa, r'(src|href)="' + re.escape(d) + r'(\?v=[0-9a-f]+)?"', rf'\1="{d}?v={v}"')
