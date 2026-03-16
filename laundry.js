// ============================================================
// laundry.js
// Laundry room booking system backed by Firestore.
//
// Firestore document: /Saldo/Laundry
// Structure:
// {
//   bookings: [
//     {
//       id,           // unique id
//       date,         // "YYYY-MM-DD"
//       slot,         // "07:00-14:00" | "14:00-21:00"
//       open,         // boolean — true = anyone can join
//       bookedBy,     // name of user who created the booking
//       participants  // array of user names who have joined
//     }, ...
//   ]
// }
// ============================================================

import { db } from './firebase.js';
import { showAlert, showConfirm } from './modal.js';
import { doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { notifyLaundryBooked, notifyLaundryJoined } from './telegram.js';

// ── State ─────────────────────────────────────────────────────

const currentUser = localStorage.getItem('saldo_user') || '';
const laundryRef  = doc(db, 'Saldo', 'Laundry');

let bookings = [];

// ── DOM refs ──────────────────────────────────────────────────

const laundryForm = document.getElementById('laundryForm');
const dateInput   = document.getElementById('laundryDate');
const slotSelect  = document.getElementById('laundrySlot');
const openSelect  = document.getElementById('laundryOpen');
const laundryList = document.getElementById('laundryList');
const emptyEl     = document.getElementById('laundryEmpty');

// ── Helpers ───────────────────────────────────────────────────

function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function formatDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
}

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

function isFuture(booking) {
    return booking.date >= todayStr();
}

// Always use setDoc+merge — works even if the document doesn't exist yet,
// which means no getDoc/ensureDoc call is needed on page load.
async function saveBookings(newBookings) {
    await setDoc(laundryRef, { bookings: newBookings }, { merge: true });
}

// ── Render ────────────────────────────────────────────────────

function render(items) {
    laundryList.innerHTML = '';

    const sorted = items
        .filter(isFuture)
        .sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.slot.localeCompare(b.slot);
        });

    if (sorted.length === 0) {
        emptyEl.textContent = 'Inga bokade tider '
        emptyEl.innerHTML += '&#128564;' // sleepy face
        return;
    }
    emptyEl.style.display = 'none';

    sorted.forEach(booking => {
        const isOwner   = booking.bookedBy === currentUser;
        const hasJoined = (booking.participants || []).includes(currentUser);
        const canJoin   = booking.open && !isOwner && !hasJoined;
        const canLeave  = booking.open && !isOwner && hasJoined;

        const div = document.createElement('div');
        div.className = 'entry';
        div.dataset.id = booking.id;

        const participantNames = [booking.bookedBy, ...(booking.participants || [])];
        const participantText  = participantNames.join(', ');

        div.innerHTML = `
            <div class="entry-header">
                <span class="entry-item">${formatDate(booking.date)} · ${booking.slot}</span>
                <span class="laundry-badge ${booking.open ? 'laundry-badge-open' : 'laundry-badge-private'}">
                    ${booking.open ? 'Öppen' : 'Privat'}
                </span>
            </div>
            <div class="entry-footer">
                <span class="entry-meta">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    ${participantText}
                </span>
                <div class="laundry-actions">
                    ${canJoin  ? `<button class="edit-btn laundry-join-btn"   data-id="${booking.id}">Gå med</button>` : ''}
                    ${canLeave ? `<button class="edit-btn laundry-leave-btn"  data-id="${booking.id}">Lämna</button>`  : ''}
                    ${isOwner  ? `<button class="edit-btn laundry-delete-btn" data-id="${booking.id}">Ta bort</button>` : ''}
                </div>
            </div>
        `;

        laundryList.appendChild(div);
    });

    laundryList.querySelectorAll('.laundry-join-btn').forEach(btn => {
        btn.addEventListener('click', () => handleJoin(btn.dataset.id));
    });
    laundryList.querySelectorAll('.laundry-leave-btn').forEach(btn => {
        btn.addEventListener('click', () => handleLeave(btn.dataset.id));
    });
    laundryList.querySelectorAll('.laundry-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => handleDelete(btn.dataset.id));
    });
}

