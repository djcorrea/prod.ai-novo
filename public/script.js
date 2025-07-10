// script.js

// ─── ELEMENTOS DO DOM ─────────────────────────────────────
const chatbox         = document.getElementById('chatbox');
const input           = document.getElementById('user-input');
const sendBtn         = document.getElementById('sendBtn');
const typingIndicator = document.getElementById('typingIndicator');

let conversationHistory = [];

// ─── FUNÇÕES DE CHAT ──────────────────────────────────────
function appendMessage(content, className) {
  const messageDiv     = document.createElement('div');
  messageDiv.className = `message ${className}`;

  const messageContent     = document.createElement('div');
  messageContent.className = 'message-content';
  messageContent.innerHTML = content.replace(/\n/g, '<br>');

  messageDiv.appendChild(messageContent);
  chatbox.appendChild(messageDiv);
  chatbox.scrollTop = chatbox.scrollHeight;
}

function showTypingIndicator() {
  typingIndicator.style.display = 'flex';
  chatbox.scrollTop              = chatbox.scrollHeight;
}
function hideTypingIndicator() {
  typingIndicator.style.display = 'none';
}

async function sendMessage() {
  const message = input.value.trim();
  if (!message || sendBtn.disabled) return;

  appendMessage(`<strong>Você:</strong> ${message}`, 'user');
  input.value = '';
  input.focus();

  conversationHistory.push({ role: 'user', content: message });

  sendBtn.disabled  = true;
  sendBtn.innerHTML = 'Enviando...';
  showTypingIndicator();

  try {
    const user = firebase.auth().currentUser;
    if (!user) {
      appendMessage(
        `<strong>Assistente:</strong> Você precisa estar logado para usar o chat.`,
        'bot'
      );
      hideTypingIndicator();
      sendBtn.disabled  = false;
      sendBtn.innerHTML = 'Enviar';
      return;
    }

    const idToken = await user.getIdToken();
    const res     = await fetch('/api/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message, conversationHistory, idToken })
    });

    const rawText = await res.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      hideTypingIndicator();
      console.error("Resposta inválida do servidor:", rawText);
      appendMessage(
        `<strong>Assistente:</strong> 🚫 Você atingiu o limite de <strong>10 mensagens diárias</strong> na versão gratuita.<br><br>` +
        `🔓 <a href="#" class="btn-plus">Clique aqui para assinar a versão Plus</a> e liberar mensagens ilimitadas.`,
        'bot'
      );
      return;
    }

    hideTypingIndicator();

    if (data.error && data.error.toLowerCase().includes('limite diário')) {
      appendMessage(
        `<strong>Assistente:</strong> 🚫 Você atingiu o limite de <strong>10 mensagens diárias</strong> na versão gratuita.<br><br>` +
        `🔓 <a href="#" class="btn-plus">Clique aqui para assinar a versão Plus</a> e liberar mensagens ilimitadas.`,
        'bot'
      );
    } else if (data.reply) {
      appendMessage(`<strong>Assistente:</strong> ${data.reply}`, 'bot');
      conversationHistory.push({ role: 'assistant', content: data.reply });
    } else {
      appendMessage(
        `<strong>Assistente:</strong> Ocorreu um erro inesperado.`,
        'bot'
      );
      console.error('Erro na resposta:', data);
    }
  } catch (err) {
    hideTypingIndicator();
    console.error(err);
    appendMessage(
      `<strong>Assistente:</strong> Erro ao se conectar com o servidor.`,
      'bot'
    );
  } finally {
    sendBtn.disabled  = false;
    sendBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
      </svg>
      Enviar`;
  }
}

// ─── FLUXO DE CHECKOUT MERCADO PAGO ────────────────────────
async function goToMP() {
  const user = firebase.auth().currentUser;
  if (!user) {
    return appendMessage(
      `<strong>Assistente:</strong> Você precisa estar logado para assinar o Plus.`,
      'bot'
    );
  }

  const idToken = await user.getIdToken();
  try {
    const resp = await fetch('/api/create-preference', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + idToken
      },
      body: JSON.stringify({})
    });
    const { init_point } = await resp.json();
    window.open(init_point, '_blank');
  } catch (err) {
    console.error('Erro criando preferência MP:', err);
    appendMessage(
      `<strong>Assistente:</strong> Ocorreu um erro ao iniciar o pagamento. Tente novamente mais tarde.`,
      'bot'
    );
  }
}

// ─── LISTENERS GLOBAIS ────────────────────────────────────
// Enviar mensagem com Enter
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Delegação de clique para .btn-plus (login, links e dinâmicos)
document.addEventListener('click', (e) => {
  const plus = e.target.closest('.btn-plus');
  if (plus) {
    e.preventDefault();
    goToMP();
  }
  const logoutBtn = e.target.closest('.logout-button');
  if (logoutBtn) {
    e.preventDefault();
    logout();
  }
});

// Saudação inicial
window.addEventListener('load', () => {
  input.focus();
  setTimeout(() => {
    appendMessage(
      '<strong>Assistente:</strong> 🎵 Bem-vindo! Sou seu mentor especializado em produção musical. O que você gostaria de aprender hoje?',
      'bot'
    );
  }, 1000);
});
