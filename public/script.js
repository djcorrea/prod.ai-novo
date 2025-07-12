const chatbox = document.getElementById('chatbox');
const input = document.getElementById('user-input');
const sendBtn = document.getElementById('sendBtn');
const typingIndicator = document.getElementById('typingIndicator');
let isFirstMessage = true;
let conversationHistory = [];

// Animação ao enviar a primeira mensagem
function animateStart() {
  const header = document.getElementById('prodaiHeader');
  const container = document.getElementById('mainContainer');
  const chatContainer = document.getElementById('chatContainer');
  const body = document.body;
  
  // Adiciona efeito de transição
  container.classList.add('transitioning');
  
  setTimeout(() => {
    // Remove efeito de blur
    container.classList.remove('transitioning');
    
    // Aplica as animações
    header.classList.add('moved-to-top');
    container.classList.add('expanded');
    body.classList.add('header-fixed');
    
    // Ajusta scroll após expansão
    setTimeout(() => {
      chatbox.scrollTop = chatbox.scrollHeight;
      
      // Foca no input após animação
      if (input) {
        input.focus();
      }
    }, 600);
  }, 150);
}

// Adiciona mensagem no chat
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

  if (isFirstMessage) {
    animateStart();
    isFirstMessage = false;
  }

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
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, conversationHistory, idToken })
    });

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      hideTypingIndicator();
      appendMessage(
        `<strong>Assistente:</strong> 🚫 Você atingiu o limite de <strong>10 mensagens diárias</strong>.<br><br>` +
        `🔓 <a href="planos.html" class="btn-plus" target="_blank">Assinar versão Plus</a>`,
        'bot'
      );
      return;
    }

    hideTypingIndicator();
    if (data.error && data.error.toLowerCase().includes('limite diário')) {
      appendMessage(
        `<strong>Assistente:</strong> 🚫 Você atingiu o limite de <strong>10 mensagens diárias</strong>.<br><br>` +
        `🔓 <a href="planos.html" class="btn-plus" target="_blank">Assinar versão Plus</a>`,
        'bot'
      );
    } else if (data.reply) {
      appendMessage(`<strong>Assistente:</strong> ${data.reply}`, 'bot');
      conversationHistory.push({ role: 'assistant', content: data.reply });
    } else {
      appendMessage(`<strong>Assistente:</strong> Ocorreu um erro inesperado.`, 'bot');
    }
  } catch (err) {
    hideTypingIndicator();
    appendMessage(`<strong>Assistente:</strong> Erro ao se conectar com o servidor.`, 'bot');
  } finally {
    sendBtn.disabled = false;
    sendBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M2 21L23 12L2 3V10L17 12L2 14V21Z" fill="currentColor"/>
      </svg>`;
  }
}

// Eventos
input?.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
sendBtn?.addEventListener('click', e => {
  e.preventDefault();
  sendMessage();
});

// Saudação inicial
window.addEventListener('load', function() {
  if (input) {
    input.focus();
    setTimeout(() => {
      appendMessage(
        '<strong>Assistente:</strong> 👋 Olá! Sou o <span style="color: #9333ea; font-weight: 600;">Prod.AI</span>, seu mentor especializado em produção musical. Digite sua primeira pergunta para começarmos!',
        'bot'
      );
    }, 1000);
  }
});

// +55 automático para input de telefone (caso tenha)
document.addEventListener('DOMContentLoaded', () => {
  const phoneInput = document.getElementById('phone');
  if (phoneInput) {
    phoneInput.addEventListener('focus', () => {
      if (!phoneInput.value.trim().startsWith('+55')) {
        phoneInput.value = '+55';
        setTimeout(() => {
          phoneInput.setSelectionRange(phoneInput.value.length, phoneInput.value.length);
        }, 1);
      }
    });
    phoneInput.addEventListener('blur', () => {
      if (phoneInput.value.trim() === '+55') {
        phoneInput.value = '';
      }
    });
  }
});