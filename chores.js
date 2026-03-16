// ============================================================
// chores.js
// Real-time chores & points system backed by Firestore.
//
// Firestore document: /Saldo/Chores
// Structure:
// {
//   chores:  [ { id, name, points }, ... ],
//   scores:  { David: 42, Julius: 17, Alvin: 30 },
//   log:     [ { id, choreId, choreName, points, user, date }, ... ]
// }
//
// All state syncs in real-time via onSnapshot.
// ============================================================

import { db } from './firebase.js';
import { showAlert, showConfirm } from './modal.js';
import { doc, onSnapshot, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// ── Firebase ──────────────────────────────────────────────────


// ── Config ────────────────────────────────────────────────────

const ALL_USERS    = ['David', 'Julius', 'Alvin'];
const MAX_LOG_SIZE = 50;   // keep last 50 log entries

// Medal labels for leaderboard positions
const MEDALS = ['🥇', '🥈', '🥉'];

// ── State ─────────────────────────────────────────────────────

const currentUser = localStorage.getItem('saldo_user') || '';
const choresRef   = doc(db, 'Saldo', 'Chores');

let chores = [];
let scores = {};
let log    = [];

// ── DOM refs ──────────────────────────────────────────────────

const leaderboardEl   = document.getElementById('leaderboard');
const choresListEl    = document.getElementById('choresList');
const choresEmptyEl   = document.getElementById('choresEmpty');
const choreLogEl      = document.getElementById('choreLog');
const logEmptyEl      = document.getElementById('logEmpty');
const manageChoresBtn = document.getElementById('manageChoresBtn');
const manageModal     = document.getElementById('manageModal');
const manageCloseBtn  = document.getElementById('manageCloseBtn');
const manageChoresList = document.getElementById('manageChoresList');
const manageEmptyEl   = document.getElementById('manageEmpty');
const addChoreForm    = document.getElementById('addChoreForm');
const choreNameInput  = document.getElementById('choreNameInput');
const chorePointsInput = document.getElementById('chorePointsInput');
const resetModal      = document.getElementById('resetModal');
const resetCloseBtn   = document.getElementById('resetCloseBtn');
const resetCancelBtn  = document.getElementById('resetCancelBtn');
const resetConfirmBtn = document.getElementById('resetConfirmBtn');

// ── Helpers ───────────────────────────────────────────────────

function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}


function formatDate(isoString) {
    const d = new Date(isoString);
    return d.toLocaleString('sv-SE', {
        month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
    });
}

// ── Render: leaderboard ───────────────────────────────────────

function renderLeaderboard() {
    const sorted = ALL_USERS
        .map(name => ({ name, pts: scores[name] || 0 }))
        .sort((a, b) => b.pts - a.pts);

    leaderboardEl.innerHTML = '';
    sorted.forEach((user, i) => {
        const isMe = user.name === currentUser;
        const row  = document.createElement('div');
        row.className = `chores-lb-row${isMe ? ' chores-lb-row-me' : ''}`;
        row.innerHTML = `
            <span class="chores-lb-medal">${MEDALS[i] || ''}</span>
            <span class="chores-lb-name">${user.name}${isMe ? ' <span class="chores-you-tag">du</span>' : ''}</span>
            <span class="chores-lb-pts">${user.pts} <span class="chores-lb-pts-label">p</span></span>
        `;
        leaderboardEl.appendChild(row);
    });
}

// ── Render: chore buttons ─────────────────────────────────────

function renderChores() {
    choresListEl.innerHTML = '';

    if (chores.length === 0) {
        choresEmptyEl.style.display = 'block';
        return;
    }
    choresEmptyEl.style.display = 'none';

    chores.forEach(chore => {
        const btn = document.createElement('button');
        btn.className = 'chore-btn';
        btn.dataset.id = chore.id;
        btn.innerHTML = `
            <span class="chore-btn-name">${chore.name}</span>
            <span class="chore-btn-pts">+${chore.points}p</span>
        `;
        btn.addEventListener('click', () => logChore(chore));
        choresListEl.appendChild(btn);
    });
}

// ── Render: activity log ──────────────────────────────────────

function renderLog() {
    choreLogEl.innerHTML = '';
    const recent = [...log].reverse().slice(0, 20);

    if (recent.length === 0) {
        logEmptyEl.style.display = 'block';
        return;
    }
    logEmptyEl.style.display = 'none';

    recent.forEach(entry => {
        const isMe = entry.user === currentUser;
        const row  = document.createElement('div');
        row.className = 'chore-log-row';
        row.innerHTML = `
            <div class="chore-log-main">
                <span class="chore-log-user${isMe ? ' chore-log-user-me' : ''}">${entry.user}</span>
                <span class="chore-log-name">${entry.choreName}</span>
            </div>
            <div class="chore-log-right">
                <span class="chore-log-pts">+${entry.points}p</span>
                <span class="chore-log-date">${formatDate(entry.date)}</span>
            </div>
        `;
        choreLogEl.appendChild(row);
    });
}

// ── Render: manage modal list ─────────────────────────────────

