import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getFirestore, collection, doc, onSnapshot, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDeUOT-hWKgAnAtlwRFujoOpJNDP_WljoE",
    authDomain: "polhemsgatan17b.firebaseapp.com",
    projectId: "polhemsgatan17b",
    messagingSenderId: "330775555909",
    appId: "1:330775555909:web:e644773610112ef007182c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let startingBalance = 0;
let purchases = [];

function formatAmount(value) {
    if (typeof value !== 'number' || isNaN(value)) {
        value = 0;
    }
    // Swedish-style formatting: 9 000,00 (space as thousands separator, comma as decimal)
    return value.toLocaleString('sv-SE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// --- Mobile viewport height fix (for proper 100vh on mobile) ---
function setViewportHeight() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}
setViewportHeight();
window.addEventListener('resize', setViewportHeight);
// --- End viewport fix ---

function loadData() {
    // Load Starting Balance
    const startingBalanceRef = doc(db, 'Saldo', 'StartingBalance');
    onSnapshot(startingBalanceRef, (snapshot) => {
        if (snapshot.exists()) {
            startingBalance = snapshot.data().Amount || 0;
            console.log('Starting balance loaded:', startingBalance);
        }
        displayBalance();
    }, (error) => {
        console.error('Error loading starting balance:', error);
        document.getElementById('startingBalance').textContent = 'Fel: ' + error.message;
    });
    
    // Load Purchases
    const purchasesRef = doc(db, 'Saldo', 'Purchases');
    onSnapshot(purchasesRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data();
            purchases = data.entries || [];
            console.log('Purchases loaded:', purchases);
        } else {
            purchases = [];
            console.log('Purchases document does not exist');
        }
        displayBalance();
        displayEntries();
        displayDebts();
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
        // Calculate the original index
        const originalIndex = purchases.length - 1 - reversedIndex;
        
        let dateStr = '';
        if (entry.Date) {
            if (entry.Date.toDate) {
                // Firebase Timestamp
                dateStr = entry.Date.toDate().toLocaleString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
            } else if (typeof entry.Date === 'string') {
                // ISO string
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
                // detailsParts.push(`Privat: ${personalText} (${payer} är skyldig ${personalText})`);
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

// Make functions available globally for onclick handlers
window.deleteEntry = deleteEntry;

// --- Collapsible expense form toggle ---
const formSection = document.querySelector('.form-section');
const expenseFormEl = document.getElementById('expenseForm');
const toggleFormButton = document.getElementById('toggleFormButton');

if (window.innerWidth <= 600) {
    formSection.classList.remove('form-open');
    updateFormToggleLabel();
}

function updateFormToggleLabel() {
    if (!toggleFormButton || !formSection) return;
    const isOpen = formSection.classList.contains('form-open');
    toggleFormButton.textContent = isOpen ? 'Dölj formulär' : '+ Lägg till utgift';
}

if (toggleFormButton && formSection) {
    toggleFormButton.addEventListener('click', () => {
        formSection.classList.toggle('form-open');
        updateFormToggleLabel();
    });

    // Ensure correct initial label
    updateFormToggleLabel();
}
// --- End collapsible form toggle ---

function saveData() {
    const purchasesRef = doc(db, 'Saldo', 'Purchases');
    updateDoc(purchasesRef, {
        entries: purchases
    });
    console.log('Data saved to Firestore');
}

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
        // Cost is the shared part, used for saldo-beräkning (bakåtkompatibelt)
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
    
    document.getElementById('itemInput').value = '';
    document.getElementById('totalAmountInput').value = '';
    document.getElementById('personalAmountInput').value = '';
    document.getElementById('payerSelect').value = '';

    // On small screens, collapse the form after adding an expense to keep focus on the list
    if (window.innerWidth <= 600 && formSection) {
        formSection.classList.remove('form-open');
        updateFormToggleLabel();
    }
});

window.addEventListener('load', () => {
    const splash = document.getElementById('splash');
    if (!splash) return;

    // Liten delay för snyggare känsla
    setTimeout(() => {
        splash.classList.add('hidden');

        // Ta bort helt efter fade
        setTimeout(() => splash.remove(), 700);
    }, 500);
});

// Load data on page load
loadData();
