/**
 * Placeholder nav links (href="#") — scroll or gentle "coming soon" instead of dead click.
 */
(function initFurrowNavStubs() {
	const subscribe = document.getElementById('subscribe');
	const sample = 'article/sample.html';

	const scrollTargets = {
		markets: '#markets-sidebar',
		regions: '#regions-sidebar',
		analysis: '/archive',
		data: '/archive',
		reports: sample,
		about: '#subscribe',
	};

	document.querySelectorAll('a[href="#"]').forEach((link) => {
		if (link.closest('.lang-switch')) return;

		link.addEventListener('click', (e) => {
			e.preventDefault();
			const key = (link.getAttribute('data-i18n') || '').split('.').pop();
			const sel = scrollTargets[key];
			if (sel && sel.startsWith('#')) {
				const el = document.querySelector(sel);
				if (el) {
					el.scrollIntoView({ behavior: 'smooth', block: 'start' });
					return;
				}
			}
			if (sel && (sel.endsWith('.html') || sel.startsWith('/'))) {
				window.location.href = sel;
				return;
			}
			if (subscribe) {
				subscribe.scrollIntoView({ behavior: 'smooth' });
			}
		});
	});
})();
