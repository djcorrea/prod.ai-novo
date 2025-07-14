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

const firebaseErrorsPt = {
  'auth/invalid-phone-number': 'Número de telefone inválido. Use o formato +55 DDD + número.',
  'auth/missing-phone-number': 'Digite seu número de telefone.',
  'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
  'auth/quota-exceeded': 'Limite de SMS excedido. Tente novamente mais tarde.',
  'auth/user-disabled': 'Usuário desativado.',
  'auth/code-expired': 'O código expirou. Solicite um novo.',
  'auth/invalid-verification-code': 'Código de verificação inválido.',
  'auth/captcha-check-failed': 'Não foi possível validar este número. Certifique-se de que digitou corretamente, com DDD e sem espaços.',
  'auth/network-request-failed': 'Falha de conexão com a internet.',
  'auth/app-not-authorized': 'App não autorizado. Verifique as configurações do Firebase.',
  'auth/session-expired': 'Sessão expirada. Tente novamente.',
  'auth/invalid-verification-id': 'Falha na verificação. Tente novamente.',
  'auth/email-already-in-use': 'Esse e-mail já está cadastrado. Faça login ou recupere sua senha.',
  'auth/invalid-email': 'E-mail inválido. Digite um e-mail válido.',
  'auth/wrong-password': 'Senha incorreta.',
  'auth/user-not-found': 'Usuário não encontrado.',
  'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
};

function showMessage(messageOrError, type = "error") {
  const msg = typeof messageOrError === 'object' && messageOrError.code
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

async function getFingerprint() {
  if (window.FingerprintJS) {
    const fpPromise = FingerprintJS.load();
    const fp = await fpPromise;
    const result = await fp.get();
    return result.visitorId;
  }
  return null;
}

let confirmationResult = null;
let lastPhone = "";

window.showSMSSection = function () {
  const smsSection = document.getElementById('sms-section');
  if (smsSection) smsSection.style.display = 'block';

  const signUpBtn = document.getElementById('signUpBtn');
  if (signUpBtn) signUpBtn.disabled = true;
};

window.login = async function () {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  try {
    const result = await auth.signInWithEmailAndPassword(email, password);
    const idToken = await result.user.getIdToken();
    localStorage.setItem("user", JSON.stringify(result.user));
    localStorage.setItem("idToken", idToken);
    window.location.href = "index.html";
  } catch (error) {
    showMessage(error, "error");
    console.error(error);
  }
};

window.forgotPassword = async function () {
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

async function sendSMS(phone) {
  const phoneSnap = await db.collection("phones").doc(phone).get();
  if (phoneSnap.exists) {
    showMessage("Esse telefone já está cadastrado em outra conta!", "error");
    return false;
  }

  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
      'size': 'invisible'
    });
  }

  try {
    confirmationResult = await auth.signInWithPhoneNumber(phone, window.recaptchaVerifier);
    lastPhone = phone;
    showMessage("Código SMS enviado! Digite o código recebido.", "success");
    window.showSMSSection();
    return true;
  } catch (error) {
    showMessage(error, "error");
    return false;
  }
}

window.signUp = async function () {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const phone = document.getElementById("phone").value.trim();

  if (!email || !password || !phone) {
    showMessage("Preencha todos os campos.", "error");
    return;
  }

  if (!confirmationResult || lastPhone !== phone) {
    const sent = await sendSMS(phone);
    if (!sent) return;
    return;
  }

  showMessage("Código SMS enviado! Digite o código recebido no campo abaixo.", "success");
};

window.confirmSMSCode = async function () {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const code = document.getElementById("smsCode").value.trim();

  if (!code || code.length < 6) {
    showMessage("Digite o código recebido por SMS.", "error");
    return;
  }

  try {
    await confirmationResult.confirm(code);

    const fingerprint = await getFingerprint();
    if (!fingerprint) {
      showMessage("Erro ao identificar seu navegador. Tente novamente.", "error");
      return;
    }

    const fpQuery = await db.collection("fingerprints").doc(fingerprint).get();
    if (fpQuery.exists) {
      showMessage("Você já criou uma conta gratuita neste navegador.", "error");
      return;
    }

    const phoneSnap = await db.collection("phones").doc(phone).get();
    if (phoneSnap.exists) {
      showMessage("Esse telefone já está cadastrado em outra conta!", "error");
      return;
    }

    const result = await auth.createUserWithEmailAndPassword(email, password);
    const uid = result.user.uid;

    await db.collection("usuarios").doc(uid).set({
      uid: uid,
      email: email,
      plano: "gratis",
      mensagensHoje: 0,
      ultimaData: new Date().toISOString().split('T')[0],
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

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

    showMessage("Cadastro realizado com sucesso! Faça login para acessar a plataforma.", "success");
    await auth.signOut();

    const signUpBtn = document.getElementById('signUpBtn');
    if (signUpBtn) signUpBtn.disabled = false;

    const smsSection = document.getElementById('sms-section');
    if (smsSection) smsSection.style.display = 'none';

  } catch (error) {
    showMessage(error, "error");
    console.error(error);
  }
};

window.register = window.signUp;

window.logout = async function () {
  try { await auth.signOut(); } catch (e) {}
  localStorage.removeItem("user");
  localStorage.removeItem("idToken");
  window.location.href = "login.html";
};

function checkAuthState() {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      const isLoginPage = window.location.pathname.includes("login.html");
      if (!isLoginPage) window.location.href = "login.html";
      resolve(null);
    }, 5000);

    auth.onAuthStateChanged(async (user) => {
      clearTimeout(timeout);
      const isLoginPage = window.location.pathname.includes("login.html");

      if (!user && !isLoginPage) {
        window.location.href = "login.html";
      } else if (user && isLoginPage) {
        window.location.href = "index.html";
      } else if (user) {
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

waitForFirebase().then(() => {
  checkAuthState();
});

document.addEventListener("DOMContentLoaded", function () {
  const forgot = document.getElementById("forgotPasswordLink");
  if (forgot) {
    forgot.addEventListener("click", function (e) {
      e.preventDefault();
      window.forgotPassword();
    });
  }
});
