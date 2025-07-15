import { Timestamp } from 'firebase-admin/firestore';

async function runTransaction() {
  let userRef = { data: null };
  let userData;
  const snapExists = userRef.data !== null;
  const now = Timestamp.now();
  const today = now.toDate().toDateString();

  if (snapExists) {
    userData = userRef.data;
    const lastReset = userData.dataUltimoReset?.toDate().toDateString();
    if (lastReset !== today) {
      userData.mensagensRestantes = 10;
      userRef.data.mensagensRestantes = 10;
      userRef.data.dataUltimoReset = now;
    }
  } else {
    userData = {
      uid: 'test-uid',
      email: 'test@example.com',
      plano: 'gratis',
      mensagensRestantes: 10,
      dataUltimoReset: now,
      createdAt: now,
    };
    userRef.data = { ...userData };
  }

  if (userData.plano === 'gratis' && userData.mensagensRestantes <= 0) {
    throw new Error('LIMIT');
  }

  userRef.data.mensagensRestantes -= 1;
  userData.mensagensRestantes = userRef.data.mensagensRestantes;
  return userData;
}

runTransaction().then(res => {
  console.log('Mensagens restantes apos primeira requisicao:', res.mensagensRestantes);
});
