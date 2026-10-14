(function initTomatoArticleCharts() {
	const globalTrend = {
		years: [2023, 2024, 2025, 2026],
		values: [44.4, 45.9, 40.3, 39.8],
		title: { en: 'Global processing tomato production', ru: 'Мировое производство томатов для переработки' },
		axisY: { en: 'Million tonnes', ru: 'Млн тонн' },
		axisX: { en: 'Year', ru: 'Год' },
	};

	const byCountry = {
		labels: {
			en: ['Italy', 'Spain', 'China', 'Portugal', 'Chile', 'Egypt', 'France', 'Bulgaria'],
			ru: ['Италия', 'Испания', 'Китай', 'Португалия', 'Чили', 'Египет', 'Франция', 'Болгария'],
		},
		values: [5.8, 2.6, 5.0, 1.3, 1.2, 0.8, 0.15, 0.02],
		colors: ['#4a7c3a', '#4a7c3a', '#2c5f2d', '#4a7c3a', '#6b8f71', '#2c5f2d', '#4a7c3a', '#4a7c3a'],
		axisLabel: { en: 'Million tonnes', ru: 'Млн тонн' },
	};

	const charts = { trend: null, country: null };

	function getLang() {
		return window.FurrowI18n?.getLang?.() || 'en';
	}

	function destroyCharts() {
		if (charts.trend) {
			charts.trend.destroy();
			charts.trend = null;
		}
		if (charts.country) {
			charts.country.destroy();
			charts.country = null;
		}
	}

	function renderTrend(lang) {
		const canvas = document.getElementById('tomatoTrendChart');
		if (!canvas || typeof Chart === 'undefined') return;

		charts.trend = new Chart(canvas, {
			type: 'line',
			data: {
				labels: globalTrend.years,
				datasets: [
					{
						data: globalTrend.values,
						borderColor: '#2c5f2d',
						backgroundColor: 'rgba(44, 95, 45, 0.12)',
						fill: true,
						tension: 0.2,
						pointRadius: 5,
						pointBackgroundColor: '#2c5f2d',
						pointBorderColor: '#fff',
						pointBorderWidth: 2,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { display: false },
					title: {
						display: true,
						text: globalTrend.title[lang],
						font: { size: 13, family: 'system-ui' },
						color: '#1a2a3a',
					},
					tooltip: {
						callbacks: {
							label: (c) => `${c.parsed.y} ${globalTrend.axisY[lang].toLowerCase()}`,
						},
					},
				},
				scales: {
					x: {
						title: {
							display: true,
							text: globalTrend.axisX[lang],
							font: { size: 12, family: 'system-ui' },
						},
						grid: { display: false },
					},
					y: {
						beginAtZero: false,
						min: 38,
						max: 47,
						title: {
							display: true,
							text: globalTrend.axisY[lang],
							font: { size: 12, family: 'system-ui' },
						},
						grid: { color: '#e2e8f0' },
					},
				},
			},
		});
	}

	function renderCountry(lang) {
		const canvas = document.getElementById('tomatoChart');
		if (!canvas || typeof Chart === 'undefined') return;

		charts.country = new Chart(canvas, {
			type: 'bar',
			data: {
				labels: byCountry.labels[lang],
				datasets: [
					{
						data: byCountry.values,
						backgroundColor: byCountry.colors,
						borderRadius: 3,
						borderWidth: 0,
					},
				],
			},
			options: {
				indexAxis: 'y',
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { display: false },
					tooltip: {
						callbacks: {
							label: (c) =>
								c.parsed.x.toFixed(2) + ' ' + byCountry.axisLabel[lang].toLowerCase(),
						},
					},
				},
				scales: {
					x: {
						beginAtZero: true,
						title: {
							display: true,
							text: byCountry.axisLabel[lang],
							font: { size: 12, family: 'system-ui' },
							color: '#64748b',
						},
						grid: { color: '#e2e8f0' },
						ticks: { font: { size: 11 } },
					},
					y: {
						ticks: { font: { size: 12 } },
						grid: { display: false },
					},
				},
			},
		});
	}

	function renderAll() {
		const lang = getLang();
		destroyCharts();
		renderTrend(lang);
		renderCountry(lang);
	}

	function tryRender() {
		if (typeof Chart !== 'undefined') renderAll();
		else setTimeout(tryRender, 50);
	}

	document.addEventListener('DOMContentLoaded', tryRender);
	document.addEventListener('furrow-lang-change', renderAll);
})();
