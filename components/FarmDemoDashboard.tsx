import { useState } from 'react';
import type { DemoFarmUser } from '../lib/demo-farm-users';

const MOCK_WEATHER = {
	city: 'Добрич',
	temp: 24,
	feels: 22,
	humidity: 58,
	wind: 14,
	condition: 'Слънчево',
	icon: '☀️',
	forecast: [
		{ day: 'Вт', icon: '⛅', min: 18, max: 26 },
		{ day: 'Ср', icon: '🌧️', min: 15, max: 21 },
		{ day: 'Чт', icon: '🌧️', min: 14, max: 19 },
		{ day: 'Пт', icon: '⛅', min: 17, max: 23 },
		{ day: 'Сб', icon: '☀️', min: 20, max: 28 },
	],
};

type DemoField = {
	id: number;
	name: string;
	crop: string;
	hectares: number;
	moisture: number;
	status: string;
	yield: number;
};

const INITIAL_FIELDS: DemoField[] = [
	{ id: 1, name: 'Поле Север', crop: 'Пшеница', hectares: 120, moisture: 68, status: 'добро', yield: 5.8 },
	{ id: 2, name: 'Поле Юг', crop: 'Царевица', hectares: 95, moisture: 42, status: 'внимание', yield: 8.2 },
	{ id: 3, name: 'Поле Изток', crop: 'Слънчоглед', hectares: 80, moisture: 71, status: 'добро', yield: 2.9 },
	{ id: 4, name: 'Поле Запад', crop: 'Рапица', hectares: 45, moisture: 35, status: 'критично', yield: 3.1 },
];

const AI_ALERTS = [
	{
		id: 1,
		type: 'warning',
		field: 'Поле Юг',
		message: 'Почвената влага е под 45%. Препоръчително напояване в следващите 48 часа.',
		action: 'Активирай напояване',
	},
	{
		id: 2,
		type: 'danger',
		field: 'Поле Запад',
		message: 'Критично ниска влага (35%). Риск от загуба на добив при продължаване на жегата.',
		action: 'Спешно напояване',
	},
	{
		id: 3,
		type: 'info',
		field: 'Поле Север',
		message: 'Оптимален момент за внасяне на азотен тор в следващите 5–7 дни.',
		action: 'Планирай торене',
	},
];

