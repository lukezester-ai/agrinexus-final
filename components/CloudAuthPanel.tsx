import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useSupabaseSession } from '../hooks/use-supabase-session';
import {
	authMagicLinkErrorMessage,
	requestAuthMagicLink,
} from '../lib/auth-magic-link-client';
import { ensureSupabaseBrowserClient } from '../lib/infra/supabase-browser';
import type { AppStrings } from '../lib/i18n';

type Props = { tr: AppStrings; lang?: 'bg' | 'en' };

export function CloudAuthPanel({ tr, lang = 'bg' }: Props) {
	const { user, loading, signOut, clientConfigured } = useSupabaseSession();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
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

	const sendLink = async () => {
		const e = email.trim();
		if (!e) return;
		setBusy(true);
		setMsg(null);
		const magic = await requestAuthMagicLink({
			email: e,
			redirectTo: `${window.location.origin}${window.location.pathname}`,
			formOpenedAt: Date.now() - 3000,
		});
		setBusy(false);
		if (!magic.ok) {
			setMsg(authMagicLinkErrorMessage(magic.body.code, lang));
			return;
		}
		setMsg(tr.loginMagicSent);
	};

	const signInWithPassword = async () => {
		const e = email.trim();
		if (!e || password.length < 6) return;
		setBusy(true);
		setMsg(null);
		const client = await ensureSupabaseBrowserClient();
		if (!client) {
			setBusy(false);
			setMsg(authMagicLinkErrorMessage('auth_not_configured', lang));
			return;
		}
		const { error } = await client.auth.signInWithPassword({ email: e, password });
		setBusy(false);
		if (error) setMsg(tr.loginCloudPasswordWrong);
		else setMsg(null);
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
				{clientConfigured ? (
					<>
						<input
							type="password"
							autoComplete="current-password"
							placeholder={tr.loginPasswordPh}
							value={password}
							onChange={e => {
								setPassword(e.target.value);
								if (msg) setMsg(null);
							}}
						/>
						<p
							className="muted"
							style={{ gridColumn: '1 / -1', margin: '-6px 0 0', fontSize: '.82rem' }}>
							{tr.loginCloudPasswordHint}
						</p>
					</>
				) : null}
			</div>
			<div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
				{clientConfigured ? (
					<button
						type="button"
						className="btn btn-primary"
						disabled={busy || !email.trim() || password.length < 6}
						onClick={() => void signInWithPassword()}>
						{busy ? <Loader2 size={16} className="spin" aria-hidden /> : null}
						{tr.loginCloudSignInPassword}
					</button>
				) : null}
				<button
					type="button"
					className="btn btn-outline"
					disabled={busy || !email.trim()}
					onClick={() => void sendLink()}>
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
