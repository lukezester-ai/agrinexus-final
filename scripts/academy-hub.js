/**
 * Academy hub: load data/academy-catalog.json, render materials + visual lessons, wire search.
 * Expects window.AGN_ACADEMY_LANG = 'en' | 'bg' (optional).
 */
(function () {
	const LANG = window.AGN_ACADEMY_LANG === 'bg' ? 'bg' : 'en';
	const DATA_URL = LANG === 'bg' ? '../data/academy-catalog.json' : 'data/academy-catalog.json';

	const labels = {
		en: {
			materialsTitle: 'Materials library',
			materialsSub: 'Articles on this site, partner hub, and trusted external guides — filter by topic.',
			searchPh: 'Search: NDVI, CAP, wheat, futures, Egypt…',
			empty: 'No matches — try another word or clear filters.',
			open: 'Open',
			download: 'Download / open',
			types: { article: 'Read', pdf: 'PDF', link: 'Link', video: 'Video' },
			visualTitle: 'Visual lessons',
			visualSub: 'Curated video searches (YouTube opens in a new tab). Replace with your own playlist embeds when ready.',
			watch: 'Open videos',
			podNote: 'Demo audio track for UI testing — replace src with your podcast RSS / MP3 host.',
			platformEyebrow: 'From lessons to operations',
			platformTitle: 'Academy explains why — Platform runs how',
			platformSub:
				'The Academy is for literacy: readings, video paths, and the Tutor. The Platform page is the live map of the same Sense → Think → Act stack—satellites, agents, dashboards, and automations when you are ready to operate.',
			platformLi1: 'Sense — market & satellite context, AgriDirect desk, field reports',
			platformLi2: 'Think — agent mesh, data lake, and model literacy (tied back to courses here)',
			platformLi3: 'Act — daily briefings, playbooks, and mobile / voice hand-offs',
			platformCta: 'Open Platform map',
			platformCta2: 'Agents & mesh',
			brainTitle: '\u201CAI farmer brain\u201D',
			brainLi1: 'Teaches the farmer.',
			brainLi2: 'Analyzes the farm.',
			brainLi3: 'Delivers decisions.',
			brainLi4: 'Automates activities.',
			roadmapEyebrow: 'Product roadmap',
			roadmapTitle: 'What we ship next (MVP)',
			roadmapSub:
				'Structured courses, in-site video paths, short quizzes, and a learner dashboard — building on today’s library and Tutor.',
			roadmapLi1: 'Accounts & learner profiles',
			roadmapLi2: 'First guided course path with progress',
			roadmapLi3: 'Embedded video modules and transcripts where possible',
			roadmapLi4: 'Module quizzes and optional recap touchpoints',
			roadmapLi5: 'Dashboard: pick up where you left off',
			roadmapFoot:
				'Full vision: docs/ACADEMY_PRODUCT_VISION.md · Architecture sketch: docs/ACADEMY_ARCHITECTURE.md (repository root).',
		},
		bg: {
			materialsTitle: 'Каталог с връзки',
			materialsSub:
				'Търсене по тема към страници от сайта. Повечето материали са на английски (корен на домейна); българските екрани навигират към тях, докато няма превод.',
			searchPh: 'Търсене: NDVI, CAP, пшеница, фючърси, Египет…',
			empty: 'Няма резултати — опитайте друга дума или нулирайте филтрите.',
			open: 'Отвори',
			download: 'Изтегли / отвори',
			types: { article: 'Чети', pdf: 'PDF', link: 'Връзка', video: 'Видео' },
			visualTitle: 'Визуални уроци',
			visualSub: 'Подбрани търсения в YouTube (нов раздел). По-късно можете да вградите свои плейлисти.',
			watch: 'Към видеата',
			podNote: 'Демо аудио за тест на плеъра — заменете src с RSS/MP3 на подкаста.',
			platformEyebrow: 'От теория към операции',
			platformTitle: 'Академията обяснява „защо“ — Платформата пуска „как“',
			platformSub:
				'Тук е грамотността: статии, видео направления и наставник. Страницата „Платформа“ е жива карта на същия контур Sense → Think → Act: сателити, агенти, табло и сценарии, когато сте готови да действате.',
			platformLi1: 'Sense — пазар и сателитен контекст, AgriDirect, полеви отчети',
			platformLi2: 'Think — мрежата от агенти, езерото от данни, модели (с връзка към материалите в Академията)',
			platformLi3: 'Act — брифинги, сценарии, мобилен и гласов контур',
			platformCta: 'Карта на платформата',
			platformCta2: 'Агенти и mesh',
			brainTitle: '„AI фермерски мозък“',
			brainLi1: 'Учи фермера.',
			brainLi2: 'Анализира фермата.',
			brainLi3: 'Дава решения.',
			brainLi4: 'Автоматизира дейности.',
			roadmapEyebrow: 'Продуктова пътна карта',
			roadmapTitle: 'Какво следва (MVP)',
			roadmapSub:
				'Структурирани курсове, видео в сайта, кратки тестове и табло за учащ — върху днешния каталог и наставника.',
			roadmapLi1: 'Профили и вход за учащи',
			roadmapLi2: 'Първа водена пътека с проследяване на прогрес',
			roadmapLi3: 'Вградени видео модули и транскрипти, където е възможно',
			roadmapLi4: 'Тестове след модул и по избор напомняния',
			roadmapLi5: 'Табло: продължи от последното място',
			roadmapFoot:
				'Пълна визия: docs/ACADEMY_PRODUCT_VISION.md · Архитектура: docs/ACADEMY_ARCHITECTURE.md (корен на репозитория).',
		},
	};
	const L = labels[LANG];

	/** From bg/*.html, root articles need ../ ; pages mirrored under bg/ stay same-folder. */
	function resolveMaterialHref(href) {
		if (!href || /^https?:\/\//i.test(href)) return href;
		if (LANG !== 'bg') return href;
		const clean = href.replace(/^\.\//, '');
		const file = clean.split('/').pop();
		const inBgFolder = [
			'index.html',
			'academy.html',
			'analytics.html',
			'market-intelligence.html',
			'platform.html',
			'dashboard.html',
			'agents.html',
		];
		if (!clean.includes('/') && inBgFolder.includes(file)) return clean;
		return '../' + clean;
	}

	function norm(s) {
		return (s || '').toLowerCase();
	}

	function matches(item, q) {
		if (!q) return true;
		const hay = norm([item.title, item.summary, (item.tags || []).join(' ')].join(' '));
		return q.split(/\s+/).every(function (w) {
			return w.length === 0 || hay.includes(w.toLowerCase());
		});
	}

	function typeLabel(t) {
		const m = L.types;
		return m[t] || t;
	}

	function esc(s) {
		return String(s || '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/"/g, '&quot;');
	}

	function renderMaterials(items, q) {
		const grid = document.getElementById('agn-catalog-grid');
		const empty = document.getElementById('agn-catalog-empty');
		if (!grid || !empty) return;
		const list = items.filter(function (it) {
			return matches(it, q) && (it.lang === LANG || it.lang === 'en' || !it.lang);
		});
		if (!list.length) {
			grid.innerHTML = '';
			empty.style.display = 'block';
			empty.textContent = L.empty;
			return;
		}
		empty.style.display = 'none';
		grid.innerHTML = list
			.map(function (it) {
				const ext = it.href && it.href.startsWith('http');
				const rel = ext ? it.href : resolveMaterialHref(it.href);
				const target = ext ? ' rel="noopener noreferrer" target="_blank"' : '';
				const badge = typeLabel(it.type || 'article');
				return (
					'<article class="article-card card-small agn-mat-card" data-tags="' +
					esc((it.tags || []).join(',')) +
					'">' +
					'<div class="meta-row"><span class="cat-tag cat-market">' +
					esc(badge) +
					'</span><span class="read-time">' +
					esc((it.type || '').toUpperCase()) +
					'</span></div>' +
					'<h3><a href="' +
					esc(rel) +
					'"' +
					target +
					' style="color:inherit;text-decoration:none;">' +
					esc(it.title) +
					'</a></h3>' +
					'<p style="font-size:14px;color:var(--text-muted);margin-top:8px;">' +
					esc(it.summary) +
					'</p>' +
					'<div style="margin-top:12px;"><a class="btn btn-outline" style="padding:8px 16px;font-size:13px;display:inline-block;" href="' +
					esc(rel) +
					'"' +
					target +
					'>' +
					esc(it.type === 'pdf' ? L.download : L.open) +
					' →</a></div>' +
					'</article>'
				);
			})
			.join('');
	}

	function renderVisual(lessons) {
		const host = document.getElementById('agn-visual-lessons');
		if (!host || !lessons || !lessons.length) return;
		host.innerHTML = lessons
			.map(function (v) {
				return (
					'<a href="' +
					esc(v.href) +
					'" target="_blank" rel="noopener noreferrer" class="agn-video-card" style="text-decoration:none;color:inherit;">' +
					'<div class="agn-video-thumb" style="background:' +
					esc(v.thumb) +
					';"></div>' +
					'<div style="padding:16px 0 0;">' +
					'<div style="font-family:JetBrains Mono,monospace;font-size:11px;color:var(--gold);">VIDEO</div>' +
					'<h3 style="font-size:18px;margin:8px 0 6px;">' +
					esc(v.title) +
					'</h3>' +
					'<p style="font-size:14px;color:var(--text-muted);">' +
					esc(v.summary) +
					'</p>' +
					'<span style="font-size:13px;color:var(--gold);">' +
					esc(L.watch) +
					' →</span>' +
					'</div></a>'
				);
			})
			.join('');
	}

	function wireSearch(materials) {
		const input = document.getElementById('agn-academy-search');
		const tags = document.querySelectorAll('#agn-quick-filters .t-tag');
		if (!input) return;
		function run() {
			renderMaterials(materials, norm(input.value).trim());
		}
		input.addEventListener('input', run);
		input.addEventListener('search', run);
		tags.forEach(function (tag) {
			tag.addEventListener('click', function () {
				input.value = tag.getAttribute('data-q') || tag.textContent.trim();
				run();
				input.focus();
			});
		});
		run();
	}

	function podNote() {
		const el = document.getElementById('agn-podcast-note');
		if (el) el.textContent = L.podNote;
		const inp = document.getElementById('agn-academy-search');
		if (inp) inp.placeholder = L.searchPh;
		const heads = document.querySelectorAll('[data-i18n-academy]');
		heads.forEach(function (node) {
			const k = node.getAttribute('data-i18n-academy');
			if (k === 'materialsTitle') node.textContent = L.materialsTitle;
			if (k === 'materialsSub') node.textContent = L.materialsSub;
			if (k === 'visualTitle') node.textContent = L.visualTitle;
			if (k === 'visualSub') node.textContent = L.visualSub;
			if (k === 'platformEyebrow') node.textContent = L.platformEyebrow;
			if (k === 'platformTitle') node.textContent = L.platformTitle;
			if (k === 'platformSub') node.textContent = L.platformSub;
			if (k === 'platformLi1') node.textContent = L.platformLi1;
			if (k === 'platformLi2') node.textContent = L.platformLi2;
			if (k === 'platformLi3') node.textContent = L.platformLi3;
			if (k === 'platformCta') node.textContent = L.platformCta;
			if (k === 'platformCta2') node.textContent = L.platformCta2;
			if (k === 'brainTitle') node.textContent = L.brainTitle;
			if (k === 'brainLi1') node.textContent = L.brainLi1;
			if (k === 'brainLi2') node.textContent = L.brainLi2;
			if (k === 'brainLi3') node.textContent = L.brainLi3;
			if (k === 'brainLi4') node.textContent = L.brainLi4;
			if (k === 'roadmapEyebrow') node.textContent = L.roadmapEyebrow;
			if (k === 'roadmapTitle') node.textContent = L.roadmapTitle;
			if (k === 'roadmapSub') node.textContent = L.roadmapSub;
			if (k === 'roadmapLi1') node.textContent = L.roadmapLi1;
			if (k === 'roadmapLi2') node.textContent = L.roadmapLi2;
			if (k === 'roadmapLi3') node.textContent = L.roadmapLi3;
			if (k === 'roadmapLi4') node.textContent = L.roadmapLi4;
			if (k === 'roadmapLi5') node.textContent = L.roadmapLi5;
			if (k === 'roadmapFoot') node.textContent = L.roadmapFoot;
		});
	}

	fetch(DATA_URL)
		.then(function (r) {
			return r.json();
		})
		.then(function (data) {
			podNote();
			const materials = data.materials || [];
			const grid = document.getElementById('agn-catalog-grid');
			if (grid) {
				grid.classList.add('fresh-grid');
			}
			renderMaterials(materials, '');
			wireSearch(materials);
			renderVisual(data.visualLessons || []);
		})
		.catch(function () {
			const empty = document.getElementById('agn-catalog-empty');
			if (empty) {
				empty.style.display = 'block';
				empty.textContent =
					LANG === 'bg'
						? 'Каталогът не се зареди (проверете data/academy-catalog.json).'
						: 'Could not load catalog (check data/academy-catalog.json).';
			}
		});
})();
