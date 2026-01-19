import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getFirestore, doc, onSnapshot, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDeUOT-hWKgAnAtlwRFujoOpJNDP_WljoE",
    authDomain: "polhemsgatan17b.firebaseapp.com",
    projectId: "polhemsgatan17b",
    messagingSenderId: "330775555909",
    appId: "1:330775555909:web:e644773610112ef007182c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Phone book
const roommates = {
    David: "0723313868",
    Julius: "0706848252",
    Alvin: "0727164423"
};

const meSelect = document.getElementById('meSelect');
const receiverSelect = document.getElementById('receiverSelect');
const amountText = document.getElementById('amountText');
const payBtn = document.getElementById('payBtn');

let allDebts = [];
let payments = [];

// Populate "me"
Object.keys(roommates).forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    meSelect.appendChild(opt);
});

// Load debts
const debtsRef = doc(db, 'Saldo', 'Debts');
onSnapshot(debtsRef, snap => {
    allDebts = snap.exists() ? snap.data().entries || [] : [];
    payments = snap.exists() ? snap.data().payments || [] : [];
    updateReceivers();
});

meSelect.addEventListener('change', updateReceivers);
receiverSelect.addEventListener('change', updateAmount);

function createPaymentModal() {
    if (document.getElementById('paymentModal')) {
        return;
    }

    const modal = document.createElement('div');
    modal.id = 'paymentModal';
    modal.className = 'payment-modal-overlay';
    modal.innerHTML = `
        <div class="payment-modal">
            <div class="payment-modal-header">
                <h2>Bekräfta Betalning</h2>
            </div>
            <div class="payment-modal-body">
                <p id="paymentModalMessage"></p>
            </div>
            <div class="payment-modal-footer">
                <button id="paymentCancelBtn" class="btn btn-secondary">Avbryt</button>
                <button id="paymentConfirmBtn" class="btn btn-primary">Bekräfta</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const cancelBtn = document.getElementById('paymentCancelBtn');
    const confirmBtn = document.getElementById('paymentConfirmBtn');

    cancelBtn.addEventListener('click', cancelPayment);
    confirmBtn.addEventListener('click', confirmPayment);
}

function getUnpaidDebts() {
    // Calculate unpaid debts by subtracting payments from debts
    const debtsMap = {};
    
    // Add all debts
    allDebts.forEach(debt => {
        const key = `${debt.from}-${debt.to}`;
        if (!debtsMap[key]) {
            debtsMap[key] = { from: debt.from, to: debt.to, amount: 0, debts: [], unpaidDebts: [] };
        }
        debtsMap[key].amount += debt.amount;
        debtsMap[key].debts.push(debt);
    });
    
    // Subtract payments and track which debts are unpaid
    payments.forEach(payment => {
        const key = `${payment.from}-${payment.to}`;
        if (debtsMap[key]) {
            debtsMap[key].amount -= payment.amount;
        }
    });
    
    // Determine which individual debts are unpaid
    Object.keys(debtsMap).forEach(key => {
        const record = debtsMap[key];
        let remainingAmount = record.amount;
        
        // Sort debts by date (oldest first) and mark as unpaid until remaining amount is 0
        const sortedDebts = [...record.debts].sort((a, b) => new Date(a.date) - new Date(b.date));
        record.unpaidDebts = [];
        
        for (const debt of sortedDebts) {
            if (remainingAmount > 0) {
                record.unpaidDebts.push(debt);
                remainingAmount -= debt.amount;
            }
        }
    });
    
    // Return only positive (unpaid) amounts
    return Object.values(debtsMap).filter(d => d.amount > 0);
}

function updateReceivers() {
    const me = meSelect.value;
    if (!me) return;

    const unpaidDebts = getUnpaidDebts();
    const owed = unpaidDebts.filter(d => d.from === me);

    receiverSelect.innerHTML = '';

    const uniqueReceivers = [...new Set(owed.map(d => d.to))];

    uniqueReceivers.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        receiverSelect.appendChild(opt);
    });

    updateAmount();
}

function updateAmount() {
    const me = meSelect.value;
    const to = receiverSelect.value;
    if (!me || !to) {
        amountText.textContent = '0.00';
        return;
    }

    const unpaidDebts = getUnpaidDebts();
    const debt = unpaidDebts.find(d => d.from === me && d.to === to);
    const amount = debt ? debt.amount : 0;

    amountText.textContent = amount.toFixed(2);
}

payBtn.addEventListener('click', () => {
    const me = meSelect.value;
    const to = receiverSelect.value;
    const amount = parseFloat(amountText.textContent);

    if (!to || amount <= 0) {
        alert('Ingen skuld att betala');
        return;
    }

    // Get the debt record to aggregate messages
    const unpaidDebts = getUnpaidDebts();
    const debtRecord = unpaidDebts.find(d => d.from === me && d.to === to);
    
    if (!debtRecord) {
        alert('Kunde inte hitta skulden');
        return;
    }

    // Aggregate messages from UNPAID debts only
    const messages = debtRecord.unpaidDebts
        .map(d => d.message)
        .filter(m => m && m.trim());
    const message = messages.length > 0 ? messages.join(' + ') : 'Betalning av skuld';

    // Store payment info for confirmation
    window.pendingPayment = {
        from: me,
        to: to,
        amount: amount,
        message: message,
        timestamp: new Date().toISOString()
    };

    openSwish(roommates[to], amount, message);
    showPaymentModal(me, to, amount, message);
});

function openSwish(phone, amount, message) {
    const swishData = {
        version: 1,
        payee: { value: phone.replace(/^0/, '+46') },
        amount: { value: Math.round(amount) },
        message: { value: message }
    };

    window.location.href = 'swish://payment?data=' + encodeURIComponent(JSON.stringify(swishData));
}

function showPaymentModal(payer, receiver, expectedAmount, message) {
    createPaymentModal();
    
    const modal = document.getElementById('paymentModal');
    const messageEl = document.getElementById('paymentModalMessage');
    const confirmBtn = document.getElementById('paymentConfirmBtn');
    
    messageEl.innerHTML = `
        <strong>Från:</strong> ${payer}<br>
        <strong>Till:</strong> ${receiver}<br>
        <strong>Belopp:</strong> ${expectedAmount.toFixed(2)} kr<br>
        <strong>Meddelande:</strong> ${message}<br><br>
        <span style="font-size: 12px; color: #999;">Bekräfta att du har genomfört Swish-betalningen</span>
    `;
    
    confirmBtn.dataset.payer = payer;
    confirmBtn.dataset.receiver = receiver;
    confirmBtn.dataset.expectedAmount = expectedAmount;
    
    modal.classList.add('active');
}

async function confirmPayment() {
    if (!window.pendingPayment) {
        alert('Ingen betalning att bekräfta');
        hidePaymentModal();
        return;
    }

    const confirmBtn = document.getElementById('paymentConfirmBtn');
    const payer = confirmBtn.dataset.payer;
    const receiver = confirmBtn.dataset.receiver;
    const expectedAmount = parseFloat(confirmBtn.dataset.expectedAmount);
    const actualAmount = window.pendingPayment.amount;

    // Check if payment amount matches expected debt amount
    if (Math.abs(actualAmount - expectedAmount) > 0.01) {
        const mismatchWarning = `Varning: Belopp stämmer inte!\n\n` +
            `Förväntad skuld: ${expectedAmount.toFixed(2)} kr\n` +
            `Betalat belopp: ${actualAmount.toFixed(2)} kr\n\n` +
            `Vill du fortsätta ändå?`;
        
        if (!confirm(mismatchWarning)) {
            return;
        }
    }

    try {
        const payment = {
            from: payer,
            to: receiver,
            amount: actualAmount,
            date: window.pendingPayment.timestamp
        };

        // Add payment to database
        await updateDoc(debtsRef, {
            payments: arrayUnion(payment)
        });

        alert('Betalning bekräftad!');
        hidePaymentModal();
        updateReceivers();
    } catch (error) {
        console.error('Error confirming payment:', error);
        alert('Fel vid bekräftelse av betalning: ' + error.message);
    }
}

function cancelPayment() {
    hidePaymentModal();
}

function hidePaymentModal() {
    const modal = document.getElementById('paymentModal');
    if (modal) {
        modal.classList.remove('active');
    }
    window.pendingPayment = null;
}

// Auto-hide confirm button after a period of inactivity
setInterval(() => {
    const confirmBtn = document.getElementById('confirmPaymentBtn');
    if (confirmBtn && confirmBtn.style.display !== 'none') {
        const now = new Date().getTime();
        const paymentTime = new Date(window.pendingPayment?.timestamp).getTime();
        // Hide if more than 5 minutes have passed since payment was initiated
        if (now - paymentTime > 5 * 60 * 1000) {
            hidePaymentConfirmButton();
        }
    }
}, 30000); // Check every 30 seconds
