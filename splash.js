// ============================================================
// splash.js
// Delayed splash screen — only shows if loading takes longer
// than SHOW_DELAY_MS. If data loads fast (e.g. from Firestore
// cache) the user never sees it at all.
//
// Usage:
//   import { splashDone } from './splash.js';
//   // call splashDone() once your data is ready
// ============================================================

const SHOW_DELAY_MS = 300;   // show splash only if still loading after this
const HIDE_FADE_MS  = 300;   // matches CSS transition duration

let done        = false;
let showTimer   = null;
const splashEl  = document.getElementById('splash');

// Schedule the splash to appear only if we're still waiting
if (splashEl) {
    showTimer = setTimeout(() => {
        if (!done) splashEl.classList.add('visible');
    }, SHOW_DELAY_MS);
}

/**
 * Call this once your page's data has finished loading.
 * Cancels the show-timer if it hasn't fired yet, or fades
 * out the splash if it's already visible.
 */
export function splashDone() {
    if (done) return;
    done = true;

    clearTimeout(showTimer);

    if (!splashEl) return;

    splashEl.classList.remove('visible');
    splashEl.classList.add('hidden');
    setTimeout(() => splashEl.remove(), HIDE_FADE_MS + 50);
}