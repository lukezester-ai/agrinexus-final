/**
 * Furrow Analyst — AI chat client
 */
(function initFurrowChat() {
	const t = (k, fb) => window.FURROW_I18N?.[window.FurrowI18n?.getLang?.() || 'en']?.[k] || fb || k;

	function mount() {
		const fab = document.getElementById('furrow-chat-fab');
		const panel = document.getElementById('furrow-chat-panel');
		const closeBtn = document.getElementById('furrow-chat-close');
		const msgs = document.getElementById('furrow-chat-msgs');
		const input = document.getElementById('furrow-chat-input');
		const sendBtn = document.getElementById('furrow-chat-send');
		const statusEl = document.getElementById('furrow-chat-status');
		if (!fab || !panel || !msgs || !input || !sendBtn || !statusEl) return;

		const messages = [];
		let apiOnline = false;
		let welcomeShown = false;

		function lang() {
			return window.FurrowI18n?.getLang?.() === 'bg' ? 'bg' : 'en';
		}

		function setOpen(next) {
			panel.classList.toggle('open', next);
			fab.setAttribute('aria-expanded', String(next));
			if (next) {
				if (!welcomeShown) showWelcome();
				setTimeout(() => input.focus(), 80);
			}
		}

		function addMsg(role, content) {
			const node = document.createElement('div');
			node.className = `msg ${role}`;
			node.textContent = content;
			msgs.appendChild(node);
			msgs.scrollTop = msgs.scrollHeight;
		}

		function applyOfflineUi() {
			apiOnline = false;
			statusEl.textContent = 'offline';
			statusEl.classList.add('is-offline');
			panel.classList.add('furrow-chat-panel--offline');
			input.disabled = true;
			sendBtn.disabled = true;
			input.placeholder = t('chat.offlinePh', 'Offline');
		}

		function applyOnlineUi(data) {
			apiOnline = true;
			statusEl.classList.remove('is-offline');
			panel.classList.remove('furrow-chat-panel--offline');
			input.disabled = false;
			sendBtn.disabled = false;
			input.placeholder = t('chat.placeholder', 'Ask…');
			statusEl.textContent =
				data?.agentEnabled && data?.agentTools
					? lang() === 'bg'
						? 'Агент · действия'
						: 'Agent · tools'
					: lang() === 'bg'
						? 'онлайн'
						: 'online';
		}

		function formatActions(actions) {
			if (!Array.isArray(actions) || !actions.length) return '';
			const head = lang() === 'bg' ? 'Действия:' : 'Actions:';
			return `${head}\n${actions.map((a) => `${a.ok ? '✓' : '✗'} ${a.summary || a.tool}`).join('\n')}`;
		}

		async function checkStatus() {
			try {
				const res = await fetch('/api/furrow-chat');
				if (!res.ok) throw new Error('bad');
				applyOnlineUi(await res.json());
			} catch {
				applyOfflineUi();
			}
		}

		document.addEventListener('furrow-lang-change', () => {
			document.querySelectorAll('#furrow-chat-panel [data-i18n]').forEach((el) => {
				const key = el.getAttribute('data-i18n');
				const map = window.FURROW_I18N?.[lang()];
				if (map?.[key]) {
					if (el.tagName === 'TEXTAREA') el.placeholder = map[key];
					else el.textContent = map[key];
				}
			});
			if (apiOnline) checkStatus();
		});

		function getSessionId() {
			let sid = localStorage.getItem('furrow_chat_sid');
			if (!sid) {
				sid = 'session_' + Math.random().toString(36).substring(2, 15);
				localStorage.setItem('furrow_chat_sid', sid);
			}
			return sid;
		}

		async function send() {
			if (!apiOnline) {
				addMsg('assistant', t('chat.offlineReply', 'Offline'));
				return;
			}
			const text = input.value.trim();
			if (!text) return;
			input.value = '';
			addMsg('user', text);
			sendBtn.disabled = true;
			addMsg('assistant', t('chat.thinking', '…'));
			const waiting = msgs.lastElementChild;
			try {
				const res = await fetch('/api/furrow-chat', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						message: text,
						sessionId: getSessionId(),
						context: { page: 'homepage', lang: lang() },
					}),
				});
				const data = await res.json().catch(() => ({}));
				if (!res.ok || !data.reply) throw new Error(data.error || t('chat.noReply', 'No reply'));
				const actionBlock = formatActions(data.actions);
				const full = actionBlock ? `${data.reply}\n\n${actionBlock}` : data.reply;
				waiting.textContent = data.reply;
				if (actionBlock) {
					const ab = document.createElement('div');
					ab.style.marginTop = '8px';
					ab.style.fontSize = '12px';
					ab.style.color = '#6b6760';
					ab.textContent = actionBlock;
					waiting.appendChild(ab);
				}
			} catch (e) {
				const msg = e instanceof Error ? e.message : t('chat.busy', 'Error');
				waiting.textContent =
					msg === 'Failed to fetch' || msg.includes('Network') ? t('chat.network', 'Network') : msg;
			} finally {
				sendBtn.disabled = false;
			}
		}

		function showWelcome() {
			welcomeShown = true;
			addMsg('assistant', t('chat.welcome', 'Hello'));
		}

		fab.addEventListener('click', () => setOpen(!panel.classList.contains('open')));
		closeBtn?.addEventListener('click', () => setOpen(false));
		sendBtn.addEventListener('click', send);
		input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				send();
			}
		});

		document.querySelectorAll('#furrow-chat-quick [data-prompt]').forEach((btn) => {
			btn.addEventListener('click', () => {
				const p = btn.getAttribute('data-prompt');
				if (p) {
					input.value = p;
					setOpen(true);
					input.focus();
				}
			});
		});

		checkStatus();
	}

	document.addEventListener('DOMContentLoaded', mount);
	window.FurrowChat = { mount };
})();
