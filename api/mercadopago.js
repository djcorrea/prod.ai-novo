import express from 'express';
import mercadopago from 'mercadopago';
import admin from 'firebase-admin';
import cors from 'cors';

// ------------- Configurações iniciais -------------
mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN
});

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // chaves de serviço vêm com \n
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  })
});

const app = express();
app.use(cors());
app.use(express.json()); // para /create-preference

// Middleware para validar ID token do Firebase
async function validateFirebaseIdToken(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).send('Unauthorized');
  const idToken = auth.split('Bearer ')[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.user = decoded;
    return next();
  } catch (e) {
    return res.status(401).send('Unauthorized');
  }
}

// ------------- 1) Criar preferência -------------
app.post('/api/create-preference', validateFirebaseIdToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const preference = {
      items: [
        {
          title: "Assinatura Prod.AI Plus",
          unit_price: 19.90,
          quantity: 1,
          currency_id: "BRL"
        }
      ],
      payer: {
        email: req.user.email
      },
      back_urls: {
        success: `${process.env.FRONTEND_URL}`,
        failure: `${process.env.FRONTEND_URL}`,
        pending: `${process.env.FRONTEND_URL}`
      },
      auto_return: 'approved',
      external_reference: uid
    };

    const mpRes = await mercadopago.preferences.create(preference);
    return res.json({ init_point: mpRes.body.init_point });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro criando preferência.' });
  }
});

// ------------- 2) Webhook de pagamento -------------
// precisa raw body para validar a assinatura, mas como MP não exige,
// podemos usar JSON normal.
app.post('/api/webhook', async (req, res) => {
  const { type, data } = req.body;
  // type === 'payment' quando um pagamento é criado/atualizado
  if (type === 'payment') {
    const payment = data;
    const uid = payment.external_reference;
    if (payment.status === 'approved') {
      // Marca como Plus no Firestore
      await admin.firestore().collection('users').doc(uid).set({
        isPlus: true,
        upgradedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  }
  // sempre responder 200
  res.sendStatus(200);
});

// ------------- Inicia servidor (Express) -------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 API rodando na porta ${PORT}`));
