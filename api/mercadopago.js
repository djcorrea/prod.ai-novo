import express from 'express';
import * as mercadopago from 'mercadopago';
import admin from 'firebase-admin';
import cors from 'cors';

// ─── 1) CONFIGURAÇÃO DO EXPRESS ────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// ─── 2) CONFIGURAÇÃO DO MERCADO PAGO ──────────────────────
// Usa o método recomendado para ESM
mercadopago.configurations.setAccessToken(process.env.MP_ACCESS_TOKEN);

// ─── 3) INICIALIZAÇÃO DO FIREBASE ADMIN ────────────────────
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

// ─── 4) MIDDLEWARE: VALIDAÇÃO DO ID TOKEN FIREBASE ────────
async function validateFirebaseIdToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).send('Unauthorized');
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.user = decoded;
    return next();
  } catch (err) {
    console.error('Token inválido:', err);
    return res.status(401).send('Unauthorized');
  }
}

// ─── 5) ROTA: CRIA PREFERÊNCIA DO MERCADO PAGO ──────────────
app.post(
  '/api/create-preference',
  validateFirebaseIdToken,
  async (req, res) => {
    try {
      const uid = req.user.uid;
      const preference = {
        items: [
          {
            title:       'Assinatura Prod.AI Plus',
            unit_price:  19.9,
            quantity:    1,
            currency_id: 'BRL',
          },
        ],
        payer: {
          email: req.user.email,
        },
        back_urls: {
          success: process.env.FRONTEND_URL,
          failure: process.env.FRONTEND_URL,
          pending: process.env.FRONTEND_URL,
        },
        auto_return:        'approved',
        external_reference: uid,
      };

      const mpRes = await mercadopago.preferences.create(preference);
      return res.json({ init_point: mpRes.body.init_point });
    } catch (err) {
      console.error('Erro criando preferência:', err);
      return res.status(500).json({ error: 'Erro criando preferência.' });
    }
  }
);

// ─── 6) ROTA: WEBHOOK DE PAGAMENTO ──────────────────────────
app.post('/api/webhook', async (req, res) => {
  const { type, data } = req.body;
  if (type === 'payment') {
    const payment = data;
    const uid     = payment.external_reference;
    if (payment.status === 'approved') {
      await admin
        .firestore()
        .collection('users')
        .doc(uid)
        .set(
          {
            isPlus:     true,
            upgradedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    }
  }
  return res.sendStatus(200);
});

// ─── 7) INICIA O SERVIDOR ──────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 API rodando na porta ${PORT}`);
});
