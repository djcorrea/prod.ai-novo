import * as mercadopago from 'mercadopago';
import admin from 'firebase-admin';

// configura Mercado Pago
mercadopago.configurations.setAccessToken(process.env.MP_ACCESS_TOKEN);

// inicializa Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  // valida ID Token
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer '))
    return res.status(401).json({ error: 'Unauthorized' });
  const idToken = auth.split('Bearer ')[1];

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const preference = {
    items: [{
      title:       'Assinatura Prod.AI Plus',
      unit_price:  19.9,
      quantity:    1,
      currency_id: 'BRL',
    }],
    payer: { email: decoded.email },
    back_urls: {
      success: process.env.FRONTEND_URL,
      failure: process.env.FRONTEND_URL,
      pending: process.env.FRONTEND_URL,
    },
    auto_return:        'approved',
    external_reference: decoded.uid,
  };

  try {
    const mpRes = await mercadopago.preferences.create(preference);
    return res.status(200).json({ init_point: mpRes.body.init_point });
  } catch (err) {
    console.error('Erro criando preferência:', err);
    return res.status(500).json({ error: 'Erro criando preferência.' });
  }
}
