import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

let firebaseInitialized = false;

async function initializeFirebase() {
  if (firebaseInitialized || getApps().length > 0) return;

  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

  initializeApp({
    credential: cert(serviceAccount),
  });

  firebaseInitialized = true;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  try {
    await initializeFirebase();
    const db = getFirestore();
    const auth = getAuth();

    const { message, conversationHistory = [], idToken } = req.body;

    if (!idToken) return res.status(401).json({ error: 'Usuário não autenticado' });
    if (!message || typeof message !== 'string' || message.trim().length === 0)
      return res.status(400).json({ error: 'Mensagem inválida' });

    let decoded;
    try {
      decoded = await auth.verifyIdToken(idToken);
    } catch (err) {
      console.error("🔒 Erro ao verificar token:", err);
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }

    const uid = decoded.uid;
    const email = decoded.email;
    const userRef = db.collection('usuarios').doc(uid);
    let userData;

    try {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        const now = Timestamp.now();
        const today = now.toDate().toDateString();

        if (!snap.exists) {
          userData = {
            uid,
            email,
            plano: 'gratis',
            mensagensRestantes: 9,
            dataUltimoReset: now,
            createdAt: now,
          };
          tx.set(userRef, userData);
          return;
        }

        userData = snap.data();
        const lastReset = userData.dataUltimoReset?.toDate().toDateString();
        if (lastReset !== today) {
          userData.mensagensRestantes = 10;
          tx.update(userRef, {
            mensagensRestantes: 10,
            dataUltimoReset: now,
          });
        }

        if (userData.plano === 'gratis' && userData.mensagensRestantes <= 0) {
          throw new Error('LIMIT');
        }

        tx.update(userRef, {
          mensagensRestantes: FieldValue.increment(-1),
        });
        userData.mensagensRestantes = (userData.mensagensRestantes || 10) - 1;
      });
    } catch (err) {
      if (err.message === 'LIMIT') {
        console.warn('🚫 Limite de mensagens atingido para:', email);
        return res.status(403).json({ error: 'Limite diário atingido' });
      }
      throw err;
    }

    const mensagensFiltradas = conversationHistory
      .filter(msg => msg && msg.role && msg.content)
      .slice(-10);

    const requestBody = {
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      max_tokens: 1000,
      messages: [
        {
          role: 'system',
          content: `Você é o Prod.AI 🎵, um assistente 100% focado em produção musical...`
          // substitua aqui com o prompt completo se quiser
        },
        ...mensagensFiltradas,
        { role: 'user', content: message.trim().substring(0, 2000) },
      ],
    };

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await openaiRes.json();

    if (!data.choices || !data.choices[0]?.message) {
      console.error("❌ Resposta inválida da OpenAI:", data);
      return res.status(500).json({ error: 'Resposta inválida da OpenAI' });
    }

    const reply = data.choices[0].message.content.trim();

    if (userData.plano === 'gratis') {
      console.log('✅ Mensagens restantes para', email, ':', userData.mensagensRestantes);
    }

    return res.status(200).json({ reply });

  } catch (error) {
    console.error('💥 ERRO NO SERVIDOR:', error);
    return res.status(500).json({ error: 'Erro interno', details: error.message });
  }
}
