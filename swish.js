// ============================================================
// swish.js
// Debt payment via Swish. Lets the current user:
//   • See individual unpaid debts per creditor
//   • Select one, several, or all debts to pay
//   • On confirmation: moves paid debts from entries → payments
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getFirestore, doc, onSnapshot, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDeUOT-hWKgAnAtlwRFujoOpJNDP_WljoE",
    authDomain: "polhemsgatan17b.firebaseapp.com",
    projectId: "polhemsgatan17b",
    messagingSenderId: "330775555909",
    appId: "1:330775555909:web:e644773610112ef007182c"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── Config ────────────────────────────────────────────────────

const roommates = {
    David:  "0723313868",
    Julius: "0706848252",
    Alvin:  "0727164423"
};

// ── DOM refs ──────────────────────────────────────────────────

const meSelect       = document.getElementById('meSelect');
const receiverSelect = document.getElementById('receiverSelect');
const amountText     = document.getElementById('amountText');
const payBtn         = document.getElementById('payBtn');
const debtItemsList  = document.getElementById('debtItemsList');
const noDebtMsg      = document.getElementById('swishNoDebt');

// ── State ─────────────────────────────────────────────────────

let allDebts = [];   // Debts/entries
let payments = [];   // Debts/payments

const debtsRef = doc(db, 'Saldo', 'Debts');

// ── Populate "me" select ──────────────────────────────────────

Object.keys(roommates).forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    meSelect.appendChild(opt);
});

// Set to current logged-in user
const currentUser = localStorage.getItem('saldo_user') || '';
if (currentUser && meSelect.querySelector(`option[value="${currentUser}"]`)) {
    meSelect.value = currentUser;
}

// ── Firestore listener ────────────────────────────────────────

onSnapshot(debtsRef, snap => {
    allDebts = snap.exists() ? snap.data().entries  || [] : [];
    payments = snap.exists() ? snap.data().payments || [] : [];
    renderDebtItems();
});

meSelect.addEventListener('change', renderDebtItems);
receiverSelect.addEventListener('change', renderDebtItems);

// ── Get unpaid debts for current "me → receiver" ──────────────

function getMyUnpaidDebts(from, to) {
    // entries already ARE the unpaid debts (paid ones are moved to payments)
    return allDebts.filter(d => d.from === from && d.to === to);
}

function getMyCreditors(from) {
    const creditors = [...new Set(allDebts.filter(d => d.from === from).map(d => d.to))];
    return creditors;
}

// ── Update receiver dropdown ──────────────────────────────────

function updateReceivers() {
    const me = meSelect.value;
    const creditors = getMyCreditors(me);

    const prev = receiverSelect.value;
    receiverSelect.innerHTML = '';

    creditors.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        receiverSelect.appendChild(opt);
    });

    if (creditors.includes(prev)) receiverSelect.value = prev;
}

// ── Render individual debt checkboxes ─────────────────────────

function renderDebtItems() {
    updateReceivers();

    const me = meSelect.value;
    const to = receiverSelect.value;

    if (!debtItemsList) return;
    debtItemsList.innerHTML = '';

    if (!me || !to) {
        updateTotalFromSelected();
        return;
    }

    const debts = getMyUnpaidDebts(me, to);

    if (debts.length === 0) {
        if (noDebtMsg) noDebtMsg.style.display = 'block';
        if (payBtn)    payBtn.style.display     = 'none';
        updateTotalFromSelected();
        return;
    }

    if (noDebtMsg) noDebtMsg.style.display = 'none';
    if (payBtn)    payBtn.style.display     = '';

    // "Select all" header row
    const allRow = document.createElement('div');
    allRow.className = 'debt-select-all-row';
    allRow.innerHTML = `
        <label class="debt-select-label">
            <input type="checkbox" id="selectAllDebts" class="debt-checkbox" checked>
            <span>Välj alla (${debts.length} skulder)</span>
        </label>
        <span class="debt-select-total-label">Totalt</span>
    `;
    debtItemsList.appendChild(allRow);

    document.getElementById('selectAllDebts')?.addEventListener('change', (e) => {
        debtItemsList.querySelectorAll('.debt-item-checkbox').forEach(cb => {
            cb.checked = e.target.checked;
        });
        updateTotalFromSelected();
    });

    // Individual debt rows
    debts.forEach(debt => {
        const row = document.createElement('div');
        row.className = 'debt-select-row';
        row.innerHTML = `
            <label class="debt-select-label">
                <input type="checkbox" class="debt-item-checkbox debt-checkbox" data-id="${debt.id}" checked>
                <span class="debt-select-msg">${debt.message || '(ingen beskrivning)'}</span>
            </label>
            <span class="debt-select-amount">${formatAmount(debt.amount)} kr</span>
        `;
        debtItemsList.appendChild(row);

        row.querySelector('.debt-item-checkbox').addEventListener('change', () => {
            updateSelectAllState();
            updateTotalFromSelected();
        });
    });

    updateTotalFromSelected();
}

