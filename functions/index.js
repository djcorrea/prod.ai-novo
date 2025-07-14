import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

export const onUserCreate = functions.auth.user().onCreate(async (user) => {
  const { uid, email, phoneNumber } = user;
  const docRef = db.collection('usuarios').doc(uid);
  const snap = await docRef.get();
  if (!snap.exists) {
    await docRef.set({
      uid,
      email: email || null,
      phone: phoneNumber || null,
      plano: 'gratis',
      mensagensRestantes: 10,
      dataUltimoReset: admin.firestore.Timestamp.now(),
      createdAt: admin.firestore.Timestamp.now(),
    });
  }
});

export const registerAccount = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login necessário');
  }
  const { fingerprint, phone } = data;
  if (!fingerprint || !phone) {
    throw new functions.https.HttpsError('invalid-argument', 'Dados inválidos');
  }
  const fpRef = db.collection('fingerprints').doc(fingerprint);
  const phoneRef = db.collection('phones').doc(phone);
  const [fpSnap, phoneSnap] = await Promise.all([fpRef.get(), phoneRef.get()]);
  if (fpSnap.exists || phoneSnap.exists) {
    throw new functions.https.HttpsError('already-exists', 'Fingerprint ou telefone já utilizados');
  }
  const now = admin.firestore.Timestamp.now();
  await fpRef.set({ uid: context.auth.uid, phone, createdAt: now });
  await phoneRef.set({ uid: context.auth.uid, fingerprint, createdAt: now });
  return { success: true };
});
