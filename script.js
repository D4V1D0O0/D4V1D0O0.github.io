import { db } from './firebase.js';
import { showAlert, showConfirm } from './modal.js';
import { doc, onSnapshot, updateDoc, setDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const purchasesRef = doc(db, 'Saldo', 'Purchases');
const debtsRef     = doc(db, 'Saldo', 'Debts');

let startingBalance      = 0;
let purchases            = [];
let startingBalanceLoaded = false;
let purchasesLoaded       = false;

// ── Helpers ───────────────────────────────────────────────────

function formatAmount(value) {
    if (typeof value !== 'number' || isNaN(value)) value = 0;
    return value.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Generates a stable id for new purchase entries */
function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Safe getElementById */
function el(id) { return document.getElementById(id); }

// Mobile viewport height fix
function setViewportHeight() {
    document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
}
setViewportHeight();
window.addEventListener('resize', setViewportHeight);


// ── Display functions (all null-safe) ─────────────────────────

function displayBalance() {
    const balanceEl  = el('balance');
    const startingEl = el('startingBalance');
    if (!balanceEl) return;
    const totalSpent     = purchases.reduce((sum, e) => sum + (e.TotalCost || 0), 0);
    const currentBalance = startingBalance - totalSpent;
    balanceEl.textContent  = formatAmount(currentBalance) + ' kr';
    if (startingEl) startingEl.textContent = 'Startsaldo: ' + formatAmount(startingBalance) + ' kr';
}

function displayDebts() {
    const container = el('debtsSummary');
    if (!container) return;

    const debts = {};
    purchases.forEach(entry => {
        const payer    = entry.Payer;
        const personal = typeof entry.PersonalCost === 'number' ? entry.PersonalCost : 0;
        if (!payer || personal <= 0) return;
        debts[payer] = (debts[payer] || 0) + personal;
    });

    const names = Object.keys(debts);
    if (names.length === 0) { container.textContent = 'Inga skulder, yippee!'; return; }

    container.innerHTML = '';
    names.forEach(name => {
        const div = document.createElement('div');
        div.className   = 'debt-item';
        div.textContent = `${name}: ${formatAmount(debts[name])} kr`;
        container.appendChild(div);
    });
}

function displayEntries() {
    const entriesList = el('entriesList');
    if (!entriesList) return;

    // ── Donut chart ───────────────────────────────────────────
    const donutArc     = el('donutSpentArc');
    const donutPct     = el('donutPct');
    const donutSpentAmt = el('donutSpentAmt');
    const donutLeftAmt  = el('donutLeftAmt');

    if (donutArc && startingBalance > 0) {
        const spent      = purchases.reduce((s, e) => s + (e.TotalCost || 0), 0);
        const remaining  = Math.max(startingBalance - spent, 0);
        const pct        = Math.min(spent / startingBalance, 1);
        const circumference = 2 * Math.PI * 48; // r=48 → ~301.6
        const spentDash  = (pct * circumference).toFixed(1);
        const gapDash    = (circumference - spentDash).toFixed(1);

        donutArc.setAttribute('stroke-dasharray', `${spentDash} ${gapDash}`);
        if (donutPct)      donutPct.textContent      = Math.round(pct * 100) + '%';
        if (donutSpentAmt) donutSpentAmt.textContent = formatAmount(spent) + ' kr';
        if (donutLeftAmt)  donutLeftAmt.textContent  = formatAmount(remaining) + ' kr';
    } else if (donutArc) {
        // No starting balance set yet
        if (donutPct)      donutPct.textContent      = '—';
        if (donutSpentAmt) donutSpentAmt.textContent = '— kr';
        if (donutLeftAmt)  donutLeftAmt.textContent  = '— kr';
    }
    // ─────────────────────────────────────────────────────────

    entriesList.innerHTML = '';
    [...purchases].reverse().forEach((entry, reversedIndex) => {
        const originalIndex = purchases.length - 1 - reversedIndex;

        let dateStr = '';
        if (entry.Date) {
            const d = entry.Date.toDate ? entry.Date.toDate() : new Date(entry.Date);
            dateStr = d.toLocaleString('sv-SE', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            });
        }

        // SharedCost is canonical; TotalCost = SharedCost + PersonalCost
        const sharedValue   = typeof entry.SharedCost   === 'number' ? entry.SharedCost   : (entry.Cost || 0);
        const totalValue    = typeof entry.TotalCost    === 'number' ? entry.TotalCost    : sharedValue;
        const personalValue = typeof entry.PersonalCost === 'number' ? entry.PersonalCost : 0;
        const payer         = entry.Payer || '';

        const detailsParts = [];
        if (personalValue > 0) {
            detailsParts.push(`Delat: ${formatAmount(sharedValue)} kr`);
            detailsParts.push(`Privat: ${formatAmount(personalValue)} kr${payer ? ` (${payer})` : ''}`);
        }
        const detailsHtml = detailsParts.length
            ? `<div class="entry-details">${detailsParts.join(' · ')}</div>` : '';

        const div = document.createElement('div');
        div.className = 'entry';
        div.innerHTML = `
            <div class="entry-header">
                <span class="entry-item">${entry.Type || 'N/A'}</span>
                <span class="entry-amount">-${formatAmount(totalValue)} kr</span>
            </div>
            <div class="entry-footer">
                <span class="entry-date">${dateStr}</span>
                <button class="edit-btn" onclick="openEditModal(${originalIndex})">Redigera</button>
            </div>
            ${detailsHtml}
        `;
        entriesList.appendChild(div);
    });
}

// ── Firestore: load ───────────────────────────────────────────

function loadData() {
    onSnapshot(doc(db, 'Saldo', 'StartingBalance'), (snap) => {
        if (snap.exists()) startingBalance = snap.data().Amount || 0;
        startingBalanceLoaded = true;
        displayBalance();
    }, () => { startingBalanceLoaded = true; });

    onSnapshot(purchasesRef, (snap) => {
        purchases     = snap.exists() ? (snap.data().entries || []) : [];
        purchasesLoaded = true;
        displayBalance();
        displayEntries();
        displayDebts();
    }, () => { purchasesLoaded = true; });
}

// ── Firestore: save ───────────────────────────────────────────
// Uses setDoc+merge so it works even if the document doesn't exist yet.

function saveData() {
    setDoc(purchasesRef, { entries: purchases }, { merge: true });
}

// ── Delete entry ──────────────────────────────────────────────

function deleteEntry(index) {
    purchases.splice(index, 1);
    saveData();
    displayBalance();
    displayEntries();
    displayDebts();
}
window.deleteEntry = deleteEntry;

// ── Edit modal ────────────────────────────────────────────────

let editingIndex = null;

function openEditModal(index) {
    editingIndex = index;
    const entry     = purchases[index];
    const editModal = el('editEntryModal');
    if (!editModal) return;
    el('editItemInput').value           = entry.Type         || '';
    el('editTotalAmountInput').value    = entry.TotalCost    ?? 0;
    el('editPersonalAmountInput').value = entry.PersonalCost ?? 0;
    editModal.classList.add('active');
}

function closeEditModal() {
    el('editEntryModal')?.classList.remove('active');
    editingIndex = null;
}

async function saveEditEntry() {
    if (editingIndex === null || editingIndex < 0 || editingIndex >= purchases.length) {
        await showAlert('Utgiftens index är ogiltigt'); return;
    }
    const item           = el('editItemInput').value;
    const totalAmount    = parseFloat(el('editTotalAmountInput').value);
    const personalRaw    = el('editPersonalAmountInput').value;
    const personalAmount = personalRaw === '' ? 0 : parseFloat(personalRaw);

    if (!item.trim())                                { await showAlert('Skriv vad du köpte.'); return; }
    if (isNaN(totalAmount) || totalAmount <= 0)      { await showAlert('Totalbelopp måste vara större än 0.'); return; }
    if (isNaN(personalAmount) || personalAmount < 0) { await showAlert('Privat del kan inte vara negativ.'); return; }
    if (personalAmount > totalAmount)                { await showAlert('Privat del kan inte vara större än totalt.'); return; }

    const sharedAmount = totalAmount - personalAmount;
    // Update only the canonical fields; drop the legacy Cost alias
    purchases[editingIndex] = {
        ...purchases[editingIndex],
        Type:         item,
        TotalCost:    totalAmount,
        PersonalCost: personalAmount,
        SharedCost:   sharedAmount,
    };
    // Remove legacy Cost field if present
    delete purchases[editingIndex].Cost;

    saveData();
    displayBalance();
    displayEntries();
    displayDebts();
    closeEditModal();
}

window.openEditModal = openEditModal;

if (el('editCancelBtn'))  el('editCancelBtn').addEventListener('click', closeEditModal);
if (el('editSaveBtn'))    el('editSaveBtn').addEventListener('click', saveEditEntry);
if (el('editDeleteBtn'))  el('editDeleteBtn').addEventListener('click', async () => {
    if (editingIndex !== null) {
        if (await showConfirm(`Radera "${purchases[editingIndex].Type}"?`, 'Radera utgift', 'Radera', 'danger')) {
            deleteEntry(editingIndex);
            closeEditModal();
        }
    }
});
el('editEntryModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'editEntryModal') closeEditModal();
});

