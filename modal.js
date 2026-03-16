// ============================================================
// modal.js
// Shared modal utility — replaces all native alert() and
// confirm() calls with styled in-app modals.
//
// Usage:
//   import { showAlert, showConfirm } from './modal.js';
//
//   await showAlert('Något gick fel');
//   const ok = await showConfirm('Är du säker?');
//   if (ok) { ... }
//
// Requires <div id="appModal"> to exist in the page HTML.
// ============================================================

const modal     = document.getElementById('appModal');
const titleEl   = document.getElementById('appModalTitle');
const msgEl     = document.getElementById('appModalMessage');
const cancelBtn = document.getElementById('appModalCancel');
const confirmBtn = document.getElementById('appModalConfirm');

if (!modal) {
    console.error('[modal.js] #appModal not found in DOM. Add the modal HTML to the page.');
}

/**
 * Shows a styled alert modal. Returns a Promise that resolves when dismissed.
 * @param {string} message
 * @param {string} [title]
 */
export function showAlert(message, title = 'OBS') {
    return new Promise((resolve) => {
        if (!modal) { window.alert(message); resolve(); return; }

        titleEl.textContent  = title;
        msgEl.textContent    = message;
        cancelBtn.style.display  = 'none';
        confirmBtn.textContent   = 'OK';
        confirmBtn.className     = 'btn btn-primary';

        modal.classList.add('active');

        function onConfirm() {
            modal.classList.remove('active');
            confirmBtn.removeEventListener('click', onConfirm);
            resolve();
        }

        confirmBtn.addEventListener('click', onConfirm);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) onConfirm();
        }, { once: true });
    });
}

/**
 * Shows a styled confirm modal. Returns a Promise resolving to true/false.
 * @param {string} message
 * @param {string} [title]
 * @param {string} [confirmLabel]
 * @param {'primary'|'danger'} [confirmStyle]
 */
export function showConfirm(message, title = 'Bekräfta', confirmLabel = 'Ja', confirmStyle = 'primary') {
    return new Promise((resolve) => {
        if (!modal) { resolve(window.confirm(message)); return; }

        titleEl.textContent      = title;
        msgEl.textContent        = message;
        cancelBtn.style.display  = '';
        cancelBtn.textContent    = 'Avbryt';
        confirmBtn.textContent   = confirmLabel;
        confirmBtn.className     = `btn btn-${confirmStyle}`;

        modal.classList.add('active');

        function finish(result) {
            modal.classList.remove('active');
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            resolve(result);
        }

        function onConfirm() { finish(true); }
        function onCancel()  { finish(false); }

        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click',  onCancel);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) finish(false);
        }, { once: true });
    });
}