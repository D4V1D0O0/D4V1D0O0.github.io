fetch('data.csv')
    .then(response => response.text())
    .then(data => {
        const workbook = XLSX.read(data, {type: 'string'});
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, {header: 1});
        
        let balance = '';
        let updated = '';
        
        for (let i = rows.length - 1; i >= 0; i--) {
            const row = rows[i];
            if (row[0] === 'Aktuellt saldo' && !balance) {
                balance = row[1];
            }
            if (row[0] === 'Datum' && !updated) {
                updated = row[1];
            }
            if (balance && updated) break;
        }
        
        document.getElementById('balance').textContent = balance;
        document.getElementById('updated').textContent = 'Uppdaterad ' + updated;
    })
    .catch(error => {
        console.error('Error loading CSV:', error);
        document.getElementById('balance').textContent = 'Error loading data';
        document.getElementById('updated').textContent = 'Error';
    });