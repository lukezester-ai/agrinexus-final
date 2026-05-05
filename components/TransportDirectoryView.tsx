import { useCallback, useEffect, useMemo, useState } from 'react';
import { Truck, Mail, Phone, MapPin, Package, Search, UserPlus, Loader2 } from 'lucide-react';
import type { AppStrings } from '../lib/i18n';
import {
	loadTransportCompanies,
	registerTransportCompany,
} from '../lib/transport-directory-client';
import type { TransportCompany } from '../lib/transport-directory-types';

const EU_AGRI_OUTLOOK_URL =
	'https://agriculture.ec.europa.eu/data-analysis/markets-outlook/medium-term-outlook_en';

type Props = {
	tr: AppStrings;
	onOpenFoodSecurity?: () => void;
};

export function TransportDirectoryView({ tr, onOpenFoodSecurity }: Props) {
	const [list, setList] = useState<TransportCompany[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState('');
	const [form, setForm] = useState({
		companyName: '',
		contactName: '',
		email: '',
		phone: '',
		coverage: '',
		fleetHint: '',
		notes: '',
	});
	const [saving, setSaving] = useState(false);
	const [msg, setMsg] = useState<string | null>(null);
	const [err, setErr] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		setLoading(true);
		try {
			const c = await loadTransportCompanies();
			setList(c);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		refresh();
	}, [refresh]);

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return list;
		return list.filter(
			c =>
				c.companyName.toLowerCase().includes(q) ||
				c.coverage.toLowerCase().includes(q) ||
				c.fleetHint.toLowerCase().includes(q) ||
				c.notes.toLowerCase().includes(q)
		);
	}, [list, search]);

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setErr(null);
		setMsg(null);
		setSaving(true);
		const res = await registerTransportCompany({
			companyName: form.companyName,
			contactName: form.contactName,
			email: form.email,
			phone: form.phone,
			coverage: form.coverage,
			fleetHint: form.fleetHint,
			notes: form.notes,
		});
		setSaving(false);
		if (!res.ok) {
			setErr(res.error === 'email' ? tr.transportDirErrEmail : tr.transportDirErrCompany);
			return;
		}
		setMsg(tr.transportDirSubmitOk);
		setForm({
			companyName: '',
			contactName: '',
			email: '',
			phone: '',
			coverage: '',
			fleetHint: '',
			notes: '',
		});
		await refresh();
	};

	return (
		<section className="section">
			<h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
				<Truck size={26} color="#7ccd9c" aria-hidden />
				{tr.transportDirTitle}
			</h2>
			<p className="muted" style={{ marginTop: 10 }}>
				{tr.transportDirSubtitle}
			</p>

			<div
				className="contact-panel"
				style={{
					marginTop: 18,
					borderColor: 'rgba(56, 189, 248, 0.35)',
					background: 'rgba(56, 189, 248, 0.06)',
				}}>
				<h3 style={{ margin: '0 0 10px', fontSize: '1rem', color: '#e2e8f0' }}>
					{tr.transportOutlookTitle}
				</h3>
				<p className="muted" style={{ margin: 0, lineHeight: 1.58, fontSize: '.92rem' }}>
					{tr.transportOutlookBody}
				</p>
				<p style={{ margin: '12px 0 0', fontSize: '.84rem' }}>
					<a
						href={EU_AGRI_OUTLOOK_URL}
						target="_blank"
						rel="noopener noreferrer"
						style={{ color: '#6ebf9e' }}>
						{tr.transportOutlookSourceLink}
					</a>
				</p>
				{onOpenFoodSecurity ? (
					<div style={{ marginTop: 12 }}>
						<button type="button" className="btn btn-outline" onClick={onOpenFoodSecurity}>
							{tr.transportOutlookOpenFoodSec}
						</button>
					</div>
				) : null}
			</div>

			<div
				className="contact-panel"
				style={{
					marginTop: 20,
					marginBottom: 24,
					borderColor: 'rgba(124, 205, 156, 0.35)',
					background: 'linear-gradient(165deg, rgba(124,205,156,0.1) 0%, rgba(12,22,17,0.42) 100%)',
				}}>
				<h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.05rem' }}>
					<UserPlus size={18} color="#7ccd9c" aria-hidden />
					{tr.transportDirRegisterTitle}
				</h3>
				<form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
					<div
						className="form-grid"
						style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
						<label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
							<span className="muted" style={{ fontSize: '.85rem' }}>
								{tr.transportDirCompanyName} *
							</span>
							<input
								value={form.companyName}
								onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
								required
								minLength={2}
								autoComplete="organization"
							/>
						</label>
						<label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
							<span className="muted" style={{ fontSize: '.85rem' }}>
								{tr.transportDirContactName}
							</span>
							<input
								value={form.contactName}
								onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
								autoComplete="name"
							/>
						</label>
						<label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
							<span className="muted" style={{ fontSize: '.85rem' }}>
								{tr.transportDirEmail} *
							</span>
							<input
								type="email"
								value={form.email}
								onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
								required
								autoComplete="email"
							/>
						</label>
						<label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
							<span className="muted" style={{ fontSize: '.85rem' }}>
								{tr.transportDirPhone}
							</span>
							<input
								type="tel"
								value={form.phone}
								onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
								placeholder="+359..."
								autoComplete="tel"
							/>
						</label>
					</div>
					<div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
						<label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
							<span className="muted" style={{ fontSize: '.85rem' }}>
								{tr.transportDirCoverage}
							</span>
							<input
								value={form.coverage}
								onChange={e => setForm(f => ({ ...f, coverage: e.target.value }))}
								placeholder={tr.transportDirCoveragePh}
							/>
						</label>
						<label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
							<span className="muted" style={{ fontSize: '.85rem' }}>
								{tr.transportDirFleetHint}
							</span>
							<input
								value={form.fleetHint}
								onChange={e => setForm(f => ({ ...f, fleetHint: e.target.value }))}
								placeholder={tr.transportDirFleetPh}
							/>
						</label>
						<label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
							<span className="muted" style={{ fontSize: '.85rem' }}>
								{tr.transportDirNotes}
							</span>
							<textarea
								rows={2}
								value={form.notes}
								onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
								style={{ resize: 'vertical', minHeight: 56 }}
							/>
						</label>
					</div>
					<div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
						<button type="submit" className="btn btn-primary" disabled={saving}>
							{saving ? <Loader2 size={16} className="spin" aria-hidden /> : null}{' '}
							{tr.transportDirSubmit}
						</button>
						{msg ? (
							<span style={{ color: '#5eead4', fontSize: '.9rem' }}>{msg}</span>
						) : null}
						{err ? (
							<span style={{ color: '#fca5a5', fontSize: '.9rem' }}>{err}</span>
						) : null}
					</div>
				</form>
			</div>

			<div style={{ marginBottom: 12 }}>
				<label style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 420 }}>
					<Search size={18} color="#94a3b8" aria-hidden />
					<input
						type="search"
						value={search}
						onChange={e => setSearch(e.target.value)}
						placeholder={tr.transportDirSearchPh}
						aria-label={tr.transportDirSearchPh}
						style={{
							flex: 1,
							minWidth: 0,
							padding: '11px 12px',
							borderRadius: 10,
							border: '1px solid #3d5248',
							background: '#1a2820',
							color: '#fff',
							fontFamily: 'inherit',
						}}
					/>
				</label>
			</div>

			<h3 style={{ margin: '8px 0 14px', fontSize: '1.05rem' }}>{tr.transportDirCatalogTitle}</h3>

			{loading ? (
				<p className="muted">
					<Loader2 size={18} className="spin" aria-hidden /> {tr.transportDirLoading}
				</p>
			) : filtered.length === 0 ? (
				<p className="muted">{tr.transportDirEmpty}</p>
			) : (
				<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
					{filtered.map(c => (
						<div
							key={c.id}
							className="contact-panel"
							style={{
								margin: 0,
								borderColor: 'rgba(124, 205, 156, 0.22)',
							}}>
							<div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
								<h4 style={{ margin: 0, fontSize: '1.05rem' }}>{c.companyName}</h4>
								<span className="muted" style={{ fontSize: '.78rem' }}>
									{new Date(c.createdAt).toLocaleDateString()}
								</span>
							</div>
							<p className="muted" style={{ margin: '8px 0 6px', fontSize: '.9rem' }}>
								<MapPin size={14} style={{ verticalAlign: '-2px', marginInlineEnd: 6 }} color="#7ccd9c" />
								{c.coverage || '—'}
							</p>
							<p className="muted" style={{ margin: '0 0 6px', fontSize: '.9rem' }}>
								<Package size={14} style={{ verticalAlign: '-2px', marginInlineEnd: 6 }} color="#7ccd9c" />
								{c.fleetHint || '—'}
							</p>
							{c.notes ? (
								<p className="muted" style={{ margin: '0 0 10px', fontSize: '.88rem' }}>
									{c.notes}
								</p>
							) : null}
							<div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
								<a className="btn btn-outline btn-mini" href={`mailto:${encodeURIComponent(c.email)}`}>
									<Mail size={14} aria-hidden /> {tr.transportDirEmailShort}
								</a>
								{c.phone ? (
									<a className="btn btn-outline btn-mini" href={`tel:${c.phone.replace(/\s/g, '')}`}>
										<Phone size={14} aria-hidden /> {tr.transportDirCallShort}
									</a>
								) : null}
								<span className="muted" style={{ fontSize: '.82rem' }}>
									{c.contactName}
								</span>
							</div>
						</div>
					))}
				</div>
			)}

			<p
				className="muted"
				style={{
					marginTop: 22,
					fontSize: '.85rem',
					padding: '12px 14px',
					borderRadius: 8,
					background: 'rgba(124, 205, 156, 0.06)',
					border: '1px solid rgba(124, 205, 156, 0.22)',
					lineHeight: 1.55,
				}}>
				{tr.transportDirDisclaimer}
			</p>
		</section>
	);
}
