document.addEventListener('DOMContentLoaded', async () => {
    const wheatPriceEl = document.getElementById('wheat-price');
    const wheatChangeEl = document.getElementById('wheat-change');
    const cornPriceEl = document.getElementById('corn-price');
    const cornChangeEl = document.getElementById('corn-change');

    if (!wheatPriceEl || !cornPriceEl) return;

    try {
        const response = await fetch('/api/market-data');
        if (!response.ok) throw new Error('Network response was not ok');
        
        const result = await response.json();
        const data = result.data;
        
        // Find Wheat (ZW=F) and Corn (ZC=F)
        const wheat = data.find(d => d.symbol === 'ZW=F');
        const corn = data.find(d => d.symbol === 'ZC=F');

        const updateUI = (item, priceEl, changeEl) => {
            if (!item) return;
            
            // Format price: eg 540.25
            priceEl.textContent = `${item.price.toFixed(2)} ${item.currency}`;
            
            // Format change
            const isPositive = item.change >= 0;
            const sign = isPositive ? '+' : '';
            const colorClass = isPositive ? 'change-positive' : 'change-warning';
            const iconPath = isPositive 
                ? 'M7 14l5-5 5 5z' // Up arrow
                : 'M7 10l5 5 5-5z'; // Down arrow
                
            changeEl.className = `metric-change ${colorClass}`;
            changeEl.innerHTML = `
                <svg class="icon" viewBox="0 0 24 24"><path d="${iconPath}"/></svg>
                ${sign}${item.changePercent.toFixed(2)}% (${sign}${item.change.toFixed(2)})
            `;
        };

        updateUI(wheat, wheatPriceEl, wheatChangeEl);
        updateUI(corn, cornPriceEl, cornChangeEl);

    } catch (error) {
        console.error('Failed to load live market data:', error);
        wheatPriceEl.textContent = "Data unavailable";
        cornPriceEl.textContent = "Data unavailable";
    }
});
