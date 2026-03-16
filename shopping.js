// ============================================================
// shopping.js
// Real-time shared shopping list backed by Firestore.
//
// Firestore document: /Saldo/ShoppingList
// Structure: { items: [ { id, text, checked, addedBy, addedAt }, ... ] }
//
// All changes sync instantly to all connected devices via
// Firestore's onSnapshot real-time listener.
// ============================================================

import { db } from './firebase.js';
import { showConfirm } from './modal.js';
import { doc, onSnapshot, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";


// ── State ─────────────────────────────────────────────────────

const currentUser  = localStorage.getItem('saldo_user') || 'Okänd';
const listRef      = doc(db, 'Saldo', 'ShoppingList');
let   currentItems = [];   // local mirror of Firestore items array

// ── DOM refs ──────────────────────────────────────────────────

const shoppingForm    = document.getElementById('shoppingForm');
const shoppingInput   = document.getElementById('shoppingInput');
const shoppingList    = document.getElementById('shoppingList');
const shoppingEmpty   = document.getElementById('shoppingEmpty');
const itemCount       = document.getElementById('itemCount');
const clearCheckedBtn = document.getElementById('clearCheckedBtn');

// ── Helpers ───────────────────────────────────────────────────

/** Generates a simple unique ID for each list item */
function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Saves the current local items array back to Firestore */
async function saveItems() {
    await updateDoc(listRef, { items: currentItems });
}


// ── Render ────────────────────────────────────────────────────

function render(items) {
    shoppingList.innerHTML = '';

    // Unchecked first, then checked
    const sorted = [
        ...items.filter(i => !i.checked),
        ...items.filter(i =>  i.checked)
    ];

    if (sorted.length === 0) {
        shoppingEmpty.style.display = 'block';
        itemCount.textContent = '';
    } else {
        shoppingEmpty.style.display = 'none';
        const unchecked = items.filter(i => !i.checked).length;
        itemCount.textContent = unchecked > 0 ? `${unchecked} kvar` : 'Allt klart!';
    }

    sorted.forEach(item => {
        const li = document.createElement('li');
        li.className = `shopping-item${item.checked ? ' shopping-item-checked' : ''}`;
        li.dataset.id = item.id;

        li.innerHTML = `
            <button class="shopping-check-btn" data-id="${item.id}" aria-label="Markera">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    ${item.checked
                        ? '<polyline points="20 6 9 17 4 12"/>'
                        : '<circle cx="12" cy="12" r="9"/>'}
                </svg>
            </button>
            <div class="shopping-item-body">
                <span class="shopping-item-text">${escapeHtml(item.text)}</span>
                <span class="shopping-item-meta">${escapeHtml(item.addedBy)}</span>
            </div>
            <button class="shopping-delete-btn" data-id="${item.id}" aria-label="Ta bort">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;

        shoppingList.appendChild(li);
    });
}

/** Minimal HTML escape to prevent XSS */
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── Firestore listener ────────────────────────────────────────

onSnapshot(listRef, (snap) => {
    if (snap.exists()) {
        currentItems = snap.data().items || [];
    } else {
        // Document doesn't exist yet — create it
        setDoc(listRef, { items: [] });
        currentItems = [];
    }
    render(currentItems);
}, (error) => {
    console.error('[Shopping] Firestore error:', error);
});

// ── Add item ──────────────────────────────────────────────────

shoppingForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const text = shoppingInput.value.trim();
    if (!text) return;

    const newItem = {
        id:      uid(),
        text,
        checked: false,
        addedBy: currentUser,
        addedAt: new Date().toISOString()
    };

    currentItems = [...currentItems, newItem];
    await saveItems();

    shoppingInput.value = '';
    shoppingInput.focus();
});

// ── Toggle checked / Delete (event delegation) ────────────────

shoppingList.addEventListener('click', async (e) => {
    const checkBtn  = e.target.closest('.shopping-check-btn');
    const deleteBtn = e.target.closest('.shopping-delete-btn');

    if (checkBtn) {
        const id = checkBtn.dataset.id;
        currentItems = currentItems.map(item =>
            item.id === id ? { ...item, checked: !item.checked } : item
        );
        await saveItems();
    }

    if (deleteBtn) {
        const id = deleteBtn.dataset.id;
        currentItems = currentItems.filter(item => item.id !== id);
        await saveItems();
    }
});

// ── Clear checked items ───────────────────────────────────────

clearCheckedBtn.addEventListener('click', async () => {
    const checkedCount = currentItems.filter(i => i.checked).length;
    if (checkedCount === 0) return;

    const confirmed = await showConfirm(`Ta bort ${checkedCount} ikryssade vara${checkedCount > 1 ? 'r' : ''}?`, 'Rensa listan', 'Ta bort', 'danger');
    if (!confirmed) return;

    currentItems = currentItems.filter(item => !item.checked);
    await saveItems();
});