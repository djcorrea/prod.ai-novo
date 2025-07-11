const firebaseConfig = {
  apiKey:            "AIzaSyBKby0RdIOGorhrfBRMCWnL25peU3epGTw",
  authDomain:        "prodai-58436.firebaseapp.com",
  projectId:         "prodai-58436",
  storageBucket:     "prodai-58436.appspot.com",
  messagingSenderId: "801631191322",
  appId:             "1:801631191322:web:80e3d29cf7468331652ca3",
  measurementId:     "G-MBDHDYN6Z0"
};
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

function showError(message) {
  const el = document.getElementById("error-message");
  if (el) {
    el.innerText = message;
    el.style.display = "block";
  } else {
    alert(message);
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

// (Usado se quiser botão isolado para enviar SMS. Pode remover se for automático no signUp)
// window.enviarSMS = async function () {...}

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
    showError("Erro ao fazer login: " + error.message);
    console.error(error);
  }
};

// --- CADASTRO NOVO ---
window.signUp = async function () {
  const email    = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const phone    = document.getElementById("phone").value.trim();
  const code     = document.getElementById("smsCode").value.trim();

  if (!email || !password || !phone) {
    showError("Preencha todos os campos.");
    return;
  }
  // Verifica se o SMS já foi enviado e se o código foi preenchido
  if (!confirmationResult || lastPhone !== phone) {
    // Envia SMS na primeira chamada
    try {
      // Checa se telefone já existe
      const phoneSnap = await db.collection("phones").doc(phone).get();
      if (phoneSnap.exists) {
        showError("Esse telefone já está cadastrado em outra conta!");
        return;
      }

      // Recaptcha invisível
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
          'size': 'invisible'
        });
      }
      confirmationResult = await auth.signInWithPhoneNumber(phone, window.recaptchaVerifier);
      lastPhone = phone;
      showError("Código SMS enviado! Digite o código recebido.");
      document.getElementById("smsCode").style.display = "";
      return;
    } catch (error) {
      showError("Erro ao enviar SMS: " + (error.message || error));
      document.getElementById("smsCode").style.display = "none";
      return;
    }
  }
  if (!code || code.length < 6) {
    showError("Digite o código recebido por SMS.");
    return;
  }

  try {
    // 1. Confirma o código SMS
    await confirmationResult.confirm(code);

    // 2. Fingerprint
    const fingerprint = await getFingerprint();
    if (!fingerprint) {
      showError("Erro ao identificar seu navegador. Tente novamente.");
      return;
    }

    // 3. Checa se fingerprint já cadastrada
    const fpQuery = await db.collection("fingerprints").doc(fingerprint).get();
    if (fpQuery.exists) {
      showError("Você já criou uma conta gratuita neste navegador. Faça login ou assine o plano Plus.");
      return;
    }

    // 4. Cria usuário
    const result = await auth.createUserWithEmailAndPassword(email, password);

    // 5. Salva fingerprint e telefone
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

  } catch (error) {
    showError("Erro ao cadastrar: " + (error.message || error));
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