function updateSelectAllState() {
    const all  = debtItemsList.querySelectorAll('.debt-item-checkbox');
    const checked = debtItemsList.querySelectorAll('.debt-item-checkbox:checked');
    const selectAll = document.getElementById('selectAllDebts');
    if (!selectAll) return;
    selectAll.checked       = checked.length === all.length;
    selectAll.indeterminate = checked.length > 0 && checked.length < all.length;
}

function updateTotalFromSelected() {
    const me = meSelect.value;
    const to = receiverSelect.value;
    const selected = getSelectedDebts(me, to);
    const total = selected.reduce((sum, d) => sum + d.amount, 0);
    if (amountText) amountText.textContent = total.toFixed(2);
}

function getSelectedDebts(from, to) {
    const checked = debtItemsList?.querySelectorAll('.debt-item-checkbox:checked') || [];
    const ids     = [...checked].map(cb => cb.dataset.id);
    return allDebts.filter(d => d.from === from && d.to === to && ids.includes(d.id));
}

// ── Helpers ───────────────────────────────────────────────────

function formatAmount(value) {
    if (typeof value !== 'number' || isNaN(value)) return '?';
    return value.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Pay button ────────────────────────────────────────────────

payBtn?.addEventListener('click', () => {
    const me = meSelect.value;
    const to = receiverSelect.value;

    const selectedDebts = getSelectedDebts(me, to);
    const amount = selectedDebts.reduce((sum, d) => sum + d.amount, 0);

    if (selectedDebts.length === 0 || amount <= 0) {
        alert('Välj minst en skuld att betala');
        return;
    }

    const messages = selectedDebts.map(d => d.message).filter(m => m && m.trim());
    const message  = messages.length > 0 ? messages.join(' + ') : 'Betalning av skuld';

    window.pendingPayment = {
        from:    me,
        to:      to,
        amount:  amount,
        message: message,
        debts:   selectedDebts,
        timestamp: new Date().toISOString()
    };

    openSwish(roommates[to], amount, message);
    showPaymentModal(me, to, amount, message, selectedDebts);
});

function openSwish(phone, amount, message) {
    const swishData = {
        version: 1,
        payee:   { value: phone.replace(/^0/, '+46') },
        amount:  { value: Math.round(amount) },
        message: { value: message.slice(0, 50) }
    };
    window.location.href = 'swish://payment?data=' + encodeURIComponent(JSON.stringify(swishData));
}

// ── Payment modal ─────────────────────────────────────────────

function showPaymentModal(payer, receiver, totalAmount, message, debts) {
    const modal     = document.getElementById('paymentModal');
    const messageEl = document.getElementById('paymentModalMessage');
    if (!modal || !messageEl) return;

    const debtLines = debts.map(d =>
        `<li>${d.message || '(ingen beskrivning)'} — <strong>${formatAmount(d.amount)} kr</strong></li>`
    ).join('');

    messageEl.innerHTML = `
        <strong>Från:</strong> ${payer}<br>
        <strong>Till:</strong> ${receiver}<br>
        <strong>Totalt:</strong> ${formatAmount(totalAmount)} kr<br>
        <ul style="margin:10px 0 0 0;padding-left:18px;font-size:13px;color:var(--text-dim);">${debtLines}</ul>
        <br><span style="font-size:12px;color:#999;">Bekräfta att du har genomfört Swish-betalningen</span>
    `;

    modal.classList.add('active');
}

async function confirmPayment() {
    if (!window.pendingPayment) {
        alert('Ingen betalning att bekräfta');
        hidePaymentModal();
        return;
    }

    const { from, to, amount, message, debts, timestamp } = window.pendingPayment;
    const confirmBtn = document.getElementById('paymentConfirmBtn');
    if (confirmBtn) confirmBtn.disabled = true;

    try {
        // Build payment records (one per debt, with shared payment id)
        const paymentGroupId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const paymentRecords = debts.map(d => ({
            id:        paymentGroupId + '_' + d.id,
            debtId:    d.id,
            from:      from,
            to:        to,
            amount:    d.amount,
            message:   d.message || '',
            paidAt:    timestamp
        }));

        // IDs of debts being paid
        const paidIds = new Set(debts.map(d => d.id));

        // New entries = old entries minus the paid ones
        const newEntries = allDebts.filter(d => !paidIds.has(d.id));

        // Write atomically: update entries + append payments
        await updateDoc(debtsRef, {
            entries:  newEntries,
            payments: arrayUnion(...paymentRecords)
        });

        alert('Betalning bekräftad! 🎉');
        hidePaymentModal();

    } catch (error) {
        console.error('Error confirming payment:', error);
        alert('Fel vid bekräftelse av betalning: ' + error.message);
    } finally {
        if (confirmBtn) confirmBtn.disabled = false;
    }
}

window.confirmPayment = confirmPayment;

function cancelPayment() { hidePaymentModal(); }

function hidePaymentModal() {
    document.getElementById('paymentModal')?.classList.remove('active');
    window.pendingPayment = null;
}

// Auto-expire pending payment after 5 minutes
setInterval(() => {
    if (!window.pendingPayment?.timestamp) return;
    if (Date.now() - new Date(window.pendingPayment.timestamp).getTime() > 5 * 60 * 1000) {
        hidePaymentModal();
    }
}, 30000);