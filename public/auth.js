const firebaseConfig = {
  apiKey:            "AIzaSyBKby0RdIOGorhrfBRMCWnL25peU3epGTw",
  authDomain:        "prodai-58436.firebaseapp.com",
  projectId:         "prodai-58436",
  storageBucket:     "prodai-58436.appspot.com",
  messagingSenderId: "801631191322",
  appId:             "1:801631322:web:80e3d29cf7468331652ca3",
  measurementId:     "G-MBDHDYN6Z0"
};
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// Mapeamento dos principais erros do Firebase Auth para português
const firebaseErrorsPt = {
  'auth/invalid-phone-number':         'Número de telefone inválido. Use o formato +55 DDD + número.',
  'auth/missing-phone-number':         'Digite seu número de telefone.',
  'auth/too-many-requests':            'Muitas tentativas. Tente novamente mais tarde.',
  'auth/quota-exceeded':               'Limite de SMS excedido. Tente novamente mais tarde.',
  'auth/user-disabled':                'Usuário desativado.',
  'auth/code-expired':                 'O código expirou. Solicite um novo.',
  'auth/invalid-verification-code':    'Código de verificação inválido.',
  'auth/captcha-check-failed':         'Falha na verificação do reCAPTCHA.',
  'auth/network-request-failed':       'Falha de conexão com a internet.',
  'auth/app-not-authorized':           'App não autorizado. Verifique as configurações do Firebase.',
  'auth/session-expired':              'Sessão expirada. Tente novamente.',
  'auth/invalid-verification-id':      'Falha na verificação. Tente novamente.',
  'auth/email-already-in-use':         'Esse e-mail já está cadastrado. Faça login ou recupere sua senha.',
  'auth/invalid-email':                'E-mail inválido. Digite um e-mail válido.',
  'auth/wrong-password':               'Senha incorreta.',
  'auth/user-not-found':               'Usuário não encontrado. Verifique o e-mail e tente novamente.',
  'auth/weak-password':                'A senha deve ter pelo menos 6 caracteres.',
  // ...adicione outros erros conforme necessário
};

// Função para exibir o erro traduzido
function showError(messageOrError) {
  let msg = typeof messageOrError === 'object' && messageOrError.code
    ? (firebaseErrorsPt[messageOrError.code] || messageOrError.message || 'Erro desconhecido.')
    : messageOrError;

  const el = document.getElementById("error-message");
  if (el) {
    el.innerText = msg;
    el.style.display = "block";
  } else {
    alert(msg);
  }
}

// Função para obter o fingerprint do navegador
async function getFingerprint() {
  if (window.FingerprintJS) {
    const fpPromise = FingerprintJS.load();
    const fp = await fpPromise;
    const result = await fp.get();
    return result.visitorId;
  }
  return null;
}

// --- SMS FIREBASE ---
let confirmationResult = null;
let lastPhone = "";

// Mostrar a seção para digitar o código SMS e desabilitar botão cadastrar
window.showSMSSection = function() {
  const smsSection = document.getElementById('sms-section');
  if (smsSection) {
    smsSection.style.display = 'block';
  }
  const signUpBtn = document.getElementById('signUpBtn');
  if (signUpBtn) {
    signUpBtn.disabled = true;
  }
};

// --- LOGIN NORMAL ---
window.login = async function () {
  const email    = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  try {
    const result  = await auth.signInWithEmailAndPassword(email, password);
    const idToken = await result.user.getIdToken();
    localStorage.setItem("user", JSON.stringify(result.user));
    localStorage.setItem("idToken", idToken);
    window.location.href = "index.html";
  } catch (error) {
    showError(error);
    console.error(error);
  }
};

// Função para enviar SMS - agora chamada dentro de signUp
async function sendSMS(phone) {
  // Checar telefone já cadastrado
  const phoneSnap = await db.collection("phones").doc(phone).get();
  if (phoneSnap.exists) {
    showError("Esse telefone já está cadastrado em outra conta!");
    return false;
  }

  // Recaptcha invisível
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
      'size': 'invisible'
    });
  }

  try {
    confirmationResult = await auth.signInWithPhoneNumber(phone, window.recaptchaVerifier);
    lastPhone = phone;
    showError("Código SMS enviado! Digite o código recebido.");
    window.showSMSSection();
    return true;
  } catch (error) {
    showError(error);
    return false;
  }
}

// --- CADASTRO NOVO ---
window.signUp = async function () {
  const email    = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const phone    = document.getElementById("phone").value.trim();

  if (!email || !password || !phone) {
    showError("Preencha todos os campos.");
    return;
  }

  // Se SMS ainda não enviado para esse telefone, envie
  if (!confirmationResult || lastPhone !== phone) {
    const sent = await sendSMS(phone);
    if (!sent) return;
    return; // Espera o usuário digitar código e chamar confirmSMSCode
  }

  showError("Código SMS enviado! Digite o código recebido no campo abaixo.");
};

// --- CONFIRMAR CÓDIGO SMS E FINALIZAR CADASTRO ---
window.confirmSMSCode = async function() {
  const email    = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const phone    = document.getElementById("phone").value.trim();
  const code     = document.getElementById("smsCode").value.trim();

  if (!code || code.length < 6) {
    showError("Digite o código recebido por SMS.");
    return;
  }

  try {
    // Confirma o código SMS
    await confirmationResult.confirm(code);

    // Obter fingerprint
    const fingerprint = await getFingerprint();
    if (!fingerprint) {
      showError("Erro ao identificar seu navegador. Tente novamente.");
      return;
    }

    // Checar se já tem cadastro com essa fingerprint
    const fpQuery = await db.collection("fingerprints").doc(fingerprint).get();
    if (fpQuery.exists) {
      showError("Você já criou uma conta gratuita neste navegador. Faça login ou assine o plano Plus.");
      return;
    }

    // Checar se telefone já cadastrado
    const phoneSnap = await db.collection("phones").doc(phone).get();
    if (phoneSnap.exists) {
      showError("Esse telefone já está cadastrado em outra conta!");
      return;
    }

    // Criar usuário
    const result = await auth.createUserWithEmailAndPassword(email, password);

    // Salvar fingerprint e telefone
    await db.collection("fingerprints").doc(fingerprint).set({
      email: email,
      phone: phone,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection("phones").doc(phone).set({
      email: email,
      fingerprint: fingerprint,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showError("Cadastro realizado com sucesso! Faça login para acessar a plataforma.");
    await auth.signOut();

    // Reabilitar botão cadastrar e esconder seção SMS
    const signUpBtn = document.getElementById('signUpBtn');
    if (signUpBtn) {
      signUpBtn.disabled = false;
    }
    const smsSection = document.getElementById('sms-section');
    if (smsSection) {
      smsSection.style.display = 'none';
    }

  } catch (error) {
    showError(error);
    console.error(error);
  }
};

window.register = window.signUp;

// LOGOUT
window.logout = async function () {
  try { await auth.signOut(); } catch (e) {}
  localStorage.removeItem("user");
  localStorage.removeItem("idToken");
  window.location.href = "login.html";
};

// VERIFICA SESSÃO
auth.onAuthStateChanged(async (user) => {
  const isLoginPage = window.location.pathname.includes("login.html");
  if (!user && !isLoginPage) window.location.href = "login.html";
  if (user && isLoginPage) window.location.href = "index.html";
  if (user) {
    const idToken = await user.getIdToken();
    localStorage.setItem("idToken", idToken);
  }
});
