// ── PASSWORDS ─────────────────────────────────────────────────────────────
// Change these to whatever passwords you want for each person.
const PASSWORDS = {
    David:  "David123",
    Julius: "Julius123",
    Alvin:  "Johnnybravo67"
};
// ──────────────────────────────────────────────────────────────────────────

// If already logged in, go straight to the app
if (localStorage.getItem('saldo_user')) {
    window.location.replace('index.html');
}

let selectedName = null;

const nameBtns     = document.querySelectorAll('.name-btn');
const passwordInput = document.getElementById('passwordInput');
const loginBtn     = document.getElementById('loginBtn');
const errorMsg     = document.getElementById('errorMsg');
const togglePw     = document.getElementById('togglePw');
const eyeIcon      = document.getElementById('eyeIcon');

// Name selection
nameBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        nameBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedName = btn.dataset.name;
        errorMsg.classList.remove('visible');
        passwordInput.focus();
    });
});

// Toggle password visibility
togglePw.addEventListener('click', () => {
    const isHidden = passwordInput.type === 'password';
    passwordInput.type = isHidden ? 'text' : 'password';
    eyeIcon.innerHTML = isHidden
        ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
           <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
           <line x1="1" y1="1" x2="23" y2="23"/>`
        : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
           <circle cx="12" cy="12" r="3"/>`;
});

// Login attempt
function attemptLogin() {
    errorMsg.classList.remove('visible');

    if (!selectedName) {
        errorMsg.textContent = 'Välj vem du är först.';
        errorMsg.classList.add('visible');
        return;
    }

    const pw = passwordInput.value;
    if (pw === PASSWORDS[selectedName]) {
        localStorage.setItem('saldo_user', selectedName);
        window.location.replace('index.html');
    } else {
        passwordInput.value = '';
        errorMsg.textContent = 'Fel lösenord. Försök igen.';
        errorMsg.classList.add('visible');
        passwordInput.focus();
    }
}

loginBtn.addEventListener('click', attemptLogin);
passwordInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') attemptLogin();
});