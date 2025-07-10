// auth.js

// 🛠️ Inicialização do Firebase (com storageBucket corrigido)
const firebaseConfig = {
  apiKey:            "AIzaSyBKby0RdIOGorhrfBRMCWnL25peU3epGTw",
  authDomain:        "prodai-58436.firebaseapp.com",
  projectId:         "prodai-58436",
  storageBucket:     "prodai-58436.appspot.com",      // <— alterado aqui
  messagingSenderId: "801631191322",
  appId:             "1:801631191322:web:80e3d29cf7468331652ca3",
  measurementId:     "G-MBDHDYN6Z0"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// 🔐 LOGIN
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
    alert("Erro ao fazer login: " + error.message);
    console.error(error);
  }
};

// 👤 REGISTRO
window.register = async function () {
  const email    = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  try {
    const result  = await auth.createUserWithEmailAndPassword(email, password);
    const idToken = await result.user.getIdToken();
    localStorage.setItem("user", JSON.stringify(result.user));
    localStorage.setItem("idToken", idToken);
    window.location.href = "index.html";
  } catch (error) {
    alert("Erro ao cadastrar: " + error.message);
    console.error(error);
  }
};

// 🔓 LOGOUT
window.logout = async function () {
  await auth.signOut();
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
    window.location.href = "index.html";
  }

  if (user) {
    const idToken = await user.getIdToken();
    localStorage.setItem("idToken", idToken);
  }
});