// ── Actions ───────────────────────────────────────────────────

async function handleJoin(id) {
    const booking = bookings.find(b => b.id === id);
    if (!booking) return;

    const ok = await showConfirm(
        `Vill du gå med i ${booking.bookedBy}s bokning: ${formatDate(booking.date)} · ${booking.slot}?`,
        'Gå med i bokning',
        'Gå med'
    );
    if (!ok) return;

    const updated = bookings.map(b => {
        if (b.id !== id) return b;
        const participants = [...(b.participants || [])];
        if (!participants.includes(currentUser)) participants.push(currentUser);
        return { ...b, participants };
    });

    try {
        await saveBookings(updated);
        await notifyLaundryJoined(booking, currentUser);
    } catch (err) {
        await showAlert('Kunde inte gå med i bokningen. Försök igen.');
        console.error('[laundry] join error:', err);
    }
}

async function handleLeave(id) {
    const booking = bookings.find(b => b.id === id);
    if (!booking) return;

    const ok = await showConfirm(
        `Vill du lämna bokningen: ${formatDate(booking.date)} · ${booking.slot}?`,
        'Lämna bokning',
        'Lämna',
        'danger'
    );
    if (!ok) return;

    const updated = bookings.map(b => {
        if (b.id !== id) return b;
        const participants = (b.participants || []).filter(u => u !== currentUser);
        return { ...b, participants };
    });

    try {
        await saveBookings(updated);
    } catch (err) {
        await showAlert('Kunde inte lämna bokningen. Försök igen.');
        console.error('[laundry] leave error:', err);
    }
}

async function handleDelete(id) {
    const booking = bookings.find(b => b.id === id);
    if (!booking) return;

    const ok = await showConfirm(
        `Ta bort bokning: ${formatDate(booking.date)} · ${booking.slot}?`,
        'Ta bort bokning',
        'Ta bort',
        'danger'
    );
    if (!ok) return;

    const updated = bookings.filter(b => b.id !== id);

    try {
        await saveBookings(updated);
    } catch (err) {
        await showAlert('Kunde inte ta bort bokningen. Försök igen.');
        console.error('[laundry] delete error:', err);
    }
}

// ── Form submit ───────────────────────────────────────────────

laundryForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const date   = dateInput.value;
    const slot   = slotSelect.value;
    const isOpen = openSelect.value === 'open';

    if (!date || !slot || !openSelect.value) {
        await showAlert('Välj datum, tid och vem som får använda tiden.');
        return;
    }

    const duplicate = bookings.find(b => b.date === date && b.slot === slot);
    if (duplicate) {
        await showAlert(`Det finns redan en bokning för ${formatDate(date)} · ${slot}.`);
        return;
    }

    const newBooking = {
        id:           uid(),
        date,
        slot,
        open:         isOpen,
        bookedBy:     currentUser,
        participants: []
    };

    const updated = [...bookings, newBooking];

    try {
        await saveBookings(updated);

        if (isOpen) {
            await notifyLaundryBooked(newBooking, currentUser);
        }

        laundryForm.reset();
        dateInput.value = todayStr();
    } catch (err) {
        await showAlert('Kunde inte spara bokningen. Försök igen.');
        console.error('[laundry] save error:', err);
    }
});

// ── Real-time listener ────────────────────────────────────────
// No getDoc/ensureDoc — onSnapshot fires immediately from cache
// if offline, and from server once connected. setDoc+merge handles
// the case where the document doesn't exist yet on first write.

dateInput.value = todayStr();
dateInput.min   = todayStr();

onSnapshot(laundryRef, (snap) => {
    bookings = snap.exists() ? (snap.data().bookings || []) : [];
    render(bookings);
});