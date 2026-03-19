// ============================================================
// shopping.js
// Real-time shared shopping list backed by Firestore.
// Long-press anywhere on an unchecked item to drag and reorder.
// ============================================================

import { db } from './firebase.js';
import { showConfirm } from './modal.js';
import { doc, onSnapshot, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// ── State ─────────────────────────────────────────────────────

const currentUser  = localStorage.getItem('saldo_user') || 'Okänd';
const listRef      = doc(db, 'Saldo', 'ShoppingList');
let   currentItems = [];

// ── DOM refs ──────────────────────────────────────────────────

const shoppingForm    = document.getElementById('shoppingForm');
const shoppingInput   = document.getElementById('shoppingInput');
const shoppingList    = document.getElementById('shoppingList');
const shoppingEmpty   = document.getElementById('shoppingEmpty');
const itemCount       = document.getElementById('itemCount');
const clearCheckedBtn = document.getElementById('clearCheckedBtn');

// ── Helpers ───────────────────────────────────────────────────

function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

async function saveItems() {
    await updateDoc(listRef, { items: currentItems });
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── Drag-to-reorder ───────────────────────────────────────────
//
// The dragged <li> stays in the DOM the whole time and acts as
// its own gap indicator — it's just made invisible (opacity:0)
// while a fixed-position ghost clone follows the finger.
// As the finger moves we physically move the invisible <li>
// before/after its siblings, so the list naturally reflows
// around it. On release we read DOM order → rebuild currentItems.
// No separate placeholder element, so no double-gap bug.

let dragging    = false;
let dragLi      = null;
let ghost       = null;
let pressTimer  = null;
let grabOffsetY = 0;

function getUncheckedEls() {
    return [...shoppingList.querySelectorAll('li[data-id]:not(.shopping-item-checked)')];
}

function startDrag(li, clientY) {
    dragging    = true;
    dragLi      = li;
    grabOffsetY = clientY - li.getBoundingClientRect().top;

    // Ghost: fixed clone that follows the finger
    const rect = li.getBoundingClientRect();
    ghost = li.cloneNode(true);
    ghost.classList.add('shopping-ghost');
    ghost.style.top   = rect.top + 'px';
    ghost.style.left  = rect.left + 'px';
    ghost.style.width = rect.width + 'px';
    document.body.appendChild(ghost);

    // Make original invisible — it still occupies space (our gap)
    li.classList.add('shopping-item-dragging');

    document.body.classList.add('sorting');
}

function moveDrag(clientY) {
    if (!dragging || !ghost) return;

    // Move ghost
    ghost.style.top = (clientY - grabOffsetY) + 'px';

    // Ghost centre in page coordinates
    const ghostMid = clientY - grabOffsetY + ghost.offsetHeight / 2;

    // Look at every unchecked sibling (excluding the invisible dragLi)
    const siblings = getUncheckedEls().filter(el => el !== dragLi);

    for (let i = 0; i < siblings.length; i++) {
        const el   = siblings[i];
        const rect = el.getBoundingClientRect();
        const mid  = rect.top + rect.height / 2;

        if (ghostMid < mid) {
            // Insert invisible li before this sibling if not already there
            if (dragLi.nextSibling !== el) {
                shoppingList.insertBefore(dragLi, el);
            }
            return;
        }
    }

    // Ghost is below all siblings — move dragLi to end of unchecked section
    const lastSibling = siblings[siblings.length - 1];
    if (lastSibling && dragLi !== lastSibling.nextSibling) {
        lastSibling.insertAdjacentElement('afterend', dragLi);
    }
}

async function endDrag() {
    if (!dragging) return;
    dragging = false;

    dragLi.classList.remove('shopping-item-dragging');
    ghost.remove();
    ghost  = null;
    dragLi = null;
    document.body.classList.remove('sorting');

    // Rebuild currentItems from final DOM order
    const domIds     = [...shoppingList.querySelectorAll('li[data-id]')].map(el => el.dataset.id);
    currentItems     = domIds.map(id => currentItems.find(it => it.id === id)).filter(Boolean);

    await saveItems();
    render(currentItems);
}

function abortDrag() {
    clearTimeout(pressTimer);
    if (!dragging) return;
    dragging = false;

    dragLi?.classList.remove('shopping-item-dragging');
    ghost?.remove();
    ghost  = null;
    dragLi = null;
    document.body.classList.remove('sorting');
    render(currentItems);
}

// ── Attach long-press listeners to an unchecked <li> ─────────

function attachLongPress(li) {
    let startX = 0, startY = 0;

    li.addEventListener('touchstart', (e) => {
        if (e.target.closest('.shopping-check-btn, .shopping-delete-btn')) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        pressTimer = setTimeout(() => startDrag(li, startY), 300);
    }, { passive: true });

    li.addEventListener('touchmove', (e) => {
        const dx = Math.abs(e.touches[0].clientX - startX);
        const dy = Math.abs(e.touches[0].clientY - startY);
        if (!dragging) {
            if (dx > 6 || dy > 6) clearTimeout(pressTimer);
            return;
        }
        e.preventDefault();
        moveDrag(e.touches[0].clientY);
    }, { passive: false });

    li.addEventListener('touchend',    () => { clearTimeout(pressTimer); if (dragging) endDrag(); }, { passive: true });
    li.addEventListener('touchcancel', abortDrag, { passive: true });

    // Mouse (desktop)
    li.addEventListener('mousedown', (e) => {
        if (e.target.closest('.shopping-check-btn, .shopping-delete-btn')) return;
        e.preventDefault();
        pressTimer = setTimeout(() => {
            startDrag(li, e.clientY);
            const onMove = (ev) => moveDrag(ev.clientY);
            const onUp   = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); endDrag(); };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup',   onUp);
        }, 300);
    });
    li.addEventListener('mousemove', () => clearTimeout(pressTimer));
    li.addEventListener('mouseup',   () => clearTimeout(pressTimer));
}

