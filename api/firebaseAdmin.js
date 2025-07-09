import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let auth;

if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

  initializeApp({
    credential: cert(serviceAccount),
  });

  auth = getAuth();
} else {
  auth = getAuth();
}

export { auth };
