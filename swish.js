import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDeUOT-hWKgAnAtlwRFujoOpJNDP_WljoE",
  authDomain: "polhemsgatan17b.firebaseapp.com",
  projectId: "polhemsgatan17b",
  messagingSenderId: "330775555909",
  appId: "1:330775555909:web:e644773610112ef007182c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Phone book
const roommates = {
  David: "0723313868",
  Julius: "0706848252",
  Alvin: "0727164423"
};

const meSelect = document.getElementById('meSelect');
const receiverSelect = document.getElementById('receiverSelect');
const amountText = document.getElementById('amountText');
const payBtn = document.getElementById('payBtn');

let debts = [];

// Populate "me"
Object.keys(roommates).forEach(name => {
  const opt = document.createElement('option');
  opt.value = name;
  opt.textContent = name;
  meSelect.appendChild(opt);
});

// Load debts
const debtsRef = doc(db, 'Saldo', 'Debts');
onSnapshot(debtsRef, snap => {
  debts = snap.exists() ? snap.data().entries || [] : [];
  updateUI();
});

meSelect.addEventListener('change', updateUI);
receiverSelect.addEventListener('change', updateUI);

function updateUI() {
  const me = meSelect.value;
  if (!me) return;

  const owed = debts.filter(d => d.from === me);

  receiverSelect.innerHTML = '';
  let total = 0;

  owed.forEach(d => {
    total += d.amount;

    if (![...receiverSelect.options].some(o => o.value === d.to)) {
      const opt = document.createElement('option');
      opt.value = d.to;
      opt.textContent = d.to;
      receiverSelect.appendChild(opt);
    }
  });

  amountText.textContent = total.toFixed(2);
}

payBtn.addEventListener('click', () => {
  const me = meSelect.value;
  const to = receiverSelect.value;
  const amount = parseFloat(amountText.textContent);

  if (!to || amount <= 0) {
    alert('Ingen skuld att betala');
    return;
  }

  openSwish(roommates[to], amount);
});

function openSwish(phone, amount) {
  const swishData = {
    version: 1,
    payee: { value: phone.replace(/^0/, '+46') },
    amount: { value: Math.round(amount) },
    message: { value: 'Skuld' }
  };

  window.location.href =
    'swish://payment?data=' +
    encodeURIComponent(JSON.stringify(swishData));
}
