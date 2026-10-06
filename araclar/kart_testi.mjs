// END214 – ortak.js testi
// ortak.js'in veri/konular.json'dan ürettiği her kartı, araclar/veri_cikar.py içindeki kart_html()
// çıktısıyla BAYT BAYT karşılaştırır. veri_cikar.py de kart_html() çıktısının orijinal sayfalardaki
// kartlarla aynı olduğunu doğruluyor; ikisi birlikte JS çıktısının orijinal kartlarla aynı olduğunu gösterir.
//
// Kullanım (depo kök klasöründen; beautifulsoup4 kurulu bir Python gerekir):
//     PYTHON=../.venv/bin/python node araclar/kart_testi.mjs
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const ortak = {};
vm.runInNewContext(readFileSync('ortak.js', 'utf8'), ortak);
const { konular } = JSON.parse(readFileSync('veri/konular.json', 'utf8'));

const py = `
import json, sys
sys.path.insert(0, 'araclar')
from veri_cikar import kart_html
k = json.load(open('veri/konular.json', encoding='utf-8'))['konular']
print(json.dumps({x['kod']: {
    'sorular': [kart_html(s, x['stil']) for s in x['sorular']],
    'formul': [f'<div class="f-card"><div class="f-title">{f["baslik"]}</div><div class="f-body">{f["govde"]}</div></div>'
               for f in x['formul']['kartlar']],
} for x in k}))`;
const ref = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', py], { encoding: 'utf8', maxBuffer: 1 << 26 }));

let hata = 0, toplamS = 0, toplamF = 0;
for (const k of konular) {
  let okS = 0, okF = 0;
  k.sorular.forEach((s, i) => {
    const js = ortak.kartHtml(s, k.stil);
    if (js === ref[k.kod].sorular[i]) return okS++;
    hata++;
    const j = [...js].findIndex((c, n) => c !== ref[k.kod].sorular[i][n]);
    console.log(`FARK ${s.id} (${j}. karakter):\n  js: …${js.slice(Math.max(0, j - 40), j + 40)}\n  py: …${ref[k.kod].sorular[i].slice(Math.max(0, j - 40), j + 40)}`);
  });
  k.formul.kartlar.forEach((f, i) => {
    if (ortak.formulKartHtml(f) === ref[k.kod].formul[i]) return okF++;
    hata++; console.log(`FARK ${k.kod} formül kartı ${i + 1}`);
  });
  toplamS += k.sorular.length; toplamF += k.formul.kartlar.length;
  console.log(`${k.kod.padEnd(7)} soru ${String(k.sorular.length).padStart(2)} (birebir: ${String(okS).padStart(2)})  formül kartı ${k.formul.kartlar.length} (birebir: ${okF})`);
}
console.log(hata ? `HATA: ${hata} kart farklı` : `TOPLAM: ${toplamS} soru, ${toplamF} formül kartı — ortak.js çıktısı Python ile bayt bayt aynı ✓`);
process.exit(hata ? 1 : 0);
