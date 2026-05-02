/** Еднократно на браузерска сесия: праща POST към `/api/visit` за броене на посещения. */

function ensureVisitorId(): string {
	try {
		let id = localStorage.getItem('agrinexus-vid');
		if (!id) {
			id = crypto.randomUUID();
			localStorage.setItem('agrinexus-vid', id);
		}
		return id;
	} catch {
		return crypto.randomUUID();
	}
}

export function recordBrowserVisitOncePerSession(): void {
	if (typeof window === 'undefined') return;
	try {
		if (sessionStorage.getItem('agrinexus-visit-tracked')) return;
		sessionStorage.setItem('agrinexus-visit-tracked', '1');
		const visitorId = ensureVisitorId();
		void fetch('/api/visit', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ visitorId }),
			keepalive: true,
		}).catch(() => {});
	} catch {
		/* private mode / storage blocked */
	}
}
