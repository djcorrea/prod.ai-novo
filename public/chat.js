// Função para adicionar mensagem na interface
function addMessage(role, content) {
  const chatContainer = document.getElementById('chat-container');

  const messageDiv = document.createElement('div');
  messageDiv.classList.add(role === 'user' ? 'mensagem-usuario' : 'mensagem-assistente');
  messageDiv.innerHTML = `<p><strong>${role === 'user' ? 'Você' : 'Assistente'}:</strong> ${content}</p>`;

  chatContainer.appendChild(messageDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Histórico da conversa
let conversationHistory = [];

// Função principal para enviar mensagem
async function enviarMensagem() {
  const input = document.getElementById('mensagem');
  const texto = input.value.trim();
  if (!texto) return;

  addMessage('user', texto);
  input.value = '';

  const resposta = await enviarParaAPI(texto, conversationHistory);
  addMessage('assistant', resposta);

  conversationHistory.push({ role: 'user', content: texto });
  conversationHistory.push({ role: 'assistant', content: resposta });
}

// Enviar ao pressionar Enter
document.getElementById('mensagem').addEventListener('keydown', function (event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    enviarMensagem();
  }
});

// Botão de envio
document.getElementById('enviar-btn').addEventListener('click', enviarMensagem);

// Função que envia mensagem para /api/chat com idToken do Firebase
async function enviarParaAPI(userMessage, conversationHistory) {
  try {
    const user = firebase.auth().currentUser;

    if (!user) {
      console.warn("Usuário não autenticado.");
      return "⚠️ Você precisa estar logado para usar o chat.";
    }

    const idToken = await user.getIdToken();

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: userMessage,
        conversationHistory: conversationHistory,
        idToken: idToken
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Erro do servidor:", data.error);
      return "❌ Erro: " + (data.error || "resposta vazia ou inesperada.");
    }

    return data.reply;

  } catch (error) {
    console.error("Erro ao enviar para API:", error.message);
    return "❌ Erro inesperado ao conectar com o servidor.";
  }
}
