import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useSupabaseSession } from '../hooks/use-supabase-session';
import { getSupabaseBrowserClient } from '../lib/infra/supabase-browser';
import type { AppStrings } from '../lib/i18n';

type Props = { tr: AppStrings };

export function CloudAuthPanel({ tr }: Props) {
	const { user, loading, signOut, clientConfigured } = useSupabaseSession();
	const [email, setEmail] = useState('');
	const [busy, setBusy] = useState(false);
	const [msg, setMsg] = useState<string | null>(null);

	if (loading) {
		return (
			<div className="contact-panel" style={{ marginTop: 16 }}>
				<p className="muted" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
					<Loader2 size={16} className="spin" aria-hidden /> {tr.loginCloudLoading}
				</p>
			</div>
		);
	}

	if (!clientConfigured) {
		return (
			<p className="muted" style={{ marginTop: 16, fontSize: '.86rem', lineHeight: 1.5 }}>
				{tr.loginCloudDisabled}
			</p>
		);
	}

	if (user?.email) {
		return (
			<div className="contact-panel" style={{ marginTop: 16 }}>
				<h3 style={{ marginTop: 0, fontSize: '1rem' }}>{tr.loginCloudTitle}</h3>
				<p style={{ margin: '8px 0 0', fontSize: '.9rem' }}>
					{tr.loginSignedInCloud} <strong>{user.email}</strong>
				</p>
				<button
					type="button"
					className="btn btn-outline"
					style={{ marginTop: 10 }}
					onClick={() => void signOut()}>
					{tr.loginSignOutCloud}
				</button>
			</div>
		);
	}

	const client = getSupabaseBrowserClient();
	if (!client) return null;

	const sendLink = async () => {
		const e = email.trim();
		if (!e) return;
		setBusy(true);
		setMsg(null);
		const redirect = `${window.location.origin}${window.location.pathname}`;
		const { error } = await client.auth.signInWithOtp({
			email: e,
			options: { emailRedirectTo: redirect },
		});
		setBusy(false);
		if (error) setMsg(error.message);
		else setMsg(tr.loginMagicSent);
	};

	return (
		<div className="contact-panel" style={{ marginTop: 16 }}>
			<h3 style={{ marginTop: 0, fontSize: '1rem' }}>{tr.loginCloudTitle}</h3>
			<p className="muted" style={{ margin: '6px 0 12px', fontSize: '.86rem' }}>
				{tr.loginCloudSub}
			</p>
			<div className="form-grid" style={{ maxWidth: 400 }}>
				<input
					type="email"
					autoComplete="email"
					placeholder={tr.loginEmailPh}
					value={email}
					onChange={e => {
						setEmail(e.target.value);
						if (msg) setMsg(null);
					}}
				/>
			</div>
			<div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
				<button type="button" className="btn btn-primary" disabled={busy || !email.trim()} onClick={() => void sendLink()}>
					{busy ? <Loader2 size={16} className="spin" aria-hidden /> : null}
					{tr.loginMagicLink}
				</button>
			</div>
			{msg ? (
				<p className="muted" style={{ marginTop: 10, fontSize: '.86rem' }}>
					{msg}
				</p>
			) : null}
		</div>
	);
}
