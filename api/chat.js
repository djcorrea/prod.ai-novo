import fetch from 'node-fetch';
import admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: "prodai-58436", // <-- substituído o process.env que não existia
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { message, conversationHistory = [], idToken } = req.body;

  if (!idToken) {
    return res.status(401).json({ error: 'Usuário não autenticado' });
  }

  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email;

    const userRef = db.collection('usuarios').doc(uid);
    const userDoc = await userRef.get();

    const hoje = new Date().toISOString().split('T')[0];

    if (!userDoc.exists) {
      await userRef.set({
        uid,
        email,
        plano: 'gratis',
        mensagensHoje: 0,
        ultimaData: hoje,
      });
    }

    const userData = (await userRef.get()).data();

    if (userData.ultimaData !== hoje) {
      await userRef.update({ mensagensHoje: 0, ultimaData: hoje });
      userData.mensagensHoje = 0;
    }

    if (userData.plano === 'gratis' && userData.mensagensHoje >= 10) {
      return res.status(403).json({ error: 'Limite diário de mensagens atingido' });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        max_tokens: 1000,
        messages: [
          {
            role: 'system',
            content:
              'Você é o Prod.AI 🎵 - um mentor especialista em produção musical brasileira, focado principalmente em FUNK, mas dominando todos os estilos musicais.',
          },
          ...conversationHistory,
          { role: 'user', content: message },
        ],
      }),
    });

    const data = await response.json();

    if (!data.choices || !data.choices[0]?.message?.content) {
      return res.status(500).json({ error: 'Resposta vazia da OpenAI', data });
    }

    const reply = data.choices[0].message.content.trim();

    if (userData.plano === 'gratis') {
      await userRef.update({
        mensagensHoje: admin.firestore.FieldValue.increment(1),
      });
    }

    return res.status(200).json({ reply });

  } catch (error) {
    console.error('[ERRO NO /api/chat.js]', error);
    return res.status(500).json({ error: 'Erro interno do servidor', detalhes: error.message });
  }
}
