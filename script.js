let data = {};

function loadData() {
    fetch('data.json')
        .then(response => response.json())
        .then(jsonData => {
            data = jsonData;
            displayBalance();
            displayEntries();
        })
        .catch(error => {
            console.error('Error loading data:', error);
            document.getElementById('balance').textContent = 'Error loading data';
        });
}

function displayBalance() {
    const startingBalance = data.startingBalance || 0;
    const totalSpent = (data.entries || []).reduce((sum, entry) => sum + entry.amount, 0);
    const currentBalance = startingBalance - totalSpent;
    
    document.getElementById('balance').textContent = currentBalance.toFixed(2) + ' kr';
    document.getElementById('startingBalance').textContent = 'Startosaldo: ' + startingBalance.toFixed(2) + ' kr';
}

function displayEntries() {
    const entriesList = document.getElementById('entriesList');
    entriesList.innerHTML = '';
    
    const sortedEntries = [...(data.entries || [])].reverse();
    sortedEntries.forEach((entry, index) => {
        const date = new Date(entry.date);
        const dateStr = date.toLocaleString('sv-SE');
        
        const entryDiv = document.createElement('div');
        entryDiv.className = 'entry';
        entryDiv.innerHTML = `
            <div class="entry-header">
                <span class="entry-item">${entry.item}</span>
                <span class="entry-amount">-${entry.amount.toFixed(2)} kr</span>
            </div>
            <div class="entry-footer">
                <span class="entry-date">${dateStr}</span>
                <button class="delete-btn" onclick="deleteEntry(${index})">Radera</button>
            </div>
        `;
        entriesList.appendChild(entryDiv);
    });
}

function deleteEntry(index) {
    data.entries.splice(index, 1);
    saveData();
    displayBalance();
    displayEntries();
}

function saveData() {
    // Note: This saves to localStorage for now since browsers can't write files directly
    localStorage.setItem('expenseData', JSON.stringify(data));
    console.log('Data saved to localStorage');
}

document.getElementById('expenseForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const item = document.getElementById('itemInput').value;
    const amount = parseFloat(document.getElementById('amountInput').value);
    
    const newEntry = {
        id: (data.entries || []).length + 1,
        item: item,
        amount: amount,
        date: new Date().toISOString()
    };
    
    if (!data.entries) {
        data.entries = [];
    }
    data.entries.push(newEntry);
    
    saveData();
    displayBalance();
    displayEntries();
    
    document.getElementById('itemInput').value = '';
    document.getElementById('amountInput').value = '';
});

// Load data on page load
loadData();