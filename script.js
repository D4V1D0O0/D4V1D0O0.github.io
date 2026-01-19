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
const debtsRef = doc(db, 'Saldo', 'Debts');

let startingBalance = 0;
let purchases = [];
let startingBalanceLoaded = false;
let purchasesLoaded = false;

function formatAmount(value) {
    if (typeof value !== 'number' || isNaN(value)) {
        value = 0;
    }
    return value.toLocaleString('sv-SE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Mobile viewport height fix
function setViewportHeight() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}
setViewportHeight();
window.addEventListener('resize', setViewportHeight);

function loadData() {
    const startingBalanceRef = doc(db, 'Saldo', 'StartingBalance');
    onSnapshot(startingBalanceRef, (snapshot) => {
        if (snapshot.exists()) {
            startingBalance = snapshot.data().Amount || 0;
            console.log('Starting balance loaded:', startingBalance);
        }
        startingBalanceLoaded = true;
        displayBalance();
        hideSplashWhenReady();
    }, (error) => {
        console.error('Error loading starting balance:', error);
        document.getElementById('startingBalance').textContent = 'Fel: ' + error.message;
    });
    
    const purchasesRef = doc(db, 'Saldo', 'Purchases');
    onSnapshot(purchasesRef, (snapshot) => {
        if (snapshot.exists()) {
            purchases = snapshot.data().entries || [];
            console.log('Purchases loaded:', purchases);
        } else {
            purchases = [];
            console.log('Purchases document does not exist');
        }
        purchasesLoaded = true;
        displayBalance();
        displayEntries();
        displayDebts();
        hideSplashWhenReady();
    }, (error) => {
        console.error('Error loading purchases:', error);
        document.getElementById('balance').textContent = 'Fel: ' + error.message;
    });
}

function displayBalance() {
    const totalSpent = purchases.reduce((sum, entry) => sum + (entry.TotalCost || 0), 0);
    const currentBalance = startingBalance - totalSpent;
    
    document.getElementById('balance').textContent = formatAmount(currentBalance) + ' kr';
    document.getElementById('startingBalance').textContent = 'Startsaldo: ' + formatAmount(startingBalance) + ' kr';
}

function displayDebts() {
    const debts = {};

    purchases.forEach(entry => {
        const payer = entry.Payer;
        const personal = typeof entry.PersonalCost === 'number' ? entry.PersonalCost : 0;
        if (!payer || !personal || personal <= 0) return;
        debts[payer] = (debts[payer] || 0) + personal;
    });

    const container = document.getElementById('debtsSummary');
    const names = Object.keys(debts);

    if (names.length === 0) {
        container.textContent = 'Inga skulder, yippee!';
        return;
    }

    container.innerHTML = '';
    names.forEach(name => {
        const amount = debts[name];
        const div = document.createElement('div');
        div.className = 'debt-item';
        div.textContent = `${name}: ${formatAmount(amount)} kr`;
        container.appendChild(div);
    });
}

function displayEntries() {
    const entriesList = document.getElementById('entriesList');
    entriesList.innerHTML = '';
    
    const sortedEntries = [...purchases].reverse();
    sortedEntries.forEach((entry, reversedIndex) => {
        const originalIndex = purchases.length - 1 - reversedIndex;
        
        let dateStr = '';
        if (entry.Date) {
            if (entry.Date.toDate) {
                dateStr = entry.Date.toDate().toLocaleString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
            } else if (typeof entry.Date === 'string') {
                dateStr = new Date(entry.Date).toLocaleString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
            }
        }
        
        const entryDiv = document.createElement('div');
        entryDiv.className = 'entry';

        const sharedValue = typeof entry.SharedCost === 'number' ? entry.SharedCost : (entry.Cost || 0);
        const totalValue = typeof entry.TotalCost === 'number' ? entry.TotalCost : sharedValue;
        const personalValue = typeof entry.PersonalCost === 'number' ? entry.PersonalCost : 0;
        const payer = entry.Payer || '';

        const amountText = '-' + formatAmount(totalValue) + ' kr';

        const detailsParts = [];
        if (totalValue && totalValue !== sharedValue) {
            detailsParts.push(`Totalt: ${formatAmount(totalValue)} kr`);
        }
        if (sharedValue && (totalValue !== sharedValue || personalValue > 0)) {
            detailsParts.push(`Gemensamt: ${formatAmount(sharedValue)} kr`);
        }
        if (personalValue > 0) {
            const personalText = formatAmount(personalValue) + ' kr';
            if (payer) {
                detailsParts.push(`Privat: ${personalText} (${payer})`);
            } else {
                detailsParts.push(`Privat: ${personalText}`);
            }
        }
        const detailsLine = detailsParts.join(' · ');

        const detailsHtml = detailsLine
            ? `<div class="entry-details">${detailsLine}</div>`
            : '';

        entryDiv.innerHTML = `
            <div class="entry-header">
                <span class="entry-item">${entry.Type || 'N/A'}</span>
                <span class="entry-amount">${amountText}</span>
            </div>
            <div class="entry-footer">
                <span class="entry-date">${dateStr}</span>
                <button class="delete-btn" onclick="deleteEntry(${originalIndex})">Radera</button>
            </div>
            ${detailsHtml}
        `;
        entriesList.appendChild(entryDiv);
    });
}

function deleteEntry(index) {
    purchases.splice(index, 1);
    saveData();
    displayBalance();
    displayEntries();
    displayDebts();
}

window.deleteEntry = deleteEntry;

function saveData() {
    const purchasesRef = doc(db, 'Saldo', 'Purchases');
    updateDoc(purchasesRef, {
        entries: purchases
    });
    console.log('Data saved to Firestore');
}

// Form toggle functionality for "Lägg till" tab
const toggleToExpense = document.getElementById('toggleToExpense');
const toggleToDebt = document.getElementById('toggleToDebt');
const expenseForm = document.getElementById('expenseForm');
const debtForm = document.getElementById('debtForm');

function switchAddForm(showExpense) {
    if (showExpense) {
        expenseForm.classList.add('active');
        debtForm.classList.remove('active');
        toggleToExpense.classList.add('active');
        toggleToDebt.classList.remove('active');
    } else {
        expenseForm.classList.remove('active');
        debtForm.classList.add('active');
        toggleToExpense.classList.remove('active');
        toggleToDebt.classList.add('active');
    }
}

toggleToExpense.addEventListener('click', () => switchAddForm(true));
toggleToDebt.addEventListener('click', () => switchAddForm(false));

// Expense form submission
document.getElementById('expenseForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const item = document.getElementById('itemInput').value;
    const totalAmount = parseFloat(document.getElementById('totalAmountInput').value);
    const personalRaw = document.getElementById('personalAmountInput').value;
    const personalAmount = personalRaw === '' ? 0 : parseFloat(personalRaw);
    const payer = document.getElementById('payerSelect').value;

    if (!item.trim()) {
        alert('Skriv vad du köpte.');
        return;
    }

    if (isNaN(totalAmount) || totalAmount <= 0) {
        alert('Totalbelopp måste vara större än 0.');
        return;
    }

    if (isNaN(personalAmount) || personalAmount < 0) {
        alert('Privat del kan inte vara negativ.');
        return;
    }

    if (personalAmount > totalAmount) {
        alert('Den privata delen kan inte vara större än totalbeloppet.');
        return;
    }

    if (!payer) {
        alert('Välj vem som betalade.');
        return;
    }

    const sharedAmount = totalAmount - personalAmount;

    const newEntry = {
        Type: item,
        Cost: sharedAmount,
        TotalCost: totalAmount,
        PersonalCost: personalAmount,
        SharedCost: sharedAmount,
        Payer: payer,
        Date: new Date().toISOString()
    };
    
    purchases.push(newEntry);
    
    saveData();
    displayBalance();
    displayEntries();
    displayDebts();
    
    // Clear form
    document.getElementById('itemInput').value = '';
    document.getElementById('totalAmountInput').value = '';
    document.getElementById('personalAmountInput').value = '';
    document.getElementById('payerSelect').value = '';
});

