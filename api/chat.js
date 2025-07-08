import admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function processPrivateKey(key) {
  if (!key) throw new Error('FIREBASE_PRIVATE_KEY não definida');
  let processedKey = key.trim();
  if (processedKey.startsWith('"') && processedKey.endsWith('"')) {
    processedKey = processedKey.slice(1, -1);
  }
  return processedKey.replace(/\\n/g, '\n');
}

let firebaseInitialized = false;

async function initializeFirebase() {
  if (firebaseInitialized) return;
  const privateKey = processPrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  const firebaseConfig = {
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  };

  if (!admin.apps.length) {
    admin.initializeApp(firebaseConfig);
  }

  firebaseInitialized = true;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  try {
    await initializeFirebase();
    const db = getFirestore();

    const { message, conversationHistory = [], idToken } = req.body;

    if (!idToken) return res.status(401).json({ error: 'Usuário não autenticado' });
    if (!message || typeof message !== 'string' || message.trim().length === 0)
      return res.status(400).json({ error: 'Mensagem inválida' });

    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(idToken);
    } catch (err) {
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }

    const uid = decoded.uid;
    const userRef = db.collection('usuarios').doc(uid);
    const hoje = new Date().toISOString().split('T')[0];

    let userDoc = await userRef.get();
    let userData = userDoc.exists ? userDoc.data() : { mensagensHoje: 0, ultimaData: hoje };

    if (!userDoc.exists) {
      await userRef.set({ uid, email: decoded.email, plano: 'gratis', mensagensHoje: 0, ultimaData: hoje });
    }

    if (userData.ultimaData !== hoje) {
      await userRef.update({ mensagensHoje: 0, ultimaData: hoje });
      userData.mensagensHoje = 0;
    }

    if (userData.plano === 'gratis' && userData.mensagensHoje >= 10) {
      return res.status(403).json({ error: 'Limite diário atingido' });
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
          content: 'Você é o Prod.AI 🎵, mentor de produção musical brasileira. Seja técnico, acessível e motivador.',
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

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      return res.status(500).json({ error: 'Resposta inválida da OpenAI' });
    }

    const reply = data.choices[0].message.content.trim();

    if (userData.plano === 'gratis') {
      await userRef.update({ mensagensHoje: admin.firestore.FieldValue.increment(1) });
    }

    return res.status(200).json({ reply });

  } catch (error) {
    console.error('💥 ERRO NO SERVIDOR:', error.message);
    return res.status(500).json({ error: 'Erro interno', details: error.message });
  }
}
