/**
 * Live delayed ticker — GET /api/furrow-signals (Yahoo CBOT proxy).
 */
(function initFurrowTicker() {
	const stream = document.querySelector('.ticker-stream');
	if (!stream) return;

	const SYMBOL = {
		cbot_wheat: 'WHEAT',
		cbot_corn: 'CORN',
		cbot_soy: 'SOYBEANS',
		baltic_dry: 'BDI',
	};

	function formatPrice(f) {
		if (f.price == null) return '—';
		if (f.unit === 'USD/bu') return `$${Number(f.price).toFixed(2)}`;
		return String(Number(f.price).toFixed(2));
	}

	function changeClass(pct) {
		if (pct == null) return 'flat';
		if (pct > 0) return 'up';
		if (pct < 0) return 'down';
		return 'flat';
	}

	function formatChange(pct) {
		if (pct == null) return '—';
		const sign = pct > 0 ? '+' : '';
		return `${sign}${pct}%`;
	}

	function renderItem(f) {
		const sym = SYMBOL[f.id] || f.symbol.replace('=F', '');
		const cls = changeClass(f.changePct);
		return `<span class="ticker-item">
        <span class="ticker-symbol">${sym}</span>
        <span class="ticker-price">${formatPrice(f)}</span>
        <span class="ticker-change ${cls}">${formatChange(f.changePct)}</span>
      </span>`;
	}

	async function load() {
		try {
			const res = await fetch('/api/furrow-signals', { cache: 'no-store' });
			if (!res.ok) return;
			const data = await res.json();
			const futures = Array.isArray(data.futures) ? data.futures : [];
			if (!futures.length) return;
			stream.innerHTML = futures.map(renderItem).join('');
			const label = document.querySelector('.ticker-label');
			if (label && data.updatedAt) {
				label.setAttribute('title', `Updated ${data.updatedAt}`);
			}
		} catch {
			/* keep static demo values */
		}
	}

	load();
	setInterval(load, 15 * 60 * 1000);
})();