// ── Form toggle (add.html only) ───────────────────────────────

const toggleToExpense = el('toggleToExpense');
const toggleToDebt    = el('toggleToDebt');
const expenseForm     = el('expenseForm');
const debtForm        = el('debtForm');

if (toggleToExpense && toggleToDebt && expenseForm && debtForm) {
    const switchAddForm = (showExpense) => {
        expenseForm.classList.toggle('active', showExpense);
        debtForm.classList.toggle('active', !showExpense);
        toggleToExpense.classList.toggle('active', showExpense);
        toggleToDebt.classList.toggle('active', !showExpense);
    };
    toggleToExpense.addEventListener('click', () => switchAddForm(true));
    toggleToDebt.addEventListener('click',    () => switchAddForm(false));
}

// ── Expense form (add.html only) ──────────────────────────────

if (expenseForm) {
    expenseForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const item           = el('itemInput').value.trim();
        const totalAmount    = parseFloat(el('totalAmountInput').value);
        const personalRaw    = el('personalAmountInput').value;
        const personalAmount = personalRaw === '' ? 0 : parseFloat(personalRaw);
        const payer          = el('payerSelect').value;

        if (!item)                                       { await showAlert('Skriv vad du köpte.'); return; }
        if (isNaN(totalAmount) || totalAmount <= 0)      { await showAlert('Totalbelopp måste vara större än 0.'); return; }
        if (isNaN(personalAmount) || personalAmount < 0) { await showAlert('Privat del kan inte vara negativ.'); return; }
        if (personalAmount > totalAmount)                { await showAlert('Privat del kan inte vara större än totalt.'); return; }
        if (!payer)                                      { await showAlert('Välj vem som betalade.'); return; }

        const sharedAmount = totalAmount - personalAmount;

        // Lean entry — no legacy Cost field, stable id for future-safe edits/deletes
        const newEntry = {
            id:           uid(),
            Type:         item,
            TotalCost:    totalAmount,
            PersonalCost: personalAmount,
            SharedCost:   sharedAmount,
            Payer:        payer,
            Date:         new Date().toISOString()
        };

        purchases.push(newEntry);
        saveData();
        displayBalance();
        displayEntries();
        displayDebts();

        el('itemInput').value          = '';
        el('totalAmountInput').value   = '';
        el('personalAmountInput').value = '';
        el('payerSelect').value        = '';
    });
}

// ── Debt form (add.html only) ─────────────────────────────────

if (debtForm) {
    debtForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const from    = el('debtFrom').value;
        const to      = el('debtTo').value;
        const amount  = parseFloat(el('debtAmount').value);
        const message = el('debtMessage').value.trim();

        if (from === to)          { await showAlert('Kan inte vara samma person'); return; }
        if (isNaN(amount) || amount <= 0) { await showAlert('Ange ett giltigt belopp.'); return; }
        if (!message)             { await showAlert('Ange ett meddelande.'); return; }

        const entry = { id: uid(), from, to, amount, message, date: new Date().toISOString() };
        await updateDoc(debtsRef, { entries: arrayUnion(entry) });

        el('debtAmount').value  = '';
        el('debtMessage').value = '';
        el('debtTo').value      = '';
        el('debtFrom').value    = '';
    });
}

// ── Start ─────────────────────────────────────────────────────

loadData();