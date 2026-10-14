/** Become a sponsor → full sponsor page */
(function initFurrowSponsorUi() {
	const btn = document.getElementById('sponsorBtn');
	if (!btn) return;

	btn.addEventListener('click', (e) => {
		e.preventDefault();
		window.location.href = '/sponsor';
	});
})();
