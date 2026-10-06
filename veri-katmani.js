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
  getFirestore, doc, getDoc, getDocs, collection, writeBatch, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore-lite.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail
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

/** Bütün konular, ana sayfadaki sırasıyla (sayaçlar ve arama için). */
export async function tumKonular() {
  const s = await getDocs(collection(db, 'konular'));
  return s.docs.map(b => b.data()).sort((x, y) => x.sira - y.sira);
}

// ── Giriş ──

/** Giriş durumu her değiştiğinde fn(kullanici | null) çağrılır. Kullanıcı: { uid, eposta }. */
export function girisDurumu(fn) {
  return onAuthStateChanged(auth, k => fn(k ? { uid: k.uid, eposta: k.email } : null));
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

/** Giriş hata kodunu kullanıcıya gösterilecek Türkçe cümleye çevirir. */
export function hataMetni(e) {
  const kod = e && e.code || '';
  if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(kod)) return 'E-posta veya şifre hatalı.';
  if (/too-many-requests/.test(kod)) return 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin.';
  if (/network-request-failed|unavailable/.test(kod)) return 'İnternet bağlantısı kurulamadı.';
  if (/permission-denied/.test(kod)) return 'Bu işlem için yetkiniz yok.';
  return 'Beklenmeyen bir hata oluştu' + (kod ? ' (' + kod + ')' : '') + '.';
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
