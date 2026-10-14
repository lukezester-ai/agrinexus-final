/** Chat UI strings — merged into FURROW_I18N */
(function mergeChatI18n() {
	if (!window.FURROW_I18N) return;
	Object.assign(window.FURROW_I18N.en, {
		'chat.fab': 'AI Analyst',
		'chat.title': 'Furrow Analyst',
		'chat.hint': 'Market intelligence · launch 2026',
		'chat.placeholder': 'Ask about grains, Black Sea, pricing…',
		'chat.welcome':
			'Hello — I\'m Furrow Analyst. I can explain our plans, coverage, and pricing, or add you to the early-access waitlist.',
		'chat.thinking': 'Analyzing…',
		'chat.offlinePh': 'AI offline — configure API key on server',
		'chat.offlineReply': 'The analyst is offline. Set MISTRAL_API_KEY and run npm run dev.',
		'chat.noReply': 'No response from server.',
		'chat.network': 'Network error — is the API running?',
		'chat.busy': 'Something went wrong. Try again.',
		'chat.quickPricing': 'Pricing plans',
		'chat.quickWaitlist': 'Join waitlist',
		'chat.quickBlackSea': 'Black Sea wheat',
		'chat.quickMarkets': 'CBOT prices',
	});
	Object.assign(window.FURROW_I18N.bg, {
		'chat.fab': 'AI анализатор',
		'chat.title': 'Furrow Analyst',
		'chat.hint': 'Пазарна аналитика · старт 2026',
		'chat.placeholder': 'Питайте за зърно, Черно море, цени…',
		'chat.welcome':
			'Здравейте — аз съм Furrow Analyst. Мога да обясня плановете, покритието и цените или да ви добавя към ранния достъп.',
		'chat.thinking': 'Анализ…',
		'chat.offlinePh': 'AI е офлайн — нужен е API ключ на сървъра',
		'chat.offlineReply': 'Анализаторът е офлайн. Задайте MISTRAL_API_KEY и стартирайте npm run dev.',
		'chat.noReply': 'Няма отговор от сървъра.',
		'chat.network': 'Мрежова грешка — API ли работи?',
		'chat.busy': 'Грешка. Опитайте отново.',
		'chat.quickPricing': 'Цени',
		'chat.quickWaitlist': 'Списък за достъп',
		'chat.quickBlackSea': 'Пшеница Черно море',
		'chat.quickMarkets': 'CBOT',
	});
})();
