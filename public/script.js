// script.js

const chatbox = document.getElementById('chatbox');
const input = document.getElementById('user-input');
const sendBtn = document.getElementById('sendBtn');
const typingIndicator = document.getElementById('typingIndicator');
const initialInput = document.getElementById('initialInput');
const initialSendBtn = document.getElementById('initialSendBtn');
const header = document.getElementById('header');
const motivationalText = document.getElementById('motivationalText');
const initialInputContainer = document.getElementById('initialInputContainer');
const chatContainer = document.getElementById('chatContainer');
const container = document.querySelector('.container');

let chatStarted = false;
let conversationHistory = [];

// Função para iniciar o chat
function startChat() {
  if (chatStarted) return;
  
  chatStarted = true;
  
  // Adicionar classes para animação
  header.classList.add('moved-to-top');
  motivationalText.classList.add('fade-out');
  initialInputContainer.classList.add('fade-out');
  chatContainer.classList.add('expanded');
  container.classList.add('chat-started');
  
  // Focar no input principal após a animação
  setTimeout(() => {
    input.focus();
  }, 800);
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

// Função para enviar mensagem inicial
function sendInitialMessage() {
  const message = initialInput.value.trim();
  if (!message) return;
  
  // Iniciar animação do chat
  startChat();
  
  // Aguardar animação e então processar mensagem
  setTimeout(() => {
    appendMessage(`<strong>Você:</strong> ${message}`, 'user');
    conversationHistory.push({ role: 'user', content: message });
    processMessage(message);
  }, 400);
  
  initialInput.value = '';
}

// Função para enviar mensagem normal
async function sendMessage() {
  const message = input.value.trim();
  if (!message || sendBtn.disabled) return;

  // Se é a primeira mensagem e o chat não foi iniciado
  if (!chatStarted) {
    startChat();
    
    // Aguardar animação e então processar mensagem
    setTimeout(() => {
      appendMessage(`<strong>Você:</strong> ${message}`, 'user');
      conversationHistory.push({ role: 'user', content: message });
      processMessage(message);
    }, 400);
    
    input.value = '';
    return;
  }

  appendMessage(`<strong>Você:</strong> ${message}`, 'user');
  input.value = '';
  input.focus();
  conversationHistory.push({ role: 'user', content: message });

  await processMessage(message);
}

// Função para processar mensagem (conecta com sua API)
async function processMessage(message) {
  sendBtn.disabled = true;
  sendBtn.innerHTML = 'Enviando...';
  showTypingIndicator();

  try {
    const user = firebase.auth().currentUser;
    if (!user) {
      appendMessage(`<strong>Assistente:</strong> Você precisa estar logado para usar o chat.`, 'bot');
      hideTypingIndicator();
      sendBtn.disabled = false;
      sendBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 21L23 12L2 3V10L17 12L2 14V21Z" fill="currentColor"/></svg>Enviar';
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
      </svg>
      Enviar`;
  }
}

// Função logout (mantém sua implementação original)
function logout() {
  firebase.auth().signOut().then(() => {
    window.location.href = 'login.html';
  }).catch((error) => {
    console.error('Erro ao fazer logout:', error);
  });
}

// Eventos para input inicial
initialInput?.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendInitialMessage();
  }
});

initialSendBtn?.addEventListener('click', e => {
  e.preventDefault();
  sendInitialMessage();
});

// Eventos para chat normal
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

// Focar no input inicial ao carregar
window.addEventListener('load', function() {
  if (initialInput) {
    initialInput.focus();
    // Saudação inicial após um pequeno delay
    setTimeout(() => {
      if (!chatStarted) {
        // Só mostra a saudação se o chat não foi iniciado
        const initialMessage = document.querySelector('.chatbox .message.bot');
        if (initialMessage) {
          initialMessage.style.display = 'none';
        }
      }
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
          phoneInput.setSelectionRange(phoneInput