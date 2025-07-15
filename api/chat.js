import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

// Função melhorada para inicializar Firebase
async function initializeFirebase() {
  // Verifica se já existe uma instância ativa
  if (getApps().length > 0) {
    return getApps()[0];
  }

  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    
    return initializeApp({
      credential: cert(serviceAccount),
    });
  } catch (error) {
    console.error('❌ Erro ao inicializar Firebase:', error);
    throw new Error('Falha na inicialização do Firebase');
  }
}

// Função para validar e sanitizar dados de entrada
function validateAndSanitizeInput(req) {
  const { message, conversationHistory = [], idToken } = req.body;
  
  // Validação do token
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('TOKEN_MISSING');
  }
  
  // Validação da mensagem
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw new Error('MESSAGE_INVALID');
  }
  
  // Validação e sanitização do histórico de conversas
  let validHistory = [];
  if (Array.isArray(conversationHistory)) {
    validHistory = conversationHistory
      .filter(msg => {
        return msg && 
          typeof msg === 'object' && 
          msg.role && 
          msg.content &&
          typeof msg.content === 'string' &&
          msg.content.trim().length > 0 &&
          ['user', 'assistant', 'system'].includes(msg.role);
      })
      .slice(-10); // Limita a 10 mensagens mais recentes
  }
  
  return {
    message: message.trim().substring(0, 2000), // Limita tamanho da mensagem
    conversationHistory: validHistory,
    idToken: idToken.trim()
  };
}

// Função para gerenciar limites de usuário
async function handleUserLimits(db, uid, email) {
  const userRef = db.collection('usuarios').doc(uid);
  
  try {
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const now = Timestamp.now();
      const today = now.toDate().toDateString();
      
      let userData;
      
 if (!snap.exists) {
  // Novo usuário
  userData = {
    uid,
    plano: 'gratis',
    mensagensRestantes: 9, // já decrementado
    dataUltimoReset: now,
    createdAt: now,
  };

  // Adiciona o email apenas se estiver definido
  if (email) {
    userData.email = email;
  }

  // Cria o documento com os dados
  tx.set(userRef, userData);
}



  userData.mensagensRestantes = 9;
      } else {
        // Usuário existente
        userData = snap.data();
        const lastReset = userData.dataUltimoReset?.toDate().toDateString();
        
        // Reset diário se necessário
        if (lastReset !== today) {
          userData.mensagensRestantes = 10;
          tx.update(userRef, {
            mensagensRestantes: 10,
            dataUltimoReset: now,
          });
        }
        
        // Verificar limite para usuários gratuitos
        if (userData.plano === 'gratis' && userData.mensagensRestantes <= 0) {
          throw new Error('LIMIT_EXCEEDED');
        }
        
        // Decrementar contador
        tx.update(userRef, {
          mensagensRestantes: FieldValue.increment(-1),
        });
        userData.mensagensRestantes = (userData.mensagensRestantes || 10) - 1;
      }
      
      return userData;
    });
    
    return result;
  } catch (error) {
    if (error.message === 'LIMIT_EXCEEDED') {
      console.warn('🚫 Limite de mensagens atingido para:', email);
      throw error;
    }
    console.error('❌ Erro na transação do usuário:', error);
    throw new Error('Erro ao processar limites do usuário');
  }
}

// Função para chamar a API da OpenAI
async function callOpenAI(messages) {
  const requestBody = {
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    max_tokens: 1000,
    messages: [
      {
        role: 'system',
        content: `Você é o Prod.AI 🎵, um assistente 100% focado em produção musical. Sua missão é ajudar produtores, beatmakers e músicos a criar, mixar e masterizar suas faixas com excelência.

🎯 SUAS ESPECIALIDADES:
• Produção musical (beats, arranjos, composição)
• Mixing e mastering profissional
• Teoria musical aplicada à produção
• Uso de DAWs (FL Studio, Ableton, Pro Tools, etc.)
• Plugins e processamento de áudio
• Sound design e síntese
• Gravação e captação de áudio

🚀 COMO VOCÊ ATUA:
• Respostas práticas e diretas
• Foco em soluções técnicas
• Exemplos concretos com settings
• Dicas profissionais testadas
• Linguagem acessível mas técnica

🎵 SEMPRE MANTENHA:
• Entusiasmo pela música
• Abordagem profissional
• Foco em resultados sonoros
• Adaptação ao nível do usuário`
      },
      ...messages,
    ],
  };

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!openaiRes.ok) {
      throw new Error(`OpenAI API erro: ${openaiRes.status} ${openaiRes.statusText}`);
    }

    const data = await openaiRes.json();

    if (!data.choices || !data.choices[0]?.message) {
      console.error("❌ Resposta inválida da OpenAI:", data);
      throw new Error('Resposta inválida da OpenAI');
    }

    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('❌ Erro na API da OpenAI:', error);
    throw new Error('Falha na comunicação com OpenAI');
  }
}

export default async function handler(req, res) {
  // Log da requisição para debug
  console.log('🔄 Nova requisição recebida:', {
    method: req.method,
    timestamp: new Date().toISOString(),
    hasBody: !!req.body
  });

  // Tratamento de CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verificar método HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // 1. Inicializar Firebase
    await initializeFirebase();
    const db = getFirestore();
    const auth = getAuth();

    // 2. Validar e sanitizar dados de entrada
    let validatedData;
    try {
      validatedData = validateAndSanitizeInput(req);
    } catch (error) {
      if (error.message === 'TOKEN_MISSING') {
        return res.status(401).json({ error: 'Token de autenticação necessário' });
      }
      if (error.message === 'MESSAGE_INVALID') {
        return res.status(400).json({ error: 'Mensagem inválida ou vazia' });
      }
      throw error;
    }

    const { message, conversationHistory, idToken } = validatedData;

    // 3. Verificar autenticação
    let decoded;
    try {
      decoded = await auth.verifyIdToken(idToken);
    } catch (err) {
      console.error("🔒 Erro ao verificar token:", err);
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }

    const uid = decoded.uid;
    const email = decoded.email;

    // 4. Gerenciar limites do usuário
    let userData;
    try {
      userData = await handleUserLimits(db, uid, email);
    } catch (error) {
      if (error.message === 'LIMIT_EXCEEDED') {
        return res.status(403).json({ error: 'Limite diário de mensagens atingido' });
      }
      throw error;
    }

    // 5. Preparar mensagens para OpenAI
    const messages = [
      ...conversationHistory,
      { role: 'user', content: message },
    ];

    // 6. Chamar OpenAI
    const reply = await callOpenAI(messages);

    // 7. Log de sucesso
    if (userData.plano === 'gratis') {
      console.log('✅ Mensagens restantes para', email, ':', userData.mensagensRestantes);
    }

    // 8. Retornar resposta
    return res.status(200).json({ 
      reply,
      mensagensRestantes: userData.plano === 'gratis' ? userData.mensagensRestantes : null
    });

  } catch (error) {
    console.error('💥 ERRO NO SERVIDOR:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    return res.status(500).json({ 
      error: 'Erro interno do servidor', 
      details: process.env.NODE_ENV === 'development' ? error.message : 'Erro interno'
    });
  }
}
