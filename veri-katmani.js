// END214 – veri katmanı
// Sitenin ve yönetim panelinin BÜTÜN veritabanı erişimi bu dosyadan geçer.
// İleride Firebase yerine başka bir veritabanına geçilirse yalnızca bu dosya yeniden yazılır;
// sayfalar ve panel aşağıdaki fonksiyonları aynı adlarla kullanmaya devam eder.
//
// Yükleme (sayfada, firebase-ayar.js'ten SONRA):
//     <script src="firebase-ayar.js"></script>
//     <script type="module"> import { konuGetir } from './veri-katmani.js'; … </script>
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
// Firestore'un "lite" sürümü: canlı bağlantı kanalı açmaz, her okuma tek bir istektir (daha küçük ve hızlı).
import {
  getFirestore, doc, getDoc, getDocs, addDoc, setDoc, deleteDoc, deleteField, collection, query, orderBy, limit,
  where, getCount, writeBatch, runTransaction, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore-lite.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
  createUserWithEmailAndPassword, updateProfile, reauthenticateWithCredential, EmailAuthProvider, deleteUser
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';

if (!window.FIREBASE_AYAR) throw new Error('firebase-ayar.js yüklenmemiş');
const uygulama = initializeApp(window.FIREBASE_AYAR);
const db = getFirestore(uygulama);
const auth = getAuth(uygulama);
auth.languageCode = 'tr';  // şifre sıfırlama e-postaları Türkçe gelsin

// ── Okuma ──

/** Bir konunun bütün verisi (sorular, formül kartları, başlık bilgileri). Yoksa null. */
export async function konuGetir(kod) {
  const b = await getDoc(doc(db, 'konular', kod));
  return b.exists() ? b.data() : null;
}

/** Bütün konular, ana sayfadaki sırasıyla (sayaçlar, arama, ders bilgileri için).
 *  Kotayı korumak için tarayıcıda 15 dakika saklanır; konu sayfaları (konuGetir) her zaman güncel okur. */
const KONU_ONBELLEK = 'end214-konular', KONU_SURE = 15 * 60 * 1000;
export async function tumKonular() {
  try {
    const o = JSON.parse(localStorage.getItem(KONU_ONBELLEK));
    if (o && Date.now() - o.zaman < KONU_SURE) return o.konular;
  } catch (e) { /* önbellek yok ya da bozuk */ }
  const s = await getDocs(collection(db, 'konular'));
  const konular = s.docs.map(b => { const d = b.data(); delete d.guncellendi; return d; }).sort((x, y) => x.sira - y.sira);
  try { localStorage.setItem(KONU_ONBELLEK, JSON.stringify({ zaman: Date.now(), konular })); } catch (e) { /* yer yok */ }
  return konular;
}
// Yönetici bir konuyu değiştirince bu tarayıcıdaki saklanan kopya silinir (diğer ziyaretçilerde en geç 15 dakikada yenilenir)
function konuOnbelleginiTemizle() { try { localStorage.removeItem(KONU_ONBELLEK); } catch (e) { /* önemli değil */ } }

/** Bütün konular, tarayıcıda saklanan kopyaya bakmadan (yönetim paneli için). */
export async function tumKonularTaze() {
  konuOnbelleginiTemizle();
  return tumKonular();
}

// Firestore zaman damgası → JS tarihi (sayfalar veritabanının tarih biçimini bilmek zorunda kalmasın)
const tarihe = t => t && typeof t.toDate === 'function' ? t.toDate() : (t ? new Date(t) : null);

/** Duyurular, en yeni önce. Her duyuru: { id, tarih (Date), baslik, metin, link?, linkYazi? }. adet verilmezse hepsi. */
export async function duyurular(adet) {
  const q = adet ? query(collection(db, 'duyurular'), orderBy('tarih', 'desc'), limit(adet))
                 : query(collection(db, 'duyurular'), orderBy('tarih', 'desc'));
  return (await getDocs(q)).docs.map(b => ({ id: b.id, ...b.data(), tarih: tarihe(b.data().tarih) }));
}

/** Site ayarları: { donem, kurum, driveLink }. Yoksa boş nesne.
 *  Her sayfada (footer) okunduğu için konular gibi tarayıcıda 15 dakika saklanır. */
const AYAR_ONBELLEK = 'end214-ayarlar';
export async function siteAyarlari() {
  try {
    const o = JSON.parse(localStorage.getItem(AYAR_ONBELLEK));
    if (o && Date.now() - o.zaman < KONU_SURE) return o.ayar;
  } catch (e) { /* önbellek yok ya da bozuk */ }
  const b = await getDoc(doc(db, 'site', 'ayarlar'));
  const ayar = b.exists() ? b.data() : {};
  delete ayar.guncellendi;
  try { localStorage.setItem(AYAR_ONBELLEK, JSON.stringify({ zaman: Date.now(), ayar })); } catch (e) { /* yer yok */ }
  return ayar;
}

/** Site ayarları, tarayıcıda saklanan kopyaya bakmadan (yönetim paneli için). */
export async function siteAyarlariTaze() {
  try { localStorage.removeItem(AYAR_ONBELLEK); } catch (e) { /* önemli değil */ }
  return siteAyarlari();
}

/** Ders bilgileri: { tanim, dersSaatleri, derslik, degerlendirme[{ad, yuzde}], sinavlar[{ad, tarih 'YYYY-AA-GG', saat, yer}],
 *  kaynaklar[metin], iletisim{eposta, ofis, ofisSaatleri} }. Hepsi isteğe bağlı; yoksa boş nesne. */
export async function dersBilgileri() {
  const b = await getDoc(doc(db, 'site', 'ders'));
  return b.exists() ? b.data() : {};
}

// ── Öğrenci hata bildirimi (herkes gönderebilir, yalnızca yönetici okur; sınırlar firestore.rules ile aynı) ──

/** { soruId (≤20, boş olabilir), sayfa (≤40), mesaj (1–2000), eposta? (≤100) } → hataBildirimleri koleksiyonuna eklenir. */
export async function hataBildir({ soruId = '', sayfa, mesaj, eposta }) {
  const veri = { soruId: String(soruId).slice(0, 20), sayfa: String(sayfa).slice(0, 40), mesaj: String(mesaj).trim(),
                 tarih: serverTimestamp(), durum: 'yeni' };
  if (!veri.mesaj || veri.mesaj.length > 2000) throw new Error('mesaj-uzunlugu');
  if (eposta && eposta.trim()) veri.eposta = eposta.trim().slice(0, 100);
  await auth.authStateReady();
  const k = auth.currentUser;  // giriş yapmış öğrencinin adı ve kimliği (kural: uid kendi kimliği olmalı)
  if (k) { veri.uid = k.uid; if (k.displayName) veri.ad = k.displayName.slice(0, 80); }
  await addDoc(collection(db, 'hataBildirimleri'), veri);
}

// ── Giriş ──

/** Giriş durumu her değiştiğinde fn(kullanici | null) çağrılır. Kullanıcı: { uid, eposta, ad }. */
export function girisDurumu(fn) {
  return onAuthStateChanged(auth, k => fn(k ? { uid: k.uid, eposta: k.email, ad: k.displayName || '' } : null));
}

export async function girisYap(eposta, sifre) {
  await signInWithEmailAndPassword(auth, eposta, sifre);
}

export async function cikisYap() {
  await signOut(auth);
}

export async function sifreSifirla(eposta) {
  await sendPasswordResetEmail(auth, eposta);
}

/** Giriş yapmış kullanıcı yönetici mi? (yoneticiler/{uid} belgesi konsoldan elle eklenir) */
export async function yoneticiMi() {
  const k = auth.currentUser;
  if (!k) return false;
  return (await getDoc(doc(db, 'yoneticiler', k.uid))).exists();
}

// ── Öğrenci hesabı ve ilerleme (ogrenciler/{uid}: yalnızca öğrencinin kendisi okur ve yazar) ──

/** Yeni öğrenci hesabı: { ad, eposta, sifre }. Ad, hesap profiline ve öğrenci belgesine yazılır. */
export async function kayitOl({ ad, eposta, sifre }) {
  ad = String(ad).trim().slice(0, 80);
  const { user } = await createUserWithEmailAndPassword(auth, eposta, sifre);
  await updateProfile(user, { displayName: ad });
  await setDoc(doc(db, 'ogrenciler', user.uid), { ad, cozulen: {}, olusturuldu: serverTimestamp() });
}

/** Giriş yapmış öğrencinin çözdüğü soruların kimlikleri: { 'GA-04': true, … }. Giriş yoksa boş. */
export async function cozulenler() {
  await auth.authStateReady();  // sayfa açılırken oturum henüz geri yüklenmemiş olabilir
  const k = auth.currentUser;
  if (!k) return {};
  const b = await getDoc(doc(db, 'ogrenciler', k.uid));
  return (b.exists() && b.data().cozulen) || {};
}

/** Bir soruyu "çözdüm" olarak işaretler ya da işareti kaldırır. */
export async function cozulduIsaretle(soruId, cozuldu) {
  await auth.authStateReady();
  const k = auth.currentUser;
  if (!k) throw Object.assign(new Error('giriş yok'), { code: 'giris-gerekli' });
  await setDoc(doc(db, 'ogrenciler', k.uid),
    { cozulen: { [soruId]: cozuldu ? true : deleteField() }, guncellendi: serverTimestamp() }, { merge: true });
}

/** Hesabı ve bütün öğrenci verisini kalıcı olarak siler. Güvenlik için şifre yeniden sorulur. */
export async function hesabiSil(sifre) {
  const k = auth.currentUser;
  if (!k) return;
  await reauthenticateWithCredential(k, EmailAuthProvider.credential(k.email, sifre));
  await deleteDoc(doc(db, 'ogrenciler', k.uid));
  await deleteUser(k);
}

/** Giriş hata kodunu kullanıcıya gösterilecek Türkçe cümleye çevirir. */
export function hataMetni(e) {
  const kod = e && e.code || '';
  if (kod === 'gecersiz') return e.message;  // form denetimi (aşağıda): mesaj zaten Türkçe
  if (/email-already-in-use/.test(kod)) return 'Bu e-posta adresiyle zaten bir hesap var. Giriş yapmayı deneyin.';
  if (/weak-password/.test(kod)) return 'Şifre en az 6 karakter olmalı.';
  if (/invalid-email/.test(kod)) return 'E-posta adresi geçerli görünmüyor.';
  if (/missing-password/.test(kod)) return 'Lütfen şifrenizi yazın.';
  if (/invalid-credential|wrong-password|user-not-found/.test(kod)) return 'E-posta veya şifre hatalı.';
  if (/requires-recent-login/.test(kod)) return 'Güvenlik için çıkış yapıp yeniden giriş yapın, sonra tekrar deneyin.';
  if (/too-many-requests/.test(kod)) return 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin.';
  if (/network-request-failed|unavailable/.test(kod)) return 'İnternet bağlantısı kurulamadı.';
  if (/permission-denied/.test(kod)) return 'Bu işlem için yetkiniz yok.';
  return 'Beklenmeyen bir hata oluştu' + (kod ? ' (' + kod + ')' : '') + '.';
}

// ── Yönetim paneli (yalnızca yönetici; kurallar başkasına izin vermez) ──

/** Onay bekleyen öneri ve yeni hata bildirimi sayısı (sayma sorgusu: belgeleri tek tek okumaz). */
export async function bekleyenSayilari() {
  const [o, b] = await Promise.all([
    getCount(query(collection(db, 'oneriler'), where('durum', '==', 'bekliyor'))),
    getCount(query(collection(db, 'hataBildirimleri'), where('durum', '==', 'yeni'))),
  ]);
  return { oneri: o.data().count, bildirim: b.data().count };
}

// ── Düzeltme önerileri ──
// Öneri: { id, konu, soruId, soruBaslik, gerekce, kararDegisiyor, kaynak, durum ('bekliyor' | 'onaylandi' | 'reddedildi'),
//          degisiklikler: [{ yol: 'adimlar[2].html', eski, yeni }], uygulanan?, duzenlendi?, kararTarihi? }

// "adimlar[2].html" → ['adimlar', 2, 'html']
const yolParcalari = yol => (yol.match(/[^.[\]]+|\[\d+\]/g) || []).map(p => p[0] === '[' ? +p.slice(1, -1) : p);
const ayniDeger = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Sorudaki bir alanın değeri (yol bulunmazsa undefined). */
export function yolOku(nesne, yol) {
  return yolParcalari(yol).reduce((h, p) => (h == null ? undefined : h[p]), nesne);
}

/** Değişiklikleri sorunun bir kopyasına uygular (asıl soru değişmez). */
export function degisiklikleriUygula(soru, degisiklikler, alan = 'yeni') {
  const kopya = JSON.parse(JSON.stringify(soru));
  for (const d of degisiklikler) {
    const p = yolParcalari(d.yol), son = p.pop();
    const hedef = p.reduce((h, x) => (h == null ? undefined : h[x]), kopya);
    if (hedef == null || !(son in hedef)) throw Object.assign(new Error('yol yok: ' + d.yol), { code: 'yol-yok' });
    hedef[son] = d[alan];
  }
  return kopya;
}

/** Sorunun şu anki halinde, önerinin beklediği "eski" değerden farklı olan alanlar (çakışma). */
export function cakismalar(soru, degisiklikler, alan = 'eski') {
  return degisiklikler.filter(d => !ayniDeger(yolOku(soru, d.yol), d[alan])).map(d => d.yol);
}

/** Bütün öneriler. */
export async function oneriler() {
  const s = await getDocs(collection(db, 'oneriler'));
  return s.docs.map(b => ({ ...b.data(), id: b.id, kararTarihi: tarihe(b.data().kararTarihi) }));
}

const kararHatasi = (code, mesaj) => Object.assign(new Error(mesaj), { code });

// Soruyu ve öneriyi tek işlemde (transaction) günceller: ya ikisi birden değişir ya hiçbiri.
async function oneriIslemi(oneri, fn) {
  await runTransaction(db, async tx => {
    const kRef = doc(db, 'konular', oneri.konu), oRef = doc(db, 'oneriler', oneri.id);
    const [k, o] = [await tx.get(kRef), await tx.get(oRef)];
    if (!k.exists() || !o.exists()) throw kararHatasi('bulunamadi', 'Konu ya da öneri bulunamadı.');
    const sorular = k.data().sorular, i = sorular.findIndex(x => x.id === oneri.soruId);
    if (i < 0) throw kararHatasi('bulunamadi', 'Soru bulunamadı (silinmiş olabilir).');
    const sonuc = fn(sorular[i], o.data());
    if (sonuc.soru) {
      sorular[i] = sonuc.soru;
      tx.update(kRef, { sorular, guncellendi: serverTimestamp() });
    }
    tx.update(oRef, { ...sonuc.oneri, kararTarihi: serverTimestamp() });
  });
  konuOnbelleginiTemizle();
}

/** Öneriyi onaylar ve soruya uygular. degisiklikler: yöneticinin son hali (düzenlediyse "yeni" değerleri farklıdır). */
export async function oneriyiOnayla(oneri, degisiklikler = oneri.degisiklikler) {
  await oneriIslemi(oneri, (soru, o) => {
    if (o.durum !== 'bekliyor') throw kararHatasi('zaten-karar', 'Bu öneri için zaten karar verilmiş.');
    if (cakismalar(soru, o.degisiklikler).length) throw kararHatasi('cakisma', 'Soru, öneri hazırlandıktan sonra değiştirilmiş.');
    return {
      soru: degisiklikleriUygula(soru, degisiklikler),
      oneri: { durum: 'onaylandi', uygulanan: degisiklikler, duzenlendi: !ayniDeger(degisiklikler, o.degisiklikler) },
    };
  });
}

/** Öneriyi reddeder; soru olduğu gibi kalır. */
export async function oneriyiReddet(oneri) {
  await oneriIslemi(oneri, (soru, o) => {
    if (o.durum !== 'bekliyor') throw kararHatasi('zaten-karar', 'Bu öneri için zaten karar verilmiş.');
    return { oneri: { durum: 'reddedildi' } };
  });
}

/** Kararı geri alır: öneri tekrar beklemeye döner; onaylanmışsa soru da eski haline döner. */
export async function oneriKarariniGeriAl(oneri) {
  await oneriIslemi(oneri, (soru, o) => {
    if (o.durum === 'reddedildi') return { oneri: { durum: 'bekliyor', uygulanan: deleteField(), duzenlendi: deleteField() } };
    if (o.durum !== 'onaylandi') throw kararHatasi('zaten-karar', 'Bu öneri zaten beklemede.');
    if (cakismalar(soru, o.uygulanan, 'yeni').length) throw kararHatasi('cakisma', 'Soru, onaydan sonra yeniden değiştirilmiş; geri alınamaz.');
    return {
      soru: degisiklikleriUygula(soru, o.uygulanan, 'eski'),
      oneri: { durum: 'bekliyor', uygulanan: deleteField(), duzenlendi: deleteField() },
    };
  });
}

// ── Hata bildirimleri (yalnızca yönetici okur, günceller, siler) ──

/** Bütün bildirimler, en yeni önce: { id, soruId, sayfa, mesaj, eposta?, ad?, uid?, tarih (Date), durum ('yeni' | 'cozuldu') }. */
export async function hataBildirimleri() {
  const s = await getDocs(query(collection(db, 'hataBildirimleri'), orderBy('tarih', 'desc')));
  return s.docs.map(b => ({ ...b.data(), id: b.id, tarih: tarihe(b.data().tarih) }))
    .sort((a, b) => (b.tarih || 0) - (a.tarih || 0));
}

/** Bildirimi "çözüldü" ya da yeniden "yeni" yapar. */
export async function bildirimDurumu(id, durum) {
  if (!['yeni', 'cozuldu'].includes(durum)) throw new Error('geçersiz durum');
  await updateDoc(doc(db, 'hataBildirimleri', id), { durum });
}

/** Bildirimi kalıcı olarak siler. */
export async function bildirimSil(id) {
  await deleteDoc(doc(db, 'hataBildirimleri', id));
}

// ── Duyurular, ders bilgileri, site ayarları (yalnızca yönetici yazar) ──
// Metinler düz yazı olarak saklanır (sitede textContent ile basılır); bağlantılar yalnızca http(s)/mailto.

const gecersiz = mesaj => Object.assign(new Error(mesaj), { code: 'gecersiz' });
const yazi = (x, en) => String(x == null ? '' : x).trim().slice(0, en);
const GUN = /^\d{4}-\d{2}-\d{2}$/;
const EPOSTA = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function duyuruVerisi(d) {
  const veri = { tarih: d.tarih, baslik: yazi(d.baslik, 200), metin: yazi(d.metin, 5000),
                 link: yazi(d.link, 500), linkYazi: yazi(d.linkYazi, 100) };
  if (!(veri.tarih instanceof Date) || isNaN(veri.tarih)) throw gecersiz('Tarih geçerli değil.');
  if (!veri.baslik) throw gecersiz('Başlık boş olamaz.');
  if (veri.link && !/^(https?:|mailto:)/i.test(veri.link)) throw gecersiz('Bağlantı https:// (ya da mailto:) ile başlamalı.');
  if (!veri.link) veri.linkYazi = '';
  return veri;
}

/** Yeni duyuru: { tarih (Date), baslik, metin, link?, linkYazi? }. Yeni duyurunun kimliğini döndürür. */
export async function duyuruEkle(d) {
  const r = await addDoc(collection(db, 'duyurular'), { ...duyuruVerisi(d), olusturuldu: serverTimestamp() });
  return r.id;
}

/** Duyuruyu günceller (alanlar duyuruEkle ile aynı). */
export async function duyuruGuncelle(id, d) {
  await updateDoc(doc(db, 'duyurular', id), { ...duyuruVerisi(d), guncellendi: serverTimestamp() });
}

/** Duyuruyu kalıcı olarak siler. */
export async function duyuruSil(id) {
  await deleteDoc(doc(db, 'duyurular', id));
}

/** Site ayarlarını kaydeder: { donem, kurum, driveLink }. Boş alan sitede sayfadaki sabit yazının kalması demektir. */
export async function siteAyarlariniKaydet(a) {
  const ayar = { donem: yazi(a.donem, 60), kurum: yazi(a.kurum, 200), driveLink: yazi(a.driveLink, 500) };
  if (ayar.driveLink && !/^https?:\/\//i.test(ayar.driveLink)) throw gecersiz('Drive linki https:// ile başlamalı.');
  await setDoc(doc(db, 'site', 'ayarlar'), { ...ayar, guncellendi: serverTimestamp() });
  try { localStorage.removeItem(AYAR_ONBELLEK); } catch (e) { /* önemli değil */ }
}

/** Ders bilgilerini kaydeder (alanlar dersBilgileri() ile aynı). Boş alanlar ve tamamen boş satırlar kaydedilmez;
 *  hiçbir değer tamamlanmaz ya da tahmin edilmez. */
export async function dersBilgileriniKaydet(d) {
  const veri = {};
  const ekle = (ad, deger) => { if (deger) veri[ad] = deger; };
  ekle('tanim', yazi(d.tanim, 3000));
  ekle('dersSaatleri', yazi(d.dersSaatleri, 300));
  ekle('derslik', yazi(d.derslik, 200));

  const sinavlar = (d.sinavlar || []).map(s => ({ ad: yazi(s.ad, 100), tarih: yazi(s.tarih, 10), saat: yazi(s.saat, 50), yer: yazi(s.yer, 100) }))
    .filter(s => s.ad || s.tarih || s.saat || s.yer);
  for (const s of sinavlar) {
    if (!s.ad) throw gecersiz('Her sınav satırında sınavın adı olmalı.');
    if (s.tarih && !GUN.test(s.tarih)) throw gecersiz(`"${s.ad}" sınavının tarihi geçerli değil.`);
  }
  if (sinavlar.length) veri.sinavlar = sinavlar;

  const degerlendirme = (d.degerlendirme || []).map(k => ({ ad: yazi(k.ad, 100), yuzde: yazi(k.yuzde, 10) }))
    .filter(k => k.ad || k.yuzde).map(k => {
      if (!k.ad) throw gecersiz('Her değerlendirme satırında bir ad olmalı (ör. yüzdenin neye ait olduğu).');
      if (!k.yuzde) return { ad: k.ad };
      const n = Number(k.yuzde.replace(',', '.'));
      if (!isFinite(n) || n < 0 || n > 100) throw gecersiz(`"${k.ad}" için yüzde 0 ile 100 arasında bir sayı olmalı.`);
      return { ad: k.ad, yuzde: n };
    });
  if (degerlendirme.length) veri.degerlendirme = degerlendirme;

  const kaynaklar = (d.kaynaklar || []).map(k => yazi(k, 300)).filter(Boolean);
  if (kaynaklar.length) veri.kaynaklar = kaynaklar;

  const i = d.iletisim || {}, iletisim = {};
  if (yazi(i.eposta, 100)) iletisim.eposta = yazi(i.eposta, 100);
  if (yazi(i.ofis, 100)) iletisim.ofis = yazi(i.ofis, 100);
  if (yazi(i.ofisSaatleri, 200)) iletisim.ofisSaatleri = yazi(i.ofisSaatleri, 200);
  if (iletisim.eposta && !EPOSTA.test(iletisim.eposta)) throw gecersiz('E-posta adresi geçerli görünmüyor.');
  if (Object.keys(iletisim).length) veri.iletisim = iletisim;

  await setDoc(doc(db, 'site', 'ders'), { ...veri, guncellendi: serverTimestamp() });
  return veri;
}

// ── İçe aktarma (tek seferlik taşıma, yalnızca yönetici) ──

/** Veritabanında zaten bulunan konu ve öneri kimlikleri (üzerine yazmadan önce uyarmak için). */
export async function mevcutKayitlar(konular, oneriler) {
  const varMi = async (yol, id) => (await getDoc(doc(db, yol, id))).exists();
  const k = await Promise.all(konular.map(x => varMi('konular', x.kod)));
  const o = await Promise.all(oneriler.map(x => varMi('oneriler', x.id)));
  return {
    konular: konular.filter((_, i) => k[i]).map(x => x.kod),
    oneriler: oneriler.filter((_, i) => o[i]).map(x => x.id),
  };
}

/** veri/konular.json → konular/{kod}, veri/oneriler.json → oneriler/{id}. Hepsi tek seferde yazılır ya da hiçbiri yazılmaz. */
export async function iceAktar(konular, oneriler) {
  const b = writeBatch(db);
  for (const k of konular) b.set(doc(db, 'konular', k.kod), { ...k, guncellendi: serverTimestamp() });
  for (const o of oneriler) b.set(doc(db, 'oneriler', o.id), { ...o, olusturuldu: serverTimestamp() });
  await b.commit();
  return { konu: konular.length, oneri: oneriler.length };
}
