(function initSponsorPage() {
	const form = document.getElementById('sponsor-form');
	const statusDiv = document.getElementById('form-status');
	const interestSelect = document.getElementById('interest-package');
	const contactSection = document.getElementById('contact');

	function t(key) {
		const lang = window.FurrowI18n?.getLang?.() || 'en';
		return window.FURROW_I18N?.[lang]?.[key] || window.FURROW_I18N?.en?.[key] || '';
	}

	function successHtml() {
		return `<div class="form-success">${t('sp.form.success')}</div>`;
	}

	window.selectPackage = function selectPackage(packageName) {
		if (interestSelect) {
			const opt = Array.from(interestSelect.options).find((o) => o.value === packageName);
			if (opt) interestSelect.value = opt.value;
		}
		if (contactSection) {
			contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	};

	window.downloadMediaKit = function downloadMediaKit() {
		const subject = encodeURIComponent('Media Kit Request');
		const body = encodeURIComponent('Please send the Furrow Markets media kit.');
		window.location.href = `mailto:sponsors@furrowmarkets.com?subject=${subject}&body=${body}`;
	};

	if (!form) return;

	form.addEventListener('submit', (e) => {
		e.preventDefault();

		const fullname = document.getElementById('fullname')?.value?.trim() || '';
		const company = document.getElementById('company')?.value?.trim() || '';
		const email = document.getElementById('email')?.value?.trim() || '';
		const phone = document.getElementById('phone')?.value?.trim() || '';
		const interestPackage = interestSelect?.value || '';
		const budget = document.getElementById('budget')?.value || '';
		const message = document.getElementById('message')?.value?.trim() || '';

		const submitBtn = form.querySelector('.submit-btn');
		const submitKey = 'sp.form.submit';
		if (submitBtn) {
			submitBtn.textContent = t('sp.form.sending');
			submitBtn.disabled = true;
		}

		const emailBody = `Sponsorship Inquiry from ${fullname}

Name: ${fullname}
Company: ${company}
Email: ${email}
Phone: ${phone}
Package: ${interestPackage}
Budget: ${budget}

Message:
${message}

---
Submitted from Furrow Markets sponsor page`;

		const mailtoLink = `mailto:sponsors@furrowmarkets.com?subject=${encodeURIComponent('Sponsorship Inquiry from ' + company)}&body=${encodeURIComponent(emailBody)}`;
		window.location.href = mailtoLink;

		if (statusDiv) {
			statusDiv.innerHTML = successHtml();
		}
		form.reset();

		if (submitBtn) {
			submitBtn.textContent = t(submitKey);
			submitBtn.disabled = false;
		}
	});

	document.addEventListener('furrow-lang-change', () => {
		const submitBtn = form.querySelector('.submit-btn');
		if (submitBtn && !submitBtn.disabled) {
			submitBtn.textContent = t('sp.form.submit');
		}
	});

	const params = new URLSearchParams(window.location.search);
	const pkg = params.get('package');
	if (pkg && interestSelect) {
		const map = { banner: 'Banner Ads', issue: 'Sponsored Issue', leads: 'Lead Generation' };
		const val = map[pkg.toLowerCase()];
		if (val) interestSelect.value = val;
	}
})();
