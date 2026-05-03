import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '../lib/infra/supabase-browser';

export function useSupabaseSession(): {
	user: User | null;
	session: Session | null;
	loading: boolean;
	signOut: () => Promise<void>;
	clientConfigured: boolean;
} {
	const [session, setSession] = useState<Session | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const sb = getSupabaseBrowserClient();
		if (!sb) {
			setLoading(false);
			return;
		}
		let cancelled = false;
		void sb.auth.getSession().then(({ data }) => {
			if (!cancelled) {
				setSession(data.session);
				setLoading(false);
			}
		});
		const { data: sub } = sb.auth.onAuthStateChange((_event, s) => {
			setSession(s);
		});
		return () => {
			cancelled = true;
			sub.subscription.unsubscribe();
		};
	}, []);

	const sb = getSupabaseBrowserClient();
	return {
		user: session?.user ?? null,
		session,
		loading,
		signOut: async () => {
			await sb?.auth.signOut();
		},
		clientConfigured: sb !== null,
	};
}
