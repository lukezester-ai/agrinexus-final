import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Loader2, Phone, Search, UserPlus, Wrench } from 'lucide-react';
import type { AppStrings } from '../lib/i18n';
import {
	loadEquipmentRentalCompanies,
	registerEquipmentRentalCompany,
} from '../lib/equipment-rental-client';
import type { EquipmentRentalCompany } from '../lib/equipment-rental-types';

type Props = {
	tr: AppStrings;
};

export function EquipmentRentalDirectoryView({ tr }: Props) {
	const [list, setList] = useState<EquipmentRentalCompany[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState('');
	const [form, setForm] = useState({
		companyName: '',
		contactName: '',
		email: '',
		phone: '',
		coverage: '',
		equipmentHint: '',
		services: '',
		notes: '',
	});
	const [saving, setSaving] = useState(false);
	const [msg, setMsg] = useState<string | null>(null);
	const [err, setErr] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		setLoading(true);
		try {
			const companies = await loadEquipmentRentalCompanies();
			setList(companies);
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
		return list.filter(item => {
			const haystack = [
				item.companyName,
				item.coverage,
				item.phone,
				item.email,
				item.equipmentHint,
				item.services,
				item.notes,
			]
				.join(' ')
				.toLowerCase();
			return haystack.includes(q);
		});
	}, [list, search]);

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setErr(null);
		setMsg(null);
		setSaving(true);
		const res = await registerEquipmentRentalCompany(form);
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
			equipmentHint: '',
			services: '',
			notes: '',
		});
		await refresh();
	};

	return (
		<section className="section">
			<h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
				<Wrench size={26} color="#7ccd9c" aria-hidden />
				{tr.equipmentRentalTitle}
			</h2>
			<p className="muted" style={{ marginTop: 10 }}>
				{tr.equipmentRentalSubtitle}
			</p>

			<div
				className="contact-panel"
				style={{
					marginTop: 16,
					marginBottom: 22,
					borderColor: 'rgba(124, 205, 156, 0.35)',
					background: 'linear-gradient(165deg, rgba(124,205,156,0.10) 0%, rgba(12,22,17,0.42) 100%)',
				}}>
				<h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.05rem' }}>
					<UserPlus size={18} color="#7ccd9c" aria-hidden />
					{tr.transportDirRegisterTitle}
				</h3>
				<form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
					<div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
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

					<div className="form-grid" style={{ gridTemplateColumns: '1fr', gap: 12 }}>
						<label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
							<span className="muted" style={{ fontSize: '.85rem' }}>{tr.equipmentRentalRegionLabel}</span>
							<input
								value={form.coverage}
								onChange={e => setForm(f => ({ ...f, coverage: e.target.value }))}
								placeholder="e.g. Plovdiv, Pazardzhik, Haskovo"
							/>
						</label>
						<label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
							<span className="muted" style={{ fontSize: '.85rem' }}>{tr.equipmentRentalSpecsLabel}</span>
							<input
								value={form.equipmentHint}
								onChange={e => setForm(f => ({ ...f, equipmentHint: e.target.value }))}
								placeholder="e.g. combines, tractors, seed drills"
							/>
						</label>
						<label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
							<span className="muted" style={{ fontSize: '.85rem' }}>{tr.equipmentRentalServicesLabel}</span>
							<input
								value={form.services}
								onChange={e => setForm(f => ({ ...f, services: e.target.value }))}
								placeholder="e.g. operator, transport, service on site"
							/>
						</label>
						<label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
							<span className="muted" style={{ fontSize: '.85rem' }}>{tr.transportDirNotes}</span>
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
							{saving ? <Loader2 size={16} className="spin" aria-hidden /> : null} {tr.transportDirSubmit}
						</button>
						{msg ? <span style={{ color: '#5eead4', fontSize: '.9rem' }}>{msg}</span> : null}
						{err ? <span style={{ color: '#fca5a5', fontSize: '.9rem' }}>{err}</span> : null}
					</div>
				</form>
			</div>

			<div style={{ marginBottom: 14 }}>
				<label style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 460 }}>
					<Search size={18} color="#94a3b8" aria-hidden />
					<input
						type="search"
						value={search}
						onChange={e => setSearch(e.target.value)}
						placeholder={tr.equipmentRentalSearchPh}
						aria-label={tr.equipmentRentalSearchPh}
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

			<h3 style={{ margin: '8px 0 14px', fontSize: '1.05rem' }}>{tr.equipmentRentalCatalogTitle}</h3>
			{loading ? <p className="muted">{tr.transportDirLoading}</p> : null}

			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
				{filtered.map(item => (
					<article key={item.id} className="contact-panel" style={{ margin: 0 }}>
						<h4 style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8, fontSize: '1rem' }}>
							<Building2 size={16} color="#7ccd9c" aria-hidden />
							{item.companyName}
						</h4>
						<p className="muted" style={{ margin: '0 0 10px', fontSize: '.9rem' }}>
							<strong style={{ color: '#94a3b8' }}>{tr.equipmentRentalRegionLabel}:</strong> {item.coverage}
						</p>
						<p className="muted" style={{ margin: '0 0 6px', fontSize: '.86rem' }}>
							<strong style={{ color: '#94a3b8' }}>{tr.equipmentRentalSpecsLabel}:</strong>
						</p>
						<p className="muted" style={{ margin: '0 0 10px', fontSize: '.9rem' }}>
							{item.equipmentHint || '—'}
						</p>
						<p className="muted" style={{ margin: '0 0 6px', fontSize: '.86rem' }}>
							<strong style={{ color: '#94a3b8' }}>{tr.equipmentRentalServicesLabel}:</strong>
						</p>
						<p className="muted" style={{ margin: '0 0 10px', fontSize: '.9rem' }}>
							{item.services || '—'}
						</p>
						{item.notes ? (
							<p className="muted" style={{ margin: '0 0 10px', fontSize: '.86rem' }}>
								{item.notes}
							</p>
						) : null}
						<p className="muted" style={{ margin: 0, fontSize: '.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
							<Phone size={14} color="#94a3b8" aria-hidden />
							<strong style={{ color: '#94a3b8' }}>{tr.equipmentRentalContactsLabel}:</strong> {item.phone} ·{' '}
							{item.email}
						</p>
					</article>
				))}
			</div>

			{filtered.length === 0 ? (
				<p className="muted" style={{ marginTop: 16 }}>
					{tr.equipmentRentalEmpty}
				</p>
			) : null}

			<p
				className="muted"
				style={{
					fontSize: '.85rem',
					padding: '12px 14px',
					borderRadius: 8,
					background: 'rgba(124, 205, 156, 0.06)',
					border: '1px solid rgba(124, 205, 156, 0.22)',
					lineHeight: 1.55,
					marginTop: 16,
				}}>
				{tr.equipmentRentalDisclaimer}
			</p>
		</section>
	);
}