const DEMO_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Mono:wght@400;500&family=Geist:wght@300;400;500&display=swap');
  .farm-demo-root {
    --bg: #f5f4f0; --surface: #ffffff; --surface2: #f0efe9;
    --border: rgba(0,0,0,0.08); --border2: rgba(0,0,0,0.14);
    --text: #1a1916; --text2: #6b6a65; --text3: #9b9a94;
    --green: #1a7a52; --green-bg: #e8f5ee; --green-mid: #2ea872;
    --amber: #b45309; --amber-bg: #fef3c7; --red: #be123c; --red-bg: #fff1f2;
    --blue: #1d4ed8; --blue-bg: #eff6ff;
    --radius: 12px; --radius-sm: 8px;
    --shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
    font-family: 'Geist', sans-serif; color: var(--text);
    min-height: 100vh; background: var(--bg);
  }
  .farm-demo-root * { box-sizing: border-box; }
  .farm-demo-app { display: flex; min-height: 100vh; }
  .farm-demo-sidebar {
    width: 220px; min-height: 100vh; background: var(--text);
    display: flex; flex-direction: column; flex-shrink: 0;
    position: fixed; left: 0; top: 0; bottom: 0; z-index: 40;
  }
  .farm-demo-main { margin-left: 220px; flex: 1; padding: 28px 32px; }
  .farm-demo-sidebar-logo { padding: 24px 20px 20px; border-bottom: 1px solid rgba(255,255,255,0.08); }
  .farm-demo-logo-text { font-family: 'Instrument Serif', serif; font-size: 22px; color: #fff; }
  .farm-demo-logo-text span { color: #4ade80; }
  .farm-demo-logo-sub { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 2px; }
  .farm-demo-nav { flex: 1; padding: 16px 0; }
  .farm-demo-nav-section { font-size: 10px; font-weight: 500; color: rgba(255,255,255,0.3); letter-spacing: 0.1em; text-transform: uppercase; padding: 12px 20px 6px; }
  .farm-demo-nav-item {
    display: flex; align-items: center; gap: 10px; padding: 9px 20px;
    font-size: 13.5px; color: rgba(255,255,255,0.6); cursor: pointer;
    border-left: 2px solid transparent;
  }
  .farm-demo-nav-item:hover { color: #fff; background: rgba(255,255,255,0.05); }
  .farm-demo-nav-item.active { color: #4ade80; border-left-color: #4ade80; background: rgba(74,222,128,0.06); }
  .farm-demo-user { padding: 16px 20px; border-top: 1px solid rgba(255,255,255,0.08); }
  .farm-demo-user-name { font-size: 13px; font-weight: 500; color: #fff; }
  .farm-demo-user-farm { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 2px; }
  .farm-demo-logout { font-size: 12px; color: rgba(255,255,255,0.35); cursor: pointer; margin-top: 10px; background: none; border: none; padding: 0; font-family: inherit; }
  .farm-demo-logout:hover { color: rgba(255,255,255,0.7); }
  .farm-demo-page-header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 24px; }
  .farm-demo-page-title { font-family: 'Instrument Serif', serif; font-size: 26px; line-height: 1; }
  .farm-demo-page-date { font-size: 13px; color: var(--text3); margin-top: 4px; }
  .farm-demo-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); }
  .farm-demo-card-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px 12px; border-bottom: 1px solid var(--border); }
  .farm-demo-card-title { font-size: 13px; font-weight: 500; color: var(--text2); text-transform: uppercase; letter-spacing: 0.05em; }
  .farm-demo-stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
  .farm-demo-stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px 20px; }
  .farm-demo-stat-label { font-size: 11px; color: var(--text3); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
  .farm-demo-stat-value { font-family: 'Instrument Serif', serif; font-size: 28px; line-height: 1; }
  .farm-demo-stat-sub { font-size: 12px; color: var(--text3); margin-top: 4px; }
  .farm-demo-badge { display: inline-block; font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 20px; margin-top: 6px; }
  .farm-demo-badge-green { background: var(--green-bg); color: var(--green); }
  .farm-demo-badge-amber { background: var(--amber-bg); color: var(--amber); }
  .farm-demo-badge-red { background: var(--red-bg); color: var(--red); }
  .farm-demo-badge-blue { background: var(--blue-bg); color: var(--blue); }
  .farm-demo-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
  .farm-demo-table { width: 100%; border-collapse: collapse; }
  .farm-demo-table th { font-size: 11px; font-weight: 500; color: var(--text3); text-transform: uppercase; padding: 10px 16px; text-align: left; border-bottom: 1px solid var(--border); background: var(--surface2); }
  .farm-demo-table td { font-size: 13.5px; padding: 12px 16px; border-bottom: 1px solid var(--border); }
  .farm-demo-table tr:last-child td { border-bottom: none; }
  .farm-demo-moisture-bar { width: 100%; height: 5px; background: var(--border2); border-radius: 3px; overflow: hidden; margin-top: 4px; }
  .farm-demo-moisture-fill { height: 100%; border-radius: 3px; }
  .farm-demo-alert-list { padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; }
  .farm-demo-alert { padding: 12px 14px; border-radius: var(--radius-sm); border-left: 3px solid; }
  .farm-demo-alert-warning { background: var(--amber-bg); border-color: var(--amber); }
  .farm-demo-alert-danger { background: var(--red-bg); border-color: var(--red); }
  .farm-demo-alert-info { background: var(--blue-bg); border-color: var(--blue); }
  .farm-demo-weather-main { padding: 20px; display: flex; align-items: center; gap: 16px; }
  .farm-demo-weather-temp { font-family: 'Instrument Serif', serif; font-size: 48px; line-height: 1; }
  .farm-demo-forecast { padding: 12px 20px; border-top: 1px solid var(--border); display: flex; }
  .farm-demo-forecast-day { flex: 1; text-align: center; padding: 6px 4px; }
  .farm-demo-add-btn { font-size: 13px; font-weight: 500; color: var(--green); background: var(--green-bg); border: none; padding: 7px 14px; border-radius: var(--radius-sm); cursor: pointer; }
  .farm-demo-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
  .farm-demo-modal { background: var(--surface); border-radius: 16px; padding: 32px; width: 460px; max-width: 95vw; }
  .farm-demo-form-input, .farm-demo-form-select {
    width: 100%; padding: 10px 13px; border: 1px solid var(--border2); border-radius: var(--radius-sm);
    font-size: 14px; font-family: 'Geist', sans-serif; background: var(--bg);
  }
  .farm-demo-btn-primary { background: var(--green); color: #fff; border: none; padding: 10px 20px; border-radius: var(--radius-sm); cursor: pointer; font-family: inherit; }
  .farm-demo-btn-ghost { background: transparent; border: 1px solid var(--border2); padding: 10px 20px; border-radius: var(--radius-sm); cursor: pointer; margin-right: 8px; font-family: inherit; }
  .farm-demo-demo-banner {
    background: var(--green-bg); color: var(--green); font-size: 12px; padding: 8px 14px;
    border-radius: var(--radius-sm); margin-bottom: 16px;
  }
  @media (max-width: 900px) {
    .farm-demo-stat-grid { grid-template-columns: repeat(2, 1fr); }
    .farm-demo-grid-2 { grid-template-columns: 1fr; }
    .farm-demo-sidebar { display: none; }
    .farm-demo-main { margin-left: 0; padding: 16px; }
  }
`;

function moistureColor(v: number) {
	if (v >= 60) return '#1a7a52';
	if (v >= 45) return '#d97706';
	return '#be123c';
}

function statusColor(s: string) {
	if (s === 'добро') return '#1a7a52';
	if (s === 'внимание') return '#d97706';
	return '#be123c';
}

function todayBg() {
	return new Date().toLocaleDateString('bg-BG', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});
}

type Props = {
	user: DemoFarmUser;
	onLogout: () => void;
};

export function FarmDemoDashboard({ user, onLogout }: Props) {
	const [page, setPage] = useState<'dashboard' | 'fields' | 'weather' | 'ai' | 'settings'>(
		'dashboard'
	);
	const [fields, setFields] = useState<DemoField[]>(INITIAL_FIELDS);
	const [showModal, setShowModal] = useState(false);
	const [form, setForm] = useState({
		name: '',
		crop: 'Пшеница',
		hectares: '',
		region: 'Добруджа',
	});

	const totalHa = fields.reduce((s, f) => s + f.hectares, 0);
	const avgMoist = Math.round(fields.reduce((s, f) => s + f.moisture, 0) / fields.length);
	const alerts = fields.filter(f => f.status !== 'добро').length;
	const avgYield = (fields.reduce((s, f) => s + f.yield, 0) / fields.length).toFixed(1);

	const nav = [
		{ id: 'dashboard' as const, icon: '⊞', label: 'Dashboard' },
		{ id: 'fields' as const, icon: '◫', label: 'Полета' },
		{ id: 'weather' as const, icon: '◎', label: 'Метеорология' },
		{ id: 'ai' as const, icon: '◈', label: 'AI Препоръки' },
		{ id: 'settings' as const, icon: '◉', label: 'Настройки' },
	];

	function handleAddField() {
		if (!form.name || !form.hectares) return;
		setFields([
			...fields,
			{
				id: Date.now(),
				name: form.name,
				crop: form.crop,
				hectares: Number(form.hectares),
				moisture: Math.round(50 + Math.random() * 30),
				status: 'добро',
				yield: +(2 + Math.random() * 7).toFixed(1),
			},
		]);
		setShowModal(false);
		setForm({ name: '', crop: 'Пшеница', hectares: '', region: 'Добруджа' });
	}

	return (
		<div className="farm-demo-root">
			<style>{DEMO_STYLES}</style>
			<div className="farm-demo-app">
				<aside className="farm-demo-sidebar">
					<div className="farm-demo-sidebar-logo">
						<div className="farm-demo-logo-text">
							Agri<span>Nexus</span>
						</div>
						<div className="farm-demo-logo-sub">{user.farm}</div>
					</div>
					<nav className="farm-demo-nav">
						<div className="farm-demo-nav-section">Платформа</div>
						{nav.map(n => (
							<div
								key={n.id}
								className={`farm-demo-nav-item${page === n.id ? ' active' : ''}`}
								onClick={() => setPage(n.id)}
								onKeyDown={e => e.key === 'Enter' && setPage(n.id)}
								role="button"
								tabIndex={0}>
								<span>{n.icon}</span>
								{n.label}
							</div>
						))}
					</nav>
					<div className="farm-demo-user">
						<div className="farm-demo-user-name">{user.name}</div>
						<div className="farm-demo-user-farm">
							{user.hectares} ха · Демо
						</div>
						<button type="button" className="farm-demo-logout" onClick={onLogout}>
							Изход →
						</button>
					</div>
				</aside>

				<main className="farm-demo-main">
					<div className="farm-demo-demo-banner">
						Демо табло — данните са примерни. Реалният акаунт: регистрация с имейл на agrinexus.eu.com.
					</div>

					{page === 'dashboard' && (
						<>
							<div className="farm-demo-page-header">
								<div>
									<div className="farm-demo-page-title">
										Добро утро, {user.name.split(' ')[0]} 👋
									</div>
									<div className="farm-demo-page-date">{todayBg()}</div>
								</div>
							</div>
							<div className="farm-demo-stat-grid">
								<div className="farm-demo-stat-card">
									<div className="farm-demo-stat-label">Общо хектари</div>
									<div className="farm-demo-stat-value">{totalHa}</div>
									<div className="farm-demo-stat-sub">{fields.length} активни полета</div>
								</div>
								<div className="farm-demo-stat-card">
									<div className="farm-demo-stat-label">Средна влага</div>
									<div className="farm-demo-stat-value">{avgMoist}%</div>
									<span
										className={`farm-demo-badge ${
											avgMoist >= 60
												? 'farm-demo-badge-green'
												: avgMoist >= 45
													? 'farm-demo-badge-amber'
													: 'farm-demo-badge-red'
										}`}>
										{avgMoist >= 60 ? 'Добро' : avgMoist >= 45 ? 'Внимание' : 'Критично'}
									</span>
								</div>
								<div className="farm-demo-stat-card">
									<div className="farm-demo-stat-label">AI известия</div>
									<div className="farm-demo-stat-value">{alerts}</div>
									<div className="farm-demo-stat-sub">Полета за действие</div>
								</div>
								<div className="farm-demo-stat-card">
									<div className="farm-demo-stat-label">Прогноза добив</div>
									<div className="farm-demo-stat-value">{avgYield}</div>
									<div className="farm-demo-stat-sub">т/ха (средно)</div>
								</div>
							</div>
							<div className="farm-demo-grid-2">
								<div className="farm-demo-card">
									<div className="farm-demo-card-header">
										<span className="farm-demo-card-title">Метеорология</span>
										<span style={{ fontSize: 12, color: 'var(--text3)' }}>
											{MOCK_WEATHER.city}
										</span>
									</div>
									<div className="farm-demo-weather-main">
										<span style={{ fontSize: 44 }}>{MOCK_WEATHER.icon}</span>
										<div>
											<div className="farm-demo-weather-temp">{MOCK_WEATHER.temp}°</div>
											<div style={{ fontSize: 13, color: 'var(--text2)' }}>
												{MOCK_WEATHER.condition}
											</div>
										</div>
									</div>
									<div className="farm-demo-forecast">
										{MOCK_WEATHER.forecast.map(d => (
											<div key={d.day} className="farm-demo-forecast-day">
												<div style={{ fontSize: 11, color: 'var(--text3)' }}>{d.day}</div>
												<div>{d.icon}</div>
												<div style={{ fontSize: 11 }}>
													{d.min}° / {d.max}°
												</div>
											</div>
										))}
									</div>
								</div>
								<div className="farm-demo-card">
									<div className="farm-demo-card-header">
										<span className="farm-demo-card-title">AI известия</span>
									</div>
									<div className="farm-demo-alert-list">
										{AI_ALERTS.map(a => (
											<div
												key={a.id}
												className={`farm-demo-alert farm-demo-alert-${a.type}`}>
												<div style={{ fontSize: 11, fontWeight: 500, marginBottom: 4 }}>
													{a.field}
												</div>
												<div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{a.message}</div>
											</div>
										))}
									</div>
								</div>
							</div>
							<div className="farm-demo-card">
								<div className="farm-demo-card-header">
									<span className="farm-demo-card-title">Моите полета</span>
								</div>
								<table className="farm-demo-table">
									<thead>
										<tr>
											<th>Поле</th>
											<th>Култура</th>
											<th>Ха</th>
											<th>Влага</th>
											<th>Добив</th>
											<th>Статус</th>
										</tr>
									</thead>
									<tbody>
										{fields.map(f => (
											<tr key={f.id}>
												<td style={{ fontWeight: 500 }}>{f.name}</td>
												<td>{f.crop}</td>
												<td>{f.hectares}</td>
												<td>
													<div style={{ fontSize: 12 }}>{f.moisture}%</div>
													<div className="farm-demo-moisture-bar">
														<div
															className="farm-demo-moisture-fill"
															style={{
																width: `${f.moisture}%`,
																background: moistureColor(f.moisture),
															}}
														/>
													</div>
												</td>
												<td style={{ fontFamily: "'DM Mono', monospace" }}>{f.yield} т/ха</td>
												<td>
													<span
														style={{
															display: 'inline-block',
															width: 7,
															height: 7,
															borderRadius: '50%',
															background: statusColor(f.status),
															marginRight: 6,
														}}
													/>
													{f.status}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</>
					)}

					{page === 'fields' && (
						<>
							<div className="farm-demo-page-header">
								<div className="farm-demo-page-title">Моите полета</div>
								<button type="button" className="farm-demo-add-btn" onClick={() => setShowModal(true)}>
									+ Добави поле
								</button>
							</div>
							<div className="farm-demo-card">
								<table className="farm-demo-table">
									<thead>
										<tr>
											<th>Поле</th>
											<th>Култура</th>
											<th>Ха</th>
											<th>Влага</th>
											<th>Добив</th>
											<th>Статус</th>
										</tr>
									</thead>
									<tbody>
										{fields.map(f => (
											<tr key={f.id}>
												<td style={{ fontWeight: 500 }}>{f.name}</td>
												<td>{f.crop}</td>
												<td>{f.hectares}</td>
												<td>{f.moisture}%</td>
												<td>{f.yield} т/ха</td>
												<td>{f.status}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</>
					)}

					{(page === 'weather' || page === 'ai') && (
						<div className="farm-demo-card" style={{ padding: 40, textAlign: 'center' }}>
							<div style={{ fontSize: 32, marginBottom: 12 }}>🚧</div>
							<div style={{ fontWeight: 500 }}>Идва скоро</div>
						</div>
					)}

					{page === 'settings' && (
						<div className="farm-demo-card" style={{ padding: 28, maxWidth: 520 }}>
							<div style={{ fontWeight: 500, marginBottom: 16 }}>Профил (демо)</div>
							<p style={{ fontSize: 14, marginBottom: 8 }}>
								<strong>{user.name}</strong>
							</p>
							<p style={{ fontSize: 14, color: 'var(--text2)' }}>{user.email}</p>
							<p style={{ fontSize: 14, color: 'var(--text2)', marginTop: 8 }}>{user.farm}</p>
						</div>
					)}
				</main>
			</div>

			{showModal && (
				<div
					className="farm-demo-modal-bg"
					role="presentation"
					onClick={e => e.target === e.currentTarget && setShowModal(false)}>
					<div className="farm-demo-modal" role="dialog">
						<h3 style={{ fontFamily: "'Instrument Serif', serif", marginBottom: 16 }}>
							Добави поле
						</h3>
						<label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Име</label>
						<input
							className="farm-demo-form-input"
							value={form.name}
							onChange={e => setForm({ ...form, name: e.target.value })}
							style={{ marginBottom: 12 }}
						/>
						<label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Хектари</label>
						<input
							className="farm-demo-form-input"
							type="number"
							value={form.hectares}
							onChange={e => setForm({ ...form, hectares: e.target.value })}
							style={{ marginBottom: 12 }}
						/>
						<label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Култура</label>
						<select
							className="farm-demo-form-select"
							value={form.crop}
							onChange={e => setForm({ ...form, crop: e.target.value })}
							style={{ marginBottom: 16 }}>
							{['Пшеница', 'Царевица', 'Слънчоглед', 'Рапица'].map(c => (
								<option key={c}>{c}</option>
							))}
						</select>
						<div style={{ textAlign: 'right' }}>
							<button type="button" className="farm-demo-btn-ghost" onClick={() => setShowModal(false)}>
								Отказ
							</button>
							<button type="button" className="farm-demo-btn-primary" onClick={handleAddField}>
								Добави
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
