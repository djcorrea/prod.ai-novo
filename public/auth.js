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
  'auth/invalid-phone-number':         'Número de telefone inválido. Use o formato +55 DDD + número.',
  'auth/missing-phone-number':         'Digite seu número de telefone.',
  'auth/too-many-requests':            'Muitas tentativas. Tente novamente mais tarde.',
  'auth/quota-exceeded':               'Limite de SMS excedido. Tente novamente mais tarde.',
  'auth/user-disabled':                'Usuário desativado.',
  'auth/code-expired':                 'O código expirou. Solicite um novo.',
  'auth/invalid-verification-code':    'Código de verificação inválido.',
  'auth/captcha-check-failed':         'Não foi possível validar este número.',
  'auth/network-request-failed':       'Falha de conexão com a internet.',
  'auth/app-not-authorized':           'App não autorizado.',
  'auth/session-expired':              'Sessão expirada. Tente novamente.',
  'auth/invalid-verification-id':      'Falha na verificação.',
  'auth/email-already-in-use':         'Esse e-mail já está cadastrado.',
  'auth/invalid-email':                'E-mail inválido.',
  'auth/wrong-password':               'Senha incorreta.',
  'auth/user-not-found':               'Usuário não encontrado.',
  'auth/weak-password':                'A senha deve ter pelo menos 6 caracteres.'
};

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

window.showSMSSection = function() {
  const smsSection = document.getElementById('sms-section');
  if (smsSection) smsSection.style.display = 'block';
  const signUpBtn = document.getElementById('signUpBtn');
  if (signUpBtn) signUpBtn.disabled = true;
};

window.login = async function () {
  const email    = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  try {
    const result  = await auth.signInWithEmailAndPassword(email, password);
    const idToken = await result.user.getIdToken();
    localStorage.setItem("user", JSON.stringify(result.user));
    localStorage.setItem("idToken", idToken);
    window.location.href = "index.html"; // ✅ Redireciona para o chatbot
  } catch (error) {
    showMessage(error, "error");
    console.error(error);
  }
};

window.forgotPassword = async function() {
  const email = document.getElementById("email").value.trim();
  if (!email) return showMessage("Digite seu e-mail para recuperar a senha.", "error");

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
  const email    = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const phone    = document.getElementById("phone").value.trim();

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
    await confirmationResult.confirm(code);

    const fingerprint = await getFingerprint();
    if (!fingerprint) return showMessage("Erro ao identificar seu navegador.", "error");

    const fpQuery = await db.collection("fingerprints").doc(fingerprint).get();
    if (fpQuery.exists) {
      showMessage("Você já criou uma conta gratuita neste navegador. Faça login ou assine o plano Plus.", "error");
      return;
    }

    const phoneSnap = await db.collection("phones").doc(phone).get();
    if (phoneSnap.exists) {
      showMessage("Esse telefone já está cadastrado em outra conta!", "error");
      return;
    }

    const result = await auth.createUserWithEmailAndPassword(email, password);

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

auth.onAuthStateChanged(async (user) => {
  const isLoginPage = window.location.pathname.includes("login.html");
  if (!user && !isLoginPage) window.location.href = "login.html";
  if (user && isLoginPage) window.location.href = "index.html"; // ✅ Garantido redirecionamento correto
  if (user) {
    const idToken = await user.getIdToken();
    localStorage.setItem("idToken", idToken);
  }
});

document.addEventListener("DOMContentLoaded", function() {
  const forgot = document.getElementById("forgotPasswordLink");
  if (forgot) {
    forgot.addEventListener("click", function(e) {
      e.preventDefault();
      window.forgotPassword();
    });
  }
});