// ── Render ────────────────────────────────────────────────────

function render(items) {
    shoppingList.innerHTML = '';

    const sorted = [
        ...items.filter(i => !i.checked),
        ...items.filter(i =>  i.checked),
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
        li.className  = `shopping-item${item.checked ? ' shopping-item-checked' : ''}`;
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

        if (!item.checked) attachLongPress(li);
        shoppingList.appendChild(li);
    });
}

// ── Firestore listener ────────────────────────────────────────

onSnapshot(listRef, (snap) => {
    if (snap.exists()) {
        currentItems = snap.data().items || [];
    } else {
        setDoc(listRef, { items: [] });
        currentItems = [];
    }
    if (!dragging) render(currentItems);
}, (error) => {
    console.error('[Shopping] Firestore error:', error);
});

// ── Add item ──────────────────────────────────────────────────

shoppingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = shoppingInput.value.trim();
    if (!text) return;
    currentItems = [...currentItems, {
        id: uid(), text, checked: false,
        addedBy: currentUser, addedAt: new Date().toISOString(),
    }];
    await saveItems();
    shoppingInput.value = '';
    shoppingInput.focus();
});

// ── Toggle checked / Delete ───────────────────────────────────

shoppingList.addEventListener('click', async (e) => {
    if (dragging) return;
    const checkBtn  = e.target.closest('.shopping-check-btn');
    const deleteBtn = e.target.closest('.shopping-delete-btn');
    if (checkBtn) {
        const id = checkBtn.dataset.id;
        currentItems = currentItems.map(it => it.id === id ? { ...it, checked: !it.checked } : it);
        await saveItems();
    }
    if (deleteBtn) {
        const id = deleteBtn.dataset.id;
        currentItems = currentItems.filter(it => it.id !== id);
        await saveItems();
    }
});

// ── Clear checked ─────────────────────────────────────────────

clearCheckedBtn.addEventListener('click', async () => {
    const count = currentItems.filter(i => i.checked).length;
    if (!count) return;
    const ok = await showConfirm(`Ta bort ${count} ikryssade vara${count > 1 ? 'r' : ''}?`, 'Rensa listan', 'Ta bort', 'danger');
    if (!ok) return;
    currentItems = currentItems.filter(i => !i.checked);
    await saveItems();
});