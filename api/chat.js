import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

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
          content: `Você é o Prod.AI 🎵, um assistente 100% focado em produção musical, especialmente no nicho de música brasileira como funk, mas também apto a responder sobre qualquer estilo musical.\n\nSeu papel é:\n- Ensinar com clareza.\n- Responder dúvidas de alunos.\n- Ajudar na criação de beats, letras, mixagem, masterização, plugins, samples, organização de projetos e finalização.\n- Dar dicas práticas e aplicáveis para fazer hits de verdade.\n- Orientar sobre carreira musical, distribuição digital (Spotify, YouTube, etc), marketing musical, identidade artística e estratégias para ganhar dinheiro com música.\n\n❗ Regras:\n- Responda apenas assuntos relacionados à música e produção musical.\n- Dê exemplos práticos sempre que possível.\n- Seja objetivo e direto ao ponto.\n- Indique plugins, ferramentas ou práticas profissionais quando necessário.\n- Nunca use linguagem técnica sem explicar de forma fácil.\n- Interprete a dúvida do aluno e dê uma solução funcional e prática, nada genérico.\n- ⚠️ Nunca saia do tema "música e produção musical". Se for perguntado algo fora disso, diga gentilmente que só responde dúvidas sobre música.\n\nAdote uma perspectiva visionária, fale na lata, sem floreios, com empatia e clareza.`
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
      await userRef.update({ mensagensHoje: FieldValue.increment(1) });
    }

    return res.status(200).json({ reply });

  } catch (error) {
    console.error('💥 ERRO NO SERVIDOR:', error.message);
    return res.status(500).json({ error: 'Erro interno', details: error.message });
  }
}
