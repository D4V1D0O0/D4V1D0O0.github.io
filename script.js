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
    }, (error) => {
        console.error('Error loading purchases:', error);
        document.getElementById('balance').textContent = 'Fel: ' + error.message;
    });
}

function displayBalance() {
    const totalSpent = purchases.reduce((sum, entry) => sum + (entry.Cost || 0), 0);
    const currentBalance = startingBalance - totalSpent;
    
    document.getElementById('balance').textContent = currentBalance.toFixed(2) + ' kr';
    document.getElementById('startingBalance').textContent = 'Startsaldo: ' + startingBalance.toFixed(2) + ' kr';
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

        entryDiv.innerHTML = `
            <div class="entry-header">
                <span class="entry-item">${entry.Type || 'N/A'}</span>
                <span class="entry-amount">-${parseFloat(entry.Cost || 0).toFixed(2)} kr</span>
            </div>
            <div class="entry-footer">
                <span class="entry-date">${dateStr}</span>
                <button class="delete-btn" onclick="deleteEntry(${originalIndex})">Radera</button>
            </div>
        `;
        entriesList.appendChild(entryDiv);
    });
}

function deleteEntry(index) {
    purchases.splice(index, 1);
    saveData();
    displayBalance();
    displayEntries();
}

// Make functions available globally for onclick handlers
window.deleteEntry = deleteEntry;

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
    const amount = parseFloat(document.getElementById('amountInput').value);

    if (isNaN(amount) || amount < 0) {
        alert('Belopp kan inte vara negativt.');
        return;
    }
    
    const newEntry = {
        Type: item,
        Cost: amount,
        Date: new Date().toISOString()
    };
    
    purchases.push(newEntry);
    
    saveData();
    displayBalance();
    displayEntries();
    
    document.getElementById('itemInput').value = '';
    document.getElementById('amountInput').value = '';
});

// Load data on page load
loadData();
