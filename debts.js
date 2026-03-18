// ============================================================
// debts.js
// Shows UNPAID debts the logged-in user has added (as creditor)
// and lets them remove a debt. Also renders a "paid debts"
// history modal with green (received) / red (paid out) rows.
// ============================================================

import { db } from './firebase.js';
import { showConfirm } from './modal.js';
import { doc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { notifyDebtRemoved } from './telegram.js';

const currentUser = localStorage.getItem('saldo_user') || '';
const debtsRef    = doc(db, 'Saldo', 'Debts');

const listEl       = document.getElementById('myDebtsList');
const emptyEl      = document.getElementById('myDebtsEmpty');
const paidModalEl  = document.getElementById('paidDebtsModal');
const paidListEl   = document.getElementById('paidDebtsList');
const paidEmptyEl  = document.getElementById('paidDebtsEmpty');
const showPaidBtn  = document.getElementById('showPaidDebtsBtn');
const closePaidBtn = document.getElementById('closePaidDebtsModal');

let allDebts = [];   // Debts/entries  (unpaid)
let payments = [];   // Debts/payments (paid)

// ── Helpers ───────────────────────────────────────────────────

function formatAmount(value) {
    if (typeof value !== 'number' || isNaN(value)) return '?';
    return value.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(isoString) {
    if (!isoString) return '';
    return new Date(isoString).toLocaleString('sv-SE', {
        month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
    });
}

// ── Render unpaid debts added by current user (as creditor) ───

function renderMyDebts() {
    if (!listEl) return;
    listEl.innerHTML = '';

    const mine = allDebts.filter(d => d.to === currentUser).reverse();

    if (mine.length === 0) {
        if (emptyEl) emptyEl.style.display = 'block';
    } else {
        if (emptyEl) emptyEl.style.display = 'none';
        mine.forEach(debt => {
            const row = document.createElement('div');
            row.className = 'debt-removable-row';
            row.innerHTML = `
                <div class="debt-removable-body">
                    <span class="debt-removable-from">${debt.from} skyldig dig</span>
                    <span class="debt-removable-msg">${debt.message || ''}</span>
                    <span class="debt-removable-date">${formatDate(debt.date)}</span>
                </div>
                <div class="debt-removable-right">
                    <span class="debt-removable-amount">${formatAmount(debt.amount)} kr</span>
                    <button class="chore-delete-btn debt-remove-btn" data-id="${debt.id}" aria-label="Ta bort">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6"/><path d="M14 11v6"/>
                            <path d="M9 6V4h6v2"/>
                        </svg>
                    </button>
                </div>
            `;
            listEl.appendChild(row);
        });
    }
}

// ── Render paid debts history (colour-coded) ──────────────────

function renderPaidDebts() {
    if (!paidListEl) return;
    paidListEl.innerHTML = '';

    // Show payments involving current user, newest first
    const mine = payments
        .filter(p => p.to === currentUser || p.from === currentUser)
        .slice()
        .sort((a, b) => new Date(b.paidAt || b.date) - new Date(a.paidAt || a.date));

    if (mine.length === 0) {
        if (paidEmptyEl) paidEmptyEl.style.display = 'block';
        return;
    }
    if (paidEmptyEl) paidEmptyEl.style.display = 'none';

    mine.forEach(p => {
        const received = p.to === currentUser;   // money came IN to current user
        const row = document.createElement('div');

        // Green row = received payment, red row = sent payment
        row.className = received ? 'debt-paid-row debt-paid-row--received' : 'debt-paid-row debt-paid-row--sent';

        const direction  = received ? `${p.from} betalade dig` : `Du betalade ${p.to}`;
        const amountText = received
            ? `+${formatAmount(p.amount)} kr`
            : `−${formatAmount(p.amount)} kr`;
        const amountClass = received ? 'debt-paid-amount--received' : 'debt-paid-amount--sent';

        row.innerHTML = `
            <div class="debt-removable-body">
                <span class="debt-removable-from">${direction}</span>
                <span class="debt-removable-msg">${p.message || ''}</span>
                <span class="debt-removable-date">${formatDate(p.paidAt || p.date)}</span>
            </div>
            <div class="debt-removable-right">
                <span class="debt-paid-amount ${amountClass}">${amountText}</span>
            </div>
        `;
        paidListEl.appendChild(row);
    });
}

// ── Remove an unpaid debt ─────────────────────────────────────

listEl?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.debt-remove-btn');
    if (!btn) return;

    const id   = btn.dataset.id;
    const debt = allDebts.find(d => d.id === id);
    if (!debt) return;

    const confirmed = await showConfirm(
        `Ta bort skulden från ${debt.from} på ${formatAmount(debt.amount)} kr?`,
        'Ta bort skuld', 'Ta bort', 'danger'
    );
    if (!confirmed) return;

    btn.disabled = true;
    const newEntries = allDebts.filter(d => d.id !== id);
    await updateDoc(debtsRef, { entries: newEntries });
    await notifyDebtRemoved(debt, currentUser);
});

// ── Paid debts modal ──────────────────────────────────────────

showPaidBtn?.addEventListener('click', () => {
    renderPaidDebts();
    paidModalEl?.classList.add('active');
});

closePaidBtn?.addEventListener('click', () => {
    paidModalEl?.classList.remove('active');
});

paidModalEl?.addEventListener('click', (e) => {
    if (e.target === paidModalEl) paidModalEl.classList.remove('active');
});

// ── Firestore listener ────────────────────────────────────────

onSnapshot(debtsRef, (snap) => {
    allDebts = snap.exists() ? (snap.data().entries  || []) : [];
    payments = snap.exists() ? (snap.data().payments || []) : [];
    renderMyDebts();
    renderPaidDebts(); // keeps badge updated in real time
}, (error) => {
    console.error('[Debts] Firestore error:', error);
});