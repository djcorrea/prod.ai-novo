const chatbox = document.getElementById('chatbox');
const input = document.getElementById('user-input');
const sendBtn = document.getElementById('sendBtn');
const typingIndicator = document.getElementById('typingIndicator');

let conversationHistory = [];

function appendMessage(content, className) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${className}`;

  const messageContent = document.createElement('div');
  messageContent.className = 'message-content';
  messageContent.innerHTML = content.replace(/\n/g, '<br>');

  messageDiv.appendChild(messageContent);
  chatbox.appendChild(messageDiv);
  chatbox.scrollTop = chatbox.scrollHeight;
}

function showTypingIndicator() {
  typingIndicator.style.display = 'flex';
  chatbox.scrollTop = chatbox.scrollHeight;
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

  sendBtn.disabled = true;
  sendBtn.innerHTML = 'Enviando...';
  showTypingIndicator();

  try {
    const user = firebase.auth().currentUser;
    if (!user) {
      appendMessage(`<strong>Assistente:</strong> Você precisa estar logado para usar o chat.`, 'bot');
      hideTypingIndicator();
      sendBtn.disabled = false;
      sendBtn.innerHTML = 'Enviar';
      return;
    }

    const idToken = await user.getIdToken();

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        conversationHistory,
        idToken
      })
    });

    const rawText = await res.text();

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      hideTypingIndicator();
      console.error("Resposta inválida do servidor:", rawText);
      appendMessage(`<strong>Assistente:</strong> Erro inesperado no servidor.`, 'bot');
      return;
    }

    hideTypingIndicator();

    if (data.reply) {
      appendMessage(`<strong>Assistente:</strong> ${data.reply}`, 'bot');
      conversationHistory.push({ role: 'assistant', content: data.reply });
    } else if (data.error === 'Limite diário de mensagens atingido') {
      appendMessage(`<strong>Assistente:</strong> Você atingiu o limite de 10 mensagens diárias da versão gratuita. <a href="https://seulink-do-stripe.com" target="_blank">Assine a versão Plus</a> para mensagens ilimitadas.`, 'bot');
    } else {
      appendMessage(`<strong>Assistente:</strong> Você atingiu o limite de 10 mensagens diárias da versão gratuita.`, 'bot');
      console.error('Erro na resposta:', data);
    }

  } catch (err) {
    hideTypingIndicator();
    appendMessage(`<strong>Assistente:</strong> Você atingiu o limite de 10 mensagens diárias da versão gratuita.`, 'bot');
    console.error(err);
  } finally {
    sendBtn.disabled = false;
    sendBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
      </svg>Enviar`;
  }
}

input.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

window.addEventListener('load', () => {
  input.focus();
  setTimeout(() => {
    appendMessage('<strong>Assistente:</strong> 🎵 Bem-vindo! Sou seu mentor especializado em produção musical. O que você gostaria de aprender hoje?', 'bot');
  }, 1000);
});
