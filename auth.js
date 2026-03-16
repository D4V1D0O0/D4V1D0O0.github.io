import { db } from './firebase.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const passwordsRef = doc(db, 'Saldo', 'Passwords');

// ── SHA-256 hashing ────────────────────────────────────────────────────

/**
 * Returns the SHA-256 hex digest of a string.
 * Uses the browser's built-in SubtleCrypto — no library needed.
 */
export async function sha256(str) {
    const buf    = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Firestore password store ───────────────────────────────────────────

export async function loadPasswords() {
    try {
        const snap = await getDoc(passwordsRef);

        if (snap.exists()) {
            return snap.data();
        }

        // First-time setup: hash the defaults and store them
        const hashed = {};
        for (const [name, pw] of Object.entries(DEFAULT_PASSWORDS)) {
            hashed[name] = await sha256(pw);
        }
        // Best-effort write — ignore if rules block it
        try { await setDoc(passwordsRef, hashed); } catch (_) {}
        return hashed;

    } catch (err) {
        // Firestore unavailable or rules block it — fall back to hashed defaults
        console.warn('[Auth] Firestore unavailable, using default passwords:', err.message);
        const hashed = {};
        for (const [name, pw] of Object.entries(DEFAULT_PASSWORDS)) {
            hashed[name] = await sha256(pw);
        }
        return hashed;
    }
}

/**
 * Verifies a plaintext password against the stored hash for a user.
 * Returns true if correct, false otherwise.
 */
export async function verifyPassword(userName, plaintext) {
    const passwords = await loadPasswords();
    const stored    = passwords[userName];
    if (!stored) return false;
    const attempt = await sha256(plaintext);
    return attempt === stored;
}

/**
 * Changes a user's password.
 * Verifies the old password first; rejects if wrong.
 * Returns { ok: true } on success or { ok: false, error: string } on failure.
 */
export async function changePassword(userName, oldPlain, newPlain) {
    if (!newPlain || newPlain.length < 4) {
        return { ok: false, error: 'Nytt lösenord måste vara minst 4 tecken.' };
    }

    const correct = await verifyPassword(userName, oldPlain);
    if (!correct) {
        return { ok: false, error: 'Nuvarande lösenord stämmer inte.' };
    }

    const newHash   = await sha256(newPlain);
    const passwords = await loadPasswords();
    await setDoc(passwordsRef, { ...passwords, [userName]: newHash });
    return { ok: true };
}