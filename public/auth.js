// auth.js

// Inicialização do Firebase (só inicializa uma vez)
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
const db = firebase.firestore(); // Adiciona acesso ao Firestore

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
    return result.visitorId; // fingerprint único do navegador
  }
  return null;
}

// 🔐 LOGIN
window.login = async function () {
  const email    = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  try {
    const result  = await auth.signInWithEmailAndPassword(email, password);

    // Checa se o email foi verificado
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
    // Obter o fingerprint antes de cadastrar
    const fingerprint = await getFingerprint();

    if (!fingerprint) {
      showError("Erro ao identificar seu navegador. Tente novamente.");
      return;
    }

    // Consulta no Firestore para ver se já existe esse fingerprint
    const fpQuery = await db.collection("fingerprints").doc(fingerprint).get();

    if (fpQuery.exists) {
      showError(
        "Você já criou uma conta gratuita neste navegador. Faça login ou assine o plano Plus para criar outra conta."
      );
      return;
    }

    // Se não existe, prossegue com o cadastro
    const result  = await auth.createUserWithEmailAndPassword(email, password);

    // Salva o fingerprint no Firestore (coleção 'fingerprints', doc = fingerprint)
    await db.collection("fingerprints").doc(fingerprint).set({
      email: email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Envia e-mail de verificação
    await result.user.sendEmailVerification({
      url: 'https://prod-ai-novo.vercel.app/login.html',
      handleCodeInApp: false,
      locale: 'pt'
    });

    showError(
      "Cadastro realizado! Um e-mail de confirmação foi enviado. Verifique sua caixa de entrada (e spam). Só será possível acessar após confirmar seu e-mail."
    );

    await auth.signOut(); // Força sair para impedir acesso sem confirmação
  } catch (error) {
    showError("Erro ao cadastrar: " + error.message);
    console.error(error);
  }
};

window.register = window.signUp;

window.logout = async function () {
  await auth.signOut();
  localStorage.removeItem("user");
  localStorage.removeItem("idToken");
  window.location.href = "login.html";
};

auth.onAuthStateChanged(async (user) => {
  const isLoginPage = window.location.pathname.includes("login.html");
  if (!user && !isLoginPage) {
    return window.location.href = "login.html";
  }
  if (user && isLoginPage) {
    if (!user.emailVerified) {
      showError("⚠️ Confirme seu e-mail antes de acessar!");
      await auth.signOut();
      return;
    }
    return window.location.href = "index.html";
  }
  if (user) {
    const idToken = await user.getIdToken();
    localStorage.setItem("idToken", idToken);
  }
});
