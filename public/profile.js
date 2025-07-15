let currentStep = 0;
let steps;

function showStep(index) {
  steps.forEach((step, i) => {
    step.classList.toggle('active', i === index);
  });
}

function validateStep(index) {
  const step = steps[index];
  if (!step) return false;
  return !!step.querySelector('input:checked');
}

async function saveProfile() {
  if (!validateStep(currentStep)) return;
  const answers = {};
  steps.forEach(step => {
    const checked = step.querySelector('input:checked');
    if (checked) answers[checked.name] = checked.value;
  });
  try {
    await waitForFirebase();
    const user = firebase.auth().currentUser;
    if (!user) return;
    await firebase.firestore().collection('usuarios').doc(user.uid).update({ perfil: answers });
    window.location.href = 'index.html';
  } catch (e) {
    console.error('Erro ao salvar perfil', e);
  }
}

function nextStep() {
  if (!validateStep(currentStep)) return;
  currentStep++;
  if (currentStep >= steps.length) return;
  showStep(currentStep);
}

document.addEventListener('DOMContentLoaded', () => {
  steps = Array.from(document.querySelectorAll('.question-step'));
  showStep(currentStep);
  document.querySelectorAll('.next-btn').forEach(btn => btn.addEventListener('click', nextStep));
  const startBtn = document.getElementById('startBtn');
  if (startBtn) startBtn.addEventListener('click', saveProfile);
});
