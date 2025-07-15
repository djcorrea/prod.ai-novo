// auth.js - CORRIGIDO

// Função necessária para aguardar o Firebase carregar corretamente
function waitForFirebase() {
  return new Promise((resolve) => {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      resolve();
    } else {
      const checkFirebase = setInterval(() => {
        if (typeof firebase !== 'undefined' && firebase.auth) {
          clearInterval(checkFirebase);
          resolve();
        }
      }, 100);
    }
  });
}

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
  'auth/captcha-check-failed':         'Não foi possível validar este número. Certifique-se de que digitou corretamente, com DDD e sem espaços. Isso pode acontecer se o número não existir, estiver errado ou se houver erro no reCAPTCHA.',
  'auth/network-request-failed':       'Falha de conexão com a internet.',
  'auth/app-not-authorized':           'App não autorizado. Verifique as configurações do Firebase.',
  'auth/session-expired':              'Sessão expirada. Tente novamente.',
  'auth/invalid-verification-id':      'Falha na verificação. Tente novamente.',
  'auth/email-already-in-use':         'Esse e-mail já está cadastrado. Faça login ou recupere sua senha.',
  'auth/invalid-email':                'E-mail inválido. Digite um e-mail válido.',
  'auth/wrong-password':               'Senha incorreta.',
  'auth/user-not-found':               'Usuário não encontrado. Verifique o e-mail e tente novamente.',
  'auth/weak-password':                'A senha deve ter pelo menos 6 caracteres.',
};

// Função para exibir mensagem de sucesso ou erro
function showMessage(messageOrError, type = "error") {
  let msg = typeof messageOrError === 'object' && messageOrError.code
    ? (firebaseErrorsPt[messageOrError.code] || messageOrError.message || 'Erro desconhecido.')
    : messageOrError;

  const el = document.getElementById("error-message");
  if (el) {
    el.innerText = msg;
    el.style.display = "block";
    el.classList.remove("error-message", "success-message");
    el.classList.add(type === "success" ? "success-message" : "error-message");
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

// Validação de telefone
function validatePhone(phone) {
  const cleanPhone = phone.replace(/\s+/g, '').replace(/[^\d+]/g, '');
  const phoneRegex = /^\+55\d{10,11}$/;
  
  if (!phoneRegex.test(cleanPhone)) {
    return false;
  }
  
  return cleanPhone;
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
    showMessage(error, "error");
    console.error(error);
  }
};

// --- ESQUECI A SENHA ---
window.forgotPassword = async function() {
  const email = document.getElementById("email").value.trim();
  if (!email) {
    showMessage("Digite seu e-mail para recuperar a senha.", "error");
    return;
  }
  try {
    await auth.sendPasswordResetEmail(email);
    showMessage("Enviamos um link de redefinição de senha para seu e-mail.", "success");
  } catch (error) {
    showMessage(error, "error");
  }
};

// Função para enviar SMS - CORRIGIDA
async function sendSMS(phone) {
  const validPhone = validatePhone(phone);
  if (!validPhone) {
    showMessage("Número inválido. Use: +55 + DDD + número (ex: +5511987654321)", "error");
    return false;
  }


  // Limpar reCAPTCHA anterior se existir
  if (window.recaptchaVerifier) {
    try {
      window.recaptchaVerifier.clear();
    } catch (e) {
      console.log("Erro ao limpar reCAPTCHA:", e);
    }
    window.recaptchaVerifier = null;
  }

  // Criar novo reCAPTCHA
  window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
    'size': 'invisible',
    'callback': (response) => {
      console.log("reCAPTCHA verificado");
    },
    'expired-callback': () => {
      console.log("reCAPTCHA expirado");
    }
  });

  try {
    confirmationResult = await auth.signInWithPhoneNumber(validPhone, window.recaptchaVerifier);
    lastPhone = validPhone;
    showMessage("Código SMS enviado! Digite o código recebido.", "success");
    window.showSMSSection();
    return true;
  } catch (error) {
    console.error("Erro SMS:", error);
    showMessage(error, "error");
    return false;
  }
}

