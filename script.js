fetch('data.json')
    .then(response => response.json())
    .then(data => {
        const balance = data.balance;
        const updated = data.updated;
        document.getElementById('balance').textContent = balance + ' kr';
        document.getElementById('updated').textContent = 'Updaterad: ' + updated;
    })
    .catch(error => {
        console.error('Error loading JSON:', error);
        document.getElementById('balance').textContent = 'Error loading data';
        document.getElementById('updated').textContent = 'Error';
    });