// Debt form submission
document.getElementById('debtForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const from = document.getElementById('debtFrom').value;
    const to = document.getElementById('debtTo').value;
    const amount = parseFloat(document.getElementById('debtAmount').value);
    const message = document.getElementById('debtMessage').value.trim();

    if (from === to) {
        alert('Kan inte vara samma person');
        return;
    }

    const entry = {
        from,
        to,
        amount,
        message,
        date: new Date().toISOString()
    };

    await updateDoc(debtsRef, {
        entries: arrayUnion(entry)
    });

    // Clear form
    document.getElementById('debtAmount').value = '';
    document.getElementById('debtMessage').value = '';
    document.getElementById('debtTo').value = '';
    document.getElementById('debtFrom').value = '';
});

// Tab navigation
const tabs = document.querySelectorAll('.tab');
const navButtons = document.querySelectorAll('.nav-btn');

function switchTab(tabName) {
    tabs.forEach(tab => {
        tab.classList.toggle('active', tab.id === `tab-${tabName}`);
    });

    navButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
}

navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        switchTab(btn.dataset.tab);
    });
});

function hideSplashWhenReady() {
    if (!startingBalanceLoaded || !purchasesLoaded) return;

    const splash = document.getElementById('splash');
    if (!splash) return;

    splash.classList.add('hidden');
    setTimeout(() => splash.remove(), 700);
}

loadData();
