// ============================================================
// admin.js
// Admin panel — David only.
// Allows setting the starting balance and resetting purchases.
// The HTML already blocks non-David users before this runs.
// ============================================================

import { db } from './firebase.js';
import { showAlert, showConfirm } from './modal.js';
import { doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const startingBalanceRef = doc(db, 'Saldo', 'StartingBalance');
const purchasesRef       = doc(db, 'Saldo', 'Purchases');

const currentBalanceEl  = document.getElementById('currentStartingBalance');
const newBalanceInput   = document.getElementById('newBalanceInput');
const balanceForm       = document.getElementById('balanceForm');
const resetBtn          = document.getElementById('resetPurchasesBtn');
const feedbackEl        = document.getElementById('adminFeedback');

// ── Helpers ───────────────────────────────────────────────────

function formatAmount(value) {
    if (typeof value !== 'number' || isNaN(value)) value = 0;
    return value.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function showFeedback(message, isError) {
    feedbackEl.textContent   = message;
    feedbackEl.style.display = 'block';
    feedbackEl.className     = isError ? 'profile-feedback profile-feedback-error'
                                       : 'profile-feedback profile-feedback-ok';
    setTimeout(() => { feedbackEl.style.display = 'none'; }, 4000);
}

// ── Load current starting balance ─────────────────────────────

onSnapshot(startingBalanceRef, (snap) => {
    const amount = snap.exists() ? (snap.data().Amount || 0) : 0;
    if (currentBalanceEl) currentBalanceEl.textContent = formatAmount(amount) + ' kr';
});

// ── Update starting balance ───────────────────────────────────

balanceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseFloat(newBalanceInput.value);
    if (isNaN(amount)) { showFeedback('Ange ett giltigt belopp.', true); return; }

    const submitBtn = balanceForm.querySelector('button[type="submit"]');
    submitBtn.disabled    = true;
    submitBtn.textContent = 'Sparar…';

    await setDoc(startingBalanceRef, { Amount: amount });

    submitBtn.disabled    = false;
    submitBtn.textContent = 'Uppdatera startsaldo';
    newBalanceInput.value = '';
    showFeedback(`Startsaldo uppdaterat till ${formatAmount(amount)} kr ✓`, false);
});

// ── Reset all purchases ───────────────────────────────────────

resetBtn.addEventListener('click', async () => {
    const confirmed = await showConfirm('Detta raderar ALLA utgifter permanent. Kan inte ångras.', 'Nollställ månaden', 'Rensa allt', 'danger');
    if (!confirmed) return;

    resetBtn.disabled    = true;
    resetBtn.textContent = 'Rensar…';

    await setDoc(purchasesRef, { entries: [] });

    resetBtn.disabled    = false;
    resetBtn.textContent = 'Rensa alla utgifter';
    showFeedback('Alla utgifter har raderats ✓', false);
});