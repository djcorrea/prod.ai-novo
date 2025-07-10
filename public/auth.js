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

// 🔐 LOGIN
window.login = async function () {
  const email    = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  try {
    const result  = await auth.signInWithEmailAndPassword(email, password);

    // Não faz checagem de e-mail verificado!

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
    // 1. Obter fingerprint do navegador
    const fingerprint = await getFingerprint();
    console.log("Fingerprint:", fingerprint); // <-- Debug aqui!

    if (!fingerprint) {
      showError("Erro ao identificar seu navegador. Tente novamente.");
      return;
    }

    // 2. Checa se fingerprint já está cadastrada
    const fpQuery = await db.collection("fingerprints").doc(fingerprint).get();

    if (fpQuery.exists) {
      showError(
        "Você já criou uma conta gratuita neste navegador. Faça login ou assine o plano Plus para criar outra conta."
      );
      return;
    }

    // 3. Cria o usuário (autentica para liberar gravação)
    const result  = await auth.createUserWithEmailAndPassword(email, password);

    // 4. Salva fingerprint no Firestore
    await db.collection("fingerprints").doc(fingerprint).set({
      email: email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 5. Mostra mensagem de sucesso
    showError(
      "Cadastro realizado com sucesso! Faça login para acessar a plataforma."
    );

    // 6. Faz signOut só por segurança (opcional)
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
    // Não há checagem de e-mail verificado aqui!
    window.location.href = "index.html";
  }
  if (user) {
    const idToken = await user.getIdToken();
    localStorage.setItem("idToken", idToken);
  }
});
