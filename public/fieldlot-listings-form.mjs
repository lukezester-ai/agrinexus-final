const LISTINGS_API = '/api/fieldlot-listings';
const PUBLIC_CFG = '/api/public-supabase-config';

(async function initFieldlotListingsForm() {
	const form = document.getElementById('agm-lead');
	const submit = document.getElementById('agm-submit');
	const status = document.getElementById('agm-lead-status');
	const listUl = document.getElementById('fieldlot-listings-ul');
	const listEmpty = document.getElementById('fieldlot-listings-empty');
	const sessionBanner = document.getElementById('fl-session-banner');
	if (!form || !submit || !status || !listUl || !listEmpty) return;

	const openedAt = Date.now();
	const PHONE_OK = /^\+[1-9]\d{7,14}$/;
	let accessToken = null;
	let supabaseClient = null;
	let sessionUserEmail = null;

	function hasDemoOnlySession() {
		try {
			return !!localStorage.getItem('agrinexus-demo-email');
		} catch {
			return false;
		}
	}

	function noSupabaseSessionHint() {
		if (hasDemoOnlySession()) {
			return (
				'Ползваш демо вход в AgriNexus — той не създава облачен Supabase акаунт. ' +
				'За обяви влез с magic link или парола: /?from=fieldlot&mode=login (не през демо).'
			);
		}
		return (
			'Няма активна Supabase сесия на тази страница. Влез в AgriNexus (/?from=fieldlot&mode=login), ' +
			'после се върни на този раздел или презареди страницата (ако вече си влязъл в друг таб).'
		);
	}

	function enableSubmit() {
		submit.disabled = false;
		submit.textContent = 'Публикувай обявата';
	}

	const waitMs = Math.max(0, 2100 - (Date.now() - openedAt));
	submit.textContent = 'Изчакай…';
	setTimeout(enableSubmit, waitMs);

	function renderSession() {
		if (!sessionBanner) return;
		sessionBanner.classList.remove('warn', 'ok');
		if (!supabaseClient) {
			sessionBanner.classList.add('warn');
			sessionBanner.textContent =
				'Липсва публична Supabase конфигурация от сървъра. Задай VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY (или SUPABASE_ANON_KEY) за API средата — виж .env.example.';
			return;
		}
		if (!accessToken) {
			sessionBanner.classList.add('warn');
			sessionBanner.textContent = noSupabaseSessionHint();
			return;
		}
		sessionBanner.classList.add('ok');
		sessionBanner.textContent =
			'Влязъл си в AgriNexus. Полето „Имейл“ по-долу трябва да съвпада с този акаунт.' +
			(sessionUserEmail ? ' Текущ имейл: ' + sessionUserEmail + '.' : '');
	}

	async function syncSessionFromSupabase() {
		if (!supabaseClient) return;
		const { data } = await supabaseClient.auth.getSession();
		accessToken = data.session?.access_token ?? null;
		sessionUserEmail = data.session?.user?.email ?? null;
		const emailEl = document.getElementById('agm-email');
		if (sessionUserEmail && emailEl) emailEl.value = sessionUserEmail;
		renderSession();
	}

	function fmtWhen(iso) {
		try {
			const d = new Date(iso);
			return d.toLocaleString('bg-BG', { dateStyle: 'short', timeStyle: 'short' });
		} catch {
			return iso;
		}
	}

	async function refreshListings() {
		listEmpty.hidden = false;
		listEmpty.textContent = 'Зареждане…';
		try {
			const res = await fetch(LISTINGS_API, { method: 'GET' });
			const data = await res.json().catch(function () {
				return {};
			});
			const rows = Array.isArray(data.listings) ? data.listings : [];
			listUl.innerHTML = '';
			if (rows.length === 0) {
				listEmpty.hidden = false;
				listEmpty.textContent =
					data.storage === 'none'
						? 'Няма конфигурирано хранилище за обяви (на Vercel задай Supabase — виж supabase-fieldlot-listings.sql).'
						: 'Все още няма обяви — бъди първият с формата по-долу.';
				return;
			}
			listEmpty.hidden = true;
			for (let i = 0; i < rows.length; i++) {
				const L = rows[i];
				const li = document.createElement('li');
				li.className = 'fl-listing-card';
				const header = document.createElement('header');
				const h3 = document.createElement('h3');
				h3.textContent = L.title || '—';
				const meta = document.createElement('span');
				meta.className = 'fl-listing-meta';
				meta.textContent = fmtWhen(L.created_at);
				header.appendChild(h3);
				header.appendChild(meta);
				const roleSpan = document.createElement('span');
				roleSpan.className = 'fl-listing-role';
				roleSpan.textContent = L.role || '—';
				const pBody = document.createElement('p');
				pBody.className = 'fl-listing-body';
				pBody.textContent = L.body || '';
				const contact = document.createElement('div');
				contact.className = 'fl-listing-contact';
				const namePart = document.createElement('span');
				namePart.textContent = L.full_name || '';
				contact.appendChild(namePart);
				const co = (L.company_name || '').trim();
				if (co) {
					contact.appendChild(document.createTextNode(' · '));
					const coSpan = document.createElement('span');
					coSpan.textContent = co;
					contact.appendChild(coSpan);
				}
				contact.appendChild(document.createTextNode(' · '));
				const mailA = document.createElement('a');
				mailA.href = 'mailto:' + String(L.business_email || '').replace(/^mailto:/i, '');
				mailA.textContent = L.business_email || '';
				contact.appendChild(mailA);
				const phone = (L.phone || '').trim();
				if (phone) {
					contact.appendChild(document.createTextNode(' · '));
					const phSpan = document.createElement('span');
					phSpan.textContent = phone;
					contact.appendChild(phSpan);
				}
				li.appendChild(header);
				li.appendChild(roleSpan);
				li.appendChild(pBody);
				li.appendChild(contact);
				listUl.appendChild(li);
			}
		} catch {
			listEmpty.hidden = false;
			listEmpty.textContent =
				'Неуспешно зареждане на обявите — провери дали API работи (npm run dev от корена).';
		}
	}

	void refreshListings();

	try {
		const cfgRes = await fetch(PUBLIC_CFG);
		const cfg = await cfgRes.json().catch(function () {
			return {};
		});
		if (!cfgRes.ok || !cfg.ok || !cfg.supabaseUrl || !cfg.supabaseAnonKey) {
			renderSession();
		} else {
			const supabaseUrl = String(cfg.supabaseUrl).trim();
			const supabaseAnonKey = String(cfg.supabaseAnonKey).trim();
			const mod = await import('https://esm.sh/@supabase/supabase-js@2.105.1');
			const { createClient } = mod;
			supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
				auth: {
					persistSession: true,
					storage: localStorage,
					autoRefreshToken: true,
					detectSessionInUrl: true,
				},
			});
			await syncSessionFromSupabase();
			supabaseClient.auth.onAuthStateChange((_event, session) => {
				accessToken = session?.access_token ?? null;
				sessionUserEmail = session?.user?.email ?? null;
				const emailEl = document.getElementById('agm-email');
				if (sessionUserEmail && emailEl) emailEl.value = sessionUserEmail;
				renderSession();
			});
			document.addEventListener('visibilitychange', function () {
				if (document.visibilityState === 'visible') void syncSessionFromSupabase();
			});
			window.addEventListener('focus', function () {
				void syncSessionFromSupabase();
			});
			renderSession();
		}
	} catch (e) {
		console.error('[Fieldlot listings]', e);
		if (sessionBanner) {
			sessionBanner.classList.remove('ok');
			sessionBanner.classList.add('warn');
			sessionBanner.textContent =
				'Неуспешно зареждане на входа (мрежа или CDN). Опитай презареждане или провери дали /api/public-supabase-config отговаря.';
		}
	}

	form.addEventListener('submit', async function (ev) {
		ev.preventDefault();
		status.textContent = '';
		status.className = '';

		if (Date.now() - openedAt < 2000) {
			status.className = 'err';
			status.textContent = 'Изчакай 2 секунди след зареждане на страницата и опитай пак.';
			return;
		}

		if (supabaseClient) {
			await syncSessionFromSupabase();
		}

		if (!accessToken) {
			status.className = 'err';
			status.textContent = supabaseClient
				? noSupabaseSessionHint()
				: 'Липсва конфигурация за вход — виж съобщението в жълтата лента по-горе.';
			return;
		}

		const fullNameEl = document.getElementById('agm-fullname');
		const emailEl = document.getElementById('agm-email');
		const companyEl = document.getElementById('agm-company');
		const phoneEl = document.getElementById('agm-phone');
		const roleEl = document.getElementById('agm-role');
		const titleEl = document.getElementById('agm-title');
		const bodyEl = document.getElementById('agm-body');
		const hpEl = document.getElementById('agm-hp');
		const alertsEl = document.getElementById('agm-alerts');

		if (
			!fullNameEl ||
			!emailEl ||
			!companyEl ||
			!phoneEl ||
			!roleEl ||
			!titleEl ||
			!bodyEl ||
			!hpEl ||
			!alertsEl
		) {
			status.className = 'err';
			status.textContent = 'Грешка в страницата — презареди.';
			return;
		}

		const fullName = fullNameEl.value.trim();
		const businessEmail = emailEl.value.trim();
		const companyName = companyEl.value.trim();
		let phone = phoneEl.value.trim();
		const role = roleEl.value;
		const listingTitle = titleEl.value.trim();
		const listingBody = bodyEl.value.trim();
		const hp = hpEl.value;

		if (fullName.length < 2) {
			status.className = 'err';
			status.textContent = 'Моля, поне 2 знака за име.';
			return;
		}
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(businessEmail)) {
			status.className = 'err';
			status.textContent = 'Невалиден имейл.';
			return;
		}
		if (listingTitle.length < 3) {
			status.className = 'err';
			status.textContent = 'Заглавието трябва да е поне 3 знака.';
			return;
		}
		if (listingBody.length < 10) {
			status.className = 'err';
			status.textContent = 'Описанието трябва да е поне 10 знака.';
			return;
		}
		if (phone) {
			const digits = phone.replace(/\D/g, '');
			if (digits.length >= 9) {
				phone = '+' + digits;
			}
			if (!PHONE_OK.test(phone)) {
				status.className = 'err';
				status.textContent = 'Телефонът трябва да е във формат E.164, напр. +359888123456.';
				return;
			}
		}

		const body = {
			fullName: fullName,
			companyName: companyName,
			businessEmail: businessEmail,
			phone: phone || '',
			role: role,
			listingTitle: listingTitle,
			listingBody: listingBody,
			subscribeAlerts: alertsEl.checked,
			locale: 'bg',
			hpCompanyWebsite: hp || '',
			formOpenedAt: openedAt,
		};

		submit.disabled = true;
		status.textContent = 'Публикуване…';

		try {
			const res = await fetch(LISTINGS_API, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: 'Bearer ' + accessToken,
				},
				body: JSON.stringify(body),
			});
			let data = {};
			try {
				data = await res.json();
			} catch {
				data = {};
			}
			if (!res.ok) {
				status.className = 'err';
				const hint = data.hint ? ' ' + String(data.hint) : '';
				const err = String(data.error || 'Грешка');
				const friendly =
					err === 'Too fast'
						? 'Твърде бързо — презареди страницата и изчакай 2 секунди.'
						: err === 'Too many requests'
							? 'Твърде много заявки. Опитай по-късно.'
							: err === 'Session expired'
								? 'Страницата е остаряла — презареди и попълни отново.'
								: err === 'Valid business email required'
									? 'Невалиден имейл.'
									: err === 'Valid phone required'
										? 'Невалиден телефон — използвай +359… или остави празно.'
										: err === 'Request could not be processed'
											? 'Заявката не мина проверката — презареди страницата.'
											: err === 'Listing storage is not configured'
												? 'Сървърът не може да записва обяви: задай SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY и изпълни supabase-fieldlot-listings.sql (на Vercel). Локално без Supabase обявите се пишат в .local автоматично.'
												: err === 'Listing title must be 3–200 characters'
													? 'Заглавието: между 3 и 200 знака.'
													: err === 'Listing description must be 10–8000 characters'
														? 'Описанието: между 10 и 8000 знака.'
														: err === 'Изисква се вход'
															? 'Трябва да си влязъл в AgriNexus. Влез и презареди страницата.'
															: err === 'Невалидна или изтекла сесия'
																? 'Сесията е изтекла — влез отново и презареди.'
																: err === 'Сървърът не може да провери сесията'
																	? 'Сървърът не може да провери сесията (липсват ключове за Supabase на API).'
																	: err === 'Имейлът в формата трябва да съвпада с акаунта, с който си влязъл.'
																		? 'Имейлът в формата трябва да е същият като при входа в AgriNexus.'
																		: err;
				status.textContent = friendly + hint;
				submit.disabled = false;
				return;
			}
			status.className = 'ok';
			const parts = ['Обявата е публикувана в списъка по-горе.'];
			if (data.mailDelivery === 'sent') {
				parts.push('Екипът е уведомен по имейл.');
			} else {
				parts.push(
					'Имейл към екипа не е изпратен (липсват RESEND_API_KEY / MAIL_FROM) — обявата пак е записана.',
				);
			}
			status.textContent = parts.join(' ');
			form.reset();
			if (supabaseClient) {
				const { data: s2 } = await supabaseClient.auth.getSession();
				const em = document.getElementById('agm-email');
				if (s2.session?.user?.email && em) em.value = s2.session.user.email;
			}
			submit.disabled = false;
			void refreshListings();
		} catch {
			status.className = 'err';
			status.textContent =
				'Мрежова грешка. Пусни npm run dev от корена (Vite + API на DEV_API_PORT).';
			submit.disabled = false;
		}
	});
})();