// --- CADASTRO NOVO ---
window.signUp = async function () {
  const email    = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const phone    = document.getElementById("phone").value.trim();

  if (!email || !password || !phone) {
    showMessage("Preencha todos os campos.", "error");
    return;
  }

  // Se SMS ainda não enviado para esse telefone, envie
  if (!confirmationResult || lastPhone !== phone) {
    const sent = await sendSMS(phone);
    if (!sent) return;
    return; // Espera o usuário digitar código e chamar confirmSMSCode
  }

  showMessage("Código SMS enviado! Digite o código recebido no campo abaixo.", "success");
};

// --- CONFIRMAR CÓDIGO SMS E FINALIZAR CADASTRO - CORRIGIDA ---
window.confirmSMSCode = async function() {
  const email    = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const phone    = document.getElementById("phone").value.trim();
  const code     = document.getElementById("smsCode").value.trim();

  if (!code || code.length < 6) {
    showMessage("Digite o código recebido por SMS.", "error");
    return;
  }

  try {
    const phoneCred = firebase.auth.PhoneAuthProvider.credential(confirmationResult.verificationId, code);
    const phoneUser = await auth.signInWithCredential(phoneCred);

    const emailCred = firebase.auth.EmailAuthProvider.credential(email, password);
    await phoneUser.user.linkWithCredential(emailCred);

    const fingerprint = await getFingerprint();
    if (fingerprint) {
      const functions = firebase.app().functions();
      try {
        await functions.httpsCallable('registerAccount')({ fingerprint, phone });
      } catch (e) {
        showMessage(e.message || 'Erro ao registrar dados', 'error');
        return;
      }
    }

    const idToken = await phoneUser.user.getIdToken();
    localStorage.setItem("idToken", idToken);
    localStorage.setItem("user", JSON.stringify({ uid: phoneUser.user.uid, email: phoneUser.user.email }));
    showMessage("Cadastro realizado com sucesso!", "success");

    const signUpBtn = document.getElementById('signUpBtn');
    if (signUpBtn) signUpBtn.disabled = false;
    const smsSection = document.getElementById('sms-section');
    if (smsSection) smsSection.style.display = 'none';

  } catch (error) {
    console.error("Erro no cadastro:", error);
    showMessage(error, "error");
  }
};

window.register = window.signUp;

// LOGOUT - CORRIGIDA
window.logout = async function () {
  try { 
    await auth.signOut(); 
    console.log("Logout realizado com sucesso");
  } catch (e) {
    console.error("Erro no logout:", e);
  }
  
  // Limpar dados locais
  localStorage.removeItem("user");
  localStorage.removeItem("idToken");
  
  // Redirecionar para login
  setTimeout(() => {
    window.location.href = "login.html";
  }, 100);
};

// VERIFICA SESSÃO COM TIMEOUT
function checkAuthState() {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.log('Timeout na verificação de auth');
      const isLoginPage = window.location.pathname.includes("login.html");
      if (!isLoginPage) {
        window.location.href = "login.html";
      }
      resolve(null);
    }, 5000);

    auth.onAuthStateChanged(async (user) => {
      clearTimeout(timeout);
      const isLoginPage = window.location.pathname.includes("login.html");

      console.log('Auth state changed:', user ? 'logged in' : 'not logged in');

      if (!user && !isLoginPage) {
        console.log('Usuário não logado, redirecionando para login');
        window.location.href = "login.html";
      } else if (user && isLoginPage) {
        console.log('Usuário logado, redirecionando para index');
        window.location.href = "index.html";
      } else if (user) {
        console.log('Usuário autenticado:', user.email);
        try {
          const idToken = await user.getIdToken();
          localStorage.setItem("idToken", idToken);
          localStorage.setItem("user", JSON.stringify({
            uid: user.uid,
            email: user.email
          }));
        } catch (error) {
          console.error('Erro ao obter token:', error);
        }
      }
      
      resolve(user);
    });
  });
}

// Inicializa verificação de auth quando Firebase carrega
waitForFirebase().then(() => {
  checkAuthState();
});

// EVENTO PARA "ESQUECI A SENHA"
document.addEventListener("DOMContentLoaded", function() {
  const forgot = document.getElementById("forgotPasswordLink");
  if (forgot) {
    forgot.addEventListener("click", function(e) {
      e.preventDefault();
      window.forgotPassword();
    });
  }
  
  // Remove classe loading do body se existir
  const body = document.body;
  if (body && body.classList) {
    body.classList.remove("loading");
  }
});