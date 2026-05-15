import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
	ensureSupabaseBrowserClient,
	getSupabaseBrowserClient,
} from '../lib/infra/supabase-browser';

export function useSupabaseSession(): {
	user: User | null;
	session: Session | null;
	loading: boolean;
	signOut: () => Promise<void>;
	clientConfigured: boolean;
} {
	const [session, setSession] = useState<Session | null>(null);
	const [loading, setLoading] = useState(true);
	const [clientConfigured, setClientConfigured] = useState(
		() => getSupabaseBrowserClient() !== null
	);

	useEffect(() => {
		let cancelled = false;
		let unsubscribe: (() => void) | undefined;

		void ensureSupabaseBrowserClient().then(sb => {
			if (cancelled) return;
			setClientConfigured(sb !== null);
			if (!sb) {
				setLoading(false);
				return;
			}
			void sb.auth.getSession().then(({ data }) => {
				if (!cancelled) {
					setSession(data.session);
					setLoading(false);
				}
			});
			const { data: sub } = sb.auth.onAuthStateChange((_event, s) => {
				setSession(s);
			});
			unsubscribe = () => sub.subscription.unsubscribe();
		});

		return () => {
			cancelled = true;
			unsubscribe?.();
		};
	}, []);

	return {
		user: session?.user ?? null,
		session,
		loading,
		signOut: async () => {
			const sb = (await ensureSupabaseBrowserClient()) ?? getSupabaseBrowserClient();
			await sb?.auth.signOut();
		},
		clientConfigured,
	};
}
