/**
 * Vercel Web Analytics (free on Hobby).
 * Enable: Vercel project furrow-github → Analytics → Web Analytics → Enable.
 */
(function initFurrowAnalytics() {
	const host = window.location.hostname;
	const isProd =
		host === 'furrow.community' ||
		host.endsWith('.furrow.community') ||
		host.endsWith('.vercel.app');

	if (!isProd) return;

	window.va =
		window.va ||
		function va() {
			(window.vaq = window.vaq || []).push(arguments);
		};
	const vercel = document.createElement('script');
	vercel.defer = true;
	vercel.src = '/_vercel/insights/script.js';
	document.head.appendChild(vercel);
})();
