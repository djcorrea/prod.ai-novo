// Inicialização do Firebase
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  // ... o restante das configs
};
firebase.initializeApp(firebaseConfig);

const emailInput    = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorEl       = document.getElementById('error-message');

// Mostra mensagem de erro/alerta
function showError(msg) {
  errorEl.textContent    = msg;
  errorEl.style.display  = 'block';
}

// Esconde mensagem
function clearError() {
  errorEl.textContent   = '';
  errorEl.style.display = 'none';
}

// Cadastrar usuário e enviar email de verificação
async function signUp() {
  clearError();
  const email = emailInput.value.trim();
  const pass  = passwordInput.value;

  if (!email || !pass) {
    return showError('Preencha email e senha.');
  }
  if (pass.length < 6) {
    return showError('A senha deve ter no mínimo 6 caracteres.');
  }

  try {
    const userCred = await firebase.auth().createUserWithEmailAndPassword(email, pass);
    await userCred.user.sendEmailVerification();
    alert('Cadastro realizado! Verifique seu e-mail para ativar a conta.');
    emailInput.value = '';
    passwordInput.value = '';
  } catch (err) {
    console.error(err);
    showError(err.message);
  }
}

// Fazer login só se o email estiver verificado
async function login() {
  clearError();
  const email = emailInput.value.trim();
  const pass  = passwordInput.value;

  if (!email || !pass) {
    return showError('Preencha email e senha.');
  }

  try {
    const userCred = await firebase.auth().signInWithEmailAndPassword(email, pass);
    if (!userCred.user.emailVerified) {
      await firebase.auth().signOut();
      return showError('Verifique seu e-mail antes de entrar.');
    }
    // login OK, leva ao chat
    window.location.href = 'index.html';
  } catch (err) {
    console.error(err);
    showError(err.message);
  }
}

// Dá foco no email ao carregar
window.addEventListener('load', () => {
  emailInput.focus();
});
