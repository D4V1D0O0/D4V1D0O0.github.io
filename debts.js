// ============================================================
// debts.js
// Shows debts the logged-in user has added, and lets them
// remove a debt (with Telegram notification to the person
// who owed it).
// ============================================================

import { db } from './firebase.js';
import { showConfirm } from './modal.js';
import { doc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { notifyDebtRemoved } from './telegram.js';

const currentUser = localStorage.getItem('saldo_user') || '';
const debtsRef    = doc(db, 'Saldo', 'Debts');

const listEl  = document.getElementById('myDebtsList');
const emptyEl = document.getElementById('myDebtsEmpty');

let allDebts = [];
let payments = [];

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

// ── Render debts added by current user ───────────────────────

function renderMyDebts() {
    if (!listEl) return;
    listEl.innerHTML = '';

    // Debts where "to" is the current user (they are the creditor) — newest first
    const mine = allDebts.filter(d => d.to === currentUser).reverse();

    if (mine.length === 0) {
        if (emptyEl) emptyEl.style.display = 'block';
        return;
    }
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

// ── Remove a debt ─────────────────────────────────────────────

listEl?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.debt-remove-btn');
    if (!btn) return;

    const id   = btn.dataset.id;
    const debt = allDebts.find(d => d.id === id);
    if (!debt) return;

    const confirmed = await showConfirm(`Ta bort skulden från ${debt.from} på ${formatAmount(debt.amount)} kr?`, 'Ta bort skuld', 'Ta bort', 'danger');
    if (!confirmed) return;

    btn.disabled = true;

    const newEntries = allDebts.filter(d => d.id !== id);
    await updateDoc(debtsRef, { entries: newEntries });

    // Notify the person who owed the debt
    await notifyDebtRemoved(debt, currentUser);
});

// ── Firestore listener ────────────────────────────────────────

onSnapshot(debtsRef, (snap) => {
    allDebts = snap.exists() ? (snap.data().entries  || []) : [];
    payments = snap.exists() ? (snap.data().payments || []) : [];
    renderMyDebts();
}, (error) => {
    console.error('[Debts] Firestore error:', error);
});