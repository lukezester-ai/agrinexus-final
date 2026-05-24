/**
 * EN / BG language switch for Furrow marketing pages.
 */
(function initFurrowI18n() {
	const STORAGE_KEY = 'furrow_lang';
	const DEFAULT_LANG = 'en';

	function getLang() {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved === 'en' || saved === 'bg') return saved;
		/* Legacy key from older builds */
		if (saved === 'ru') {
			localStorage.setItem(STORAGE_KEY, 'bg');
			return 'bg';
		}
		const nav = (navigator.language || '').toLowerCase();
		return nav.startsWith('bg') ? 'bg' : DEFAULT_LANG;
	}

	function apply(lang) {
		if (lang === 'ru') lang = 'bg';
		document.documentElement.lang = lang === 'bg' ? 'bg' : 'en';
		const map = window.FURROW_I18N?.[lang];
		const titleKey = document.body?.dataset?.i18nTitle || 'page.title';
		if (map?.[titleKey]) document.title = map[titleKey];
		else if (map?.['page.title']) document.title = map['page.title'];
		document.querySelectorAll('[data-i18n-html]').forEach((el) => {
			const key = el.getAttribute('data-i18n-html');
			if (map?.[key]) el.innerHTML = map[key];
		});
		document.querySelectorAll('[data-i18n]').forEach((el) => {
			const key = el.getAttribute('data-i18n');
			if (!map || !map[key]) return;
			if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
				el.placeholder = map[key];
			} else {
				el.textContent = map[key];
			}
		});
		document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
			const key = el.getAttribute('data-i18n-placeholder');
			const map = window.FURROW_I18N?.[lang];
			if (map?.[key]) el.placeholder = map[key];
		});
		document.querySelectorAll('.lang-bar button, .lang-switch [data-lang]').forEach((btn) => {
			btn.classList.toggle('active', btn.dataset.lang === lang);
		});
		localStorage.setItem(STORAGE_KEY, lang);
		document.dispatchEvent(new CustomEvent('furrow-lang-change', { detail: { lang } }));
	}

	function bindBar() {
		document.querySelectorAll('.lang-bar button, .lang-switch [data-lang]').forEach((btn) => {
			btn.addEventListener('click', (e) => {
				e.preventDefault();
				apply(btn.dataset.lang || DEFAULT_LANG);
			});
		});
	}

	document.addEventListener('DOMContentLoaded', () => {
		bindBar();
		apply(getLang());
	});

	window.FurrowI18n = { apply, getLang };
})();