function renderManageList() {
    manageChoresList.innerHTML = '';

    if (chores.length === 0) {
        manageEmptyEl.style.display = 'block';
        return;
    }
    manageEmptyEl.style.display = 'none';

    chores.forEach(chore => {
        const row = document.createElement('div');
        row.className = 'chore-manage-row';
        row.innerHTML = `
            <span class="chore-manage-name">${chore.name}</span>
            <span class="chore-manage-pts">${chore.points}p</span>
            <button class="chore-delete-btn" data-id="${chore.id}" aria-label="Ta bort">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/>
                    <path d="M9 6V4h6v2"/>
                </svg>
            </button>
        `;
        manageChoresList.appendChild(row);
    });
}

// ── Actions ───────────────────────────────────────────────────

/** Logs a chore for the current user and awards points */
async function logChore(chore) {
    const entry = {
        id:        uid(),
        choreId:   chore.id,
        choreName: chore.name,
        points:    chore.points,
        user:      currentUser,
        date:      new Date().toISOString()
    };

    const newScores = { ...scores, [currentUser]: (scores[currentUser] || 0) + chore.points };
    const newLog    = [...log, entry].slice(-MAX_LOG_SIZE);

    // Optimistic update for instant feedback
    scores = newScores;
    log    = newLog;
    renderLeaderboard();
    renderLog();

    // Flash the button
    const btn = choresListEl.querySelector(`[data-id="${chore.id}"]`);
    if (btn) {
        btn.classList.add('chore-btn-flash');
        setTimeout(() => btn.classList.remove('chore-btn-flash'), 600);
    }

    await updateDoc(choresRef, { scores: newScores, log: newLog });
}

/** Adds a new chore definition */
async function addChore(name, points) {
    const newChore  = { id: uid(), name: name.trim(), points };
    const newChores = [...chores, newChore];
    await updateDoc(choresRef, { chores: newChores });
}

/** Deletes a chore definition by id */
async function deleteChore(id) {
    const newChores = chores.filter(c => c.id !== id);
    await updateDoc(choresRef, { chores: newChores });
}

/** Resets all scores and clears the log */
async function resetAll() {
    const emptyScores = {};
    ALL_USERS.forEach(u => { emptyScores[u] = 0; });
    await updateDoc(choresRef, { scores: emptyScores, log: [] });
}

// ── Firestore listener ────────────────────────────────────────

onSnapshot(choresRef, (snap) => {
    if (snap.exists()) {
        const data = snap.data();
        chores = data.chores  || [];
        scores = data.scores  || {};
        log    = data.log     || [];
    } else {
        // First time: create the document
        const initialScores = {};
        ALL_USERS.forEach(u => { initialScores[u] = 0; });
        setDoc(choresRef, { chores: [], scores: initialScores, log: [] });
        chores = []; scores = initialScores; log = [];
    }

    renderLeaderboard();
    renderChores();
    renderLog();
    renderManageList();
}, (error) => {
    console.error('[Chores] Firestore error:', error);
});

// ── Event listeners ───────────────────────────────────────────

// Open / close manage modal
manageChoresBtn.addEventListener('click', () => manageModal.classList.add('active'));
manageCloseBtn.addEventListener('click',  () => manageModal.classList.remove('active'));
manageModal.addEventListener('click', e => {
    if (e.target === manageModal) manageModal.classList.remove('active');
});

// Add chore form
addChoreForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name   = choreNameInput.value.trim();
    const points = parseInt(chorePointsInput.value, 10);

    if (!name)                           { await showAlert('Ange ett namn för sysslan.'); return; }
    if (isNaN(points) || points < 1)     { await showAlert('Poäng måste vara minst 1.'); return; }
    if (points > 100)                    { await showAlert('Poäng kan inte överstiga 100.'); return; }

    await addChore(name, points);
    choreNameInput.value   = '';
    chorePointsInput.value = '';
    choreNameInput.focus();
});

// Delete chore (event delegation)
manageChoresList.addEventListener('click', async (e) => {
    const btn = e.target.closest('.chore-delete-btn');
    if (!btn) return;
    const id = btn.dataset.id;
    const chore = chores.find(c => c.id === id);
    if (!chore) return;
    if (!await showConfirm(`Ta bort "${chore.name}"?`, 'Ta bort syssla', 'Ta bort', 'danger')) return;
    await deleteChore(id);
});

// Reset points modal
document.querySelector('.btn-ghost')?.addEventListener('click', () => {}); // manageChoresBtn already handled above

// Add reset button wiring inside manage modal footer
// (reset modal triggered by a separate link in manage modal — see HTML)
resetCloseBtn.addEventListener('click',  () => resetModal.classList.remove('active'));
resetCancelBtn.addEventListener('click', () => resetModal.classList.remove('active'));
resetModal.addEventListener('click', e => {
    if (e.target === resetModal) resetModal.classList.remove('active');
});
resetConfirmBtn.addEventListener('click', async () => {
    await resetAll();
    resetModal.classList.remove('active');
});

// Expose reset modal opener to HTML (called from manage modal link)
window.openResetModal = () => {
    manageModal.classList.remove('active');
    resetModal.classList.add('active');
};