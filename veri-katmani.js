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
  where, getCount, writeBatch, serverTimestamp
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

// Firestore zaman damgası → JS tarihi (sayfalar veritabanının tarih biçimini bilmek zorunda kalmasın)
const tarihe = t => t && typeof t.toDate === 'function' ? t.toDate() : (t ? new Date(t) : null);

/** Duyurular, en yeni önce. Her duyuru: { id, tarih (Date), baslik, metin, link?, linkYazi? }. adet verilmezse hepsi. */
export async function duyurular(adet) {
  const q = adet ? query(collection(db, 'duyurular'), orderBy('tarih', 'desc'), limit(adet))
                 : query(collection(db, 'duyurular'), orderBy('tarih', 'desc'));
  return (await getDocs(q)).docs.map(b => ({ id: b.id, ...b.data(), tarih: tarihe(b.data().tarih) }));
}

/** Site ayarları: { donem, kurum, driveLink }. Yoksa boş nesne. */
export async function siteAyarlari() {
  const b = await getDoc(doc(db, 'site', 'ayarlar'));
  return b.exists() ? b.data() : {};
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
