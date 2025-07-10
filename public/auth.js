// auth.js

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

// Função para obter o IP público do usuário
async function getIP() {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    return data.ip;
  } catch {
    return null;
  }
}

// 🔐 LOGIN
window.login = async function () {
  const email    = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  try {
    const result  = await auth.signInWithEmailAndPassword(email, password);

    if (!result.user.emailVerified) {
      showError("⚠️ Por favor, confirme seu e-mail antes de acessar. Verifique sua caixa de entrada (e spam).");
      await auth.signOut();
      return;
    }

    const idToken = await result.user.getIdToken();
    localStorage.setItem("user", JSON.stringify(result.user));
    localStorage.setItem("idToken", idToken);
    window.location.href = "index.html";
  } catch (error) {
    showError("Erro ao fazer login: " + error.message);
    console.error(error);
  }
};

// 👤 REGISTRO
window.signUp = async function () {
  const email    = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  try {
    // 1. Obter fingerprint e IP
    const fingerprint = await getFingerprint();
    const ip = await getIP();

    if (!fingerprint || !ip) {
      showError("Erro ao identificar seu navegador ou rede. Tente novamente.");
      return;
    }

    // 2. Checa se fingerprint OU IP já estão cadastrados (leitura permitida a todos)
    const fpQuery = await db.collection("fingerprints").doc(fingerprint).get();
    const ipQuery = await db.collection("ips").doc(ip).get();

    if (fpQuery.exists || ipQuery.exists) {
      showError(
        "Você já criou uma conta gratuita neste dispositivo ou nesta rede. Faça login ou assine o plano Plus para criar outra conta."
      );
      return;
    }

    // 3. Cria o usuário (autentica para liberar gravação)
    const result  = await auth.createUserWithEmailAndPassword(email, password);

    // 4. Salva fingerprint e IP (agora permitido pelas regras de produção)
    await db.collection("fingerprints").doc(fingerprint).set({
      email: email,
      ip: ip,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection("ips").doc(ip).set({
      email: email,
      fingerprint: fingerprint,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 5. Envia e-mail de verificação (mas pode cair no spam/ser bloqueado por limite!)
    try {
      await result.user.sendEmailVerification({
        url: 'https://prod-ai-novo.vercel.app/login.html',
        handleCodeInApp: false,
        locale: 'pt'
      });
      showError(
        "Cadastro realizado! Um e-mail de confirmação foi enviado. Verifique sua caixa de entrada (e spam). Só será possível acessar após confirmar seu e-mail."
      );
    } catch (err) {
      showError("Cadastro realizado, mas não foi possível enviar o e-mail de confirmação: " + (err.message || err));
    }

    // 6. Faz signOut para impedir login sem verificação
    await auth.signOut();

  } catch (error) {
    showError("Erro ao cadastrar: " + error.message);
    console.error(error);
  }
};

window.register = window.signUp;

// 🔓 LOGOUT
window.logout = async function () {
  try {
    await auth.signOut();
  } catch (e) {}
  localStorage.removeItem("user");
  localStorage.removeItem("idToken");
  window.location.href = "login.html";
};

// 🔄 VERIFICAÇÃO DE SESSÃO
auth.onAuthStateChanged(async (user) => {
  const isLoginPage = window.location.pathname.includes("login.html");
  if (!user && !isLoginPage) {
    window.location.href = "login.html";
  }
  if (user && isLoginPage) {
    if (!user.emailVerified) {
      showError("⚠️ Confirme seu e-mail antes de acessar!");
      await auth.signOut();
      return;
    }
    window.location.href = "index.html";
  }
  if (user) {
    const idToken = await user.getIdToken();
    localStorage.setItem("idToken", idToken);
  }
});
