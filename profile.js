// ============================================================
// profile.js
// Profile page — shows who you are and lets you change
// your password. Uses auth.js for hashed Firestore passwords.
// ============================================================

import { changePassword } from './auth.js';

const ADMIN = 'David';
const currentUser = localStorage.getItem('saldo_user') || '';

// ── Populate identity card ────────────────────────────────────

const avatarEl = document.getElementById('profileAvatar');
const nameEl   = document.getElementById('profileName');
const roleEl   = document.getElementById('profileRole');

if (avatarEl) avatarEl.textContent = currentUser ? currentUser[0].toUpperCase() : '?';
if (nameEl)   nameEl.textContent   = currentUser;
if (roleEl)   roleEl.textContent   = currentUser === ADMIN ? 'Admin' : 'Boende';

// ── Password change form ──────────────────────────────────────

const form        = document.getElementById('changePasswordForm');
const oldPwInput  = document.getElementById('oldPassword');
const newPwInput  = document.getElementById('newPassword');
const confPwInput = document.getElementById('confirmPassword');
const feedback    = document.getElementById('pwFeedback');
const saveBtn     = document.getElementById('savePwBtn');

function showFeedback(message, isError) {
    feedback.textContent   = message;
    feedback.style.display = 'block';
    feedback.className     = isError ? 'profile-feedback profile-feedback-error'
                                     : 'profile-feedback profile-feedback-ok';
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    feedback.style.display = 'none';

    const oldPw  = oldPwInput.value;
    const newPw  = newPwInput.value;
    const confPw = confPwInput.value;

    if (newPw !== confPw) {
        showFeedback('De nya lösenorden matchar inte.', true);
        return;
    }

    saveBtn.disabled    = true;
    saveBtn.textContent = 'Sparar…';

    const result = await changePassword(currentUser, oldPw, newPw);

    saveBtn.disabled    = false;
    saveBtn.textContent = 'Spara lösenord';

    if (result.ok) {
        showFeedback('Lösenordet är uppdaterat! ✓', false);
        oldPwInput.value  = '';
        newPwInput.value  = '';
        confPwInput.value = '';
    } else {
        showFeedback(result.error, true);
    }
});