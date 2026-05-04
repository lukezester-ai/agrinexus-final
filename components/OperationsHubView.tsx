import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	BarChart3,
	Calculator,
	CalendarDays,
	ClipboardList,
	FileText,
	LineChart,
	StickyNote,
	Truck,
	Wrench,
} from 'lucide-react';
import type { AppStrings, UiLang } from '../lib/i18n';
import type { OpsHubPersistedV1, OpsTask, OpsTaskColumn } from '../lib/operations-hub-types';
import { useSupabaseSession } from '../hooks/use-supabase-session';
import { normalizePersistedBody, parseTasks } from '../lib/operations-hub-types';
import { fetchOpsHubFromSupabase, upsertOpsHubToSupabase } from '../lib/operations-hub-supabase';
import { fetchOperationsHubRemote, pushOperationsHubRemote } from '../lib/operations-hub-sync-client';

const BUNDLE_KEY = 'agrinexus-ops-state-v1';
const LEGACY_TASKS = 'agrinexus-ops-tasks';
const LEGACY_NOTES = 'agrinexus-ops-notes';

export type OpsHubNavigate =
	| 'subsidy-calculator'
	| 'transport-directory'
	| 'equipment-rental'
	| 'crop-statistics'
	| 'season-calendar'
	| 'command'
	| 'trade-documents'
	| 'market'
	| 'assistant'
	| 'clients'
	| 'company';

export type OperationsHubDealSnapshot = {
	id: number;
	product: string;
	category: string;
	packaging: string;
	certification: string;
	qualitySpec: string;
	availableVolume: string;
	incoterm: string;
	deliveryWindow: string;
	from: string;
	to: string;
	flag: string;
	profit: number;
	prevProfit: number;
	price: string;
	isMENA: boolean;
	volatility: string;
};

function writeBundle(p: OpsHubPersistedV1): void {
	try {
		window.localStorage.setItem(BUNDLE_KEY, JSON.stringify(p));
		window.localStorage.removeItem(LEGACY_TASKS);
		window.localStorage.removeItem(LEGACY_NOTES);
	} catch {
		/* ignore */
	}
}

function seedTasks(lang: UiLang): OpsTask[] {
	const mk = (id: string, bg: string, en: string, column: OpsTaskColumn): OpsTask => ({
		id,
		title: lang === 'bg' ? bg : en,
		column,
	});
	return [
		mk(
			'seed-isun',
			'Провери срокове по ИСУН / избрана мярка',
			'Check deadlines for your measure / application windows',
			'todo',
		),
		mk(
			'seed-log',
			'Оферти за транспорт или техника под наем',
			'Request quotes — freight or equipment rental',
			'doing',
		),
		mk(
			'seed-field',
			'Преглед на напояване и статистика по култури',
			'Review irrigation hints and crop statistics',
			'todo',
		),
	];
}

function freshSeed(lang: UiLang): OpsHubPersistedV1 {
	return {
		schemaVersion: 1,
		updatedAt: new Date().toISOString(),
		locale: lang,
		tasks: seedTasks(lang),
		notes: '',
	};
}

function loadInitialPersisted(lang: UiLang): OpsHubPersistedV1 {
	if (typeof window === 'undefined') return freshSeed(lang);
	try {
		const raw = window.localStorage.getItem(BUNDLE_KEY);
		if (raw) {
			const n = normalizePersistedBody(JSON.parse(raw));
			if (n) return { ...n, locale: lang };
		}
		const legacyTasksRaw = window.localStorage.getItem(LEGACY_TASKS);
		const legacyNotes = window.localStorage.getItem(LEGACY_NOTES) ?? '';
		let legacyTasks: OpsTask[] = [];
		if (legacyTasksRaw) {
			try {
				legacyTasks = parseTasks(JSON.parse(legacyTasksRaw));
			} catch {
				/* ignore */
			}
		}
		if (legacyTasks.length > 0 || legacyNotes.length > 0) {
			const migrated: OpsHubPersistedV1 = {
				schemaVersion: 1,
				updatedAt: new Date().toISOString(),
				locale: lang,
				tasks: legacyTasks.length > 0 ? legacyTasks : seedTasks(lang),
				notes: legacyNotes.slice(0, 8000),
			};
			writeBundle(migrated);
			return migrated;
		}
		const seeded = freshSeed(lang);
		writeBundle(seeded);
		return seeded;
	} catch {
		return freshSeed(lang);
	}
}

function newId(): string {
	try {
		return crypto.randomUUID();
	} catch {
		return `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
	}
}

function revisionMs(p: OpsHubPersistedV1): number {
	const n = Date.parse(p.updatedAt);
	return Number.isNaN(n) ? 0 : n;
}

function pickNewest(
	local: OpsHubPersistedV1,
	api: OpsHubPersistedV1 | null | undefined,
	cloud: OpsHubPersistedV1 | null | undefined,
): OpsHubPersistedV1 {
	let best = local;
	if (cloud != null && revisionMs(cloud) > revisionMs(best)) best = cloud;
	if (api != null && revisionMs(api) > revisionMs(best)) best = api;
	return best;
}

type TabKey = 'workspace' | 'pins';

export function OperationsHubView(props: {
	tr: AppStrings;
	lang: UiLang;
	watchedDeals: OperationsHubDealSnapshot[];
	alertsEnabledIds: number[];
	toggleWatchlist: (dealId: number) => void;
	toggleAlert: (dealId: number) => void;
	onNavigate: (view: OpsHubNavigate) => void;
	MVP_MODE: boolean;
	lastSavedDeal: OperationsHubDealSnapshot | null;
	lastAlertDeal: OperationsHubDealSnapshot | null;
}) {
	const {
		tr,
		lang,
		watchedDeals,
		alertsEnabledIds,
		toggleWatchlist,
		toggleAlert,
		onNavigate,
		MVP_MODE,
		lastSavedDeal,
		lastAlertDeal,
	} = props;

	const [tab, setTab] = useState<TabKey>('workspace');
	const [persisted, setPersisted] = useState<OpsHubPersistedV1>(() => loadInitialPersisted(lang));
	const pushDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const cloudPushDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const cloudUserIdRef = useRef<string | null>(null);

	const { user, loading: sessionLoading } = useSupabaseSession();
	cloudUserIdRef.current = user?.id ?? null;

	const schedulePush = useCallback((snapshot: OpsHubPersistedV1) => {
		if (pushDebounceRef.current) clearTimeout(pushDebounceRef.current);
		pushDebounceRef.current = setTimeout(async () => {
			pushDebounceRef.current = null;
			const r = await pushOperationsHubRemote(snapshot);
			if (r.ok && 'conflict' in r && r.conflict === true) {
				writeBundle(r.state);
				setPersisted({ ...r.state, locale: lang });
			}
		}, 650);
	}, [lang]);

	const scheduleCloudPush = useCallback((snapshot: OpsHubPersistedV1) => {
		if (cloudPushDebounceRef.current) clearTimeout(cloudPushDebounceRef.current);
		cloudPushDebounceRef.current = setTimeout(async () => {
			cloudPushDebounceRef.current = null;
			const uid = cloudUserIdRef.current;
			if (!uid) return;
			const r = await upsertOpsHubToSupabase(uid, snapshot);
			if (r.ok === false && 'conflict' in r && r.conflict) {
				writeBundle(r.serverState);
				setPersisted({ ...r.serverState, locale: lang });
			}
		}, 650);
	}, [lang]);

	const commitPersisted = useCallback(
		(patch: Partial<Pick<OpsHubPersistedV1, 'tasks' | 'notes'>>) => {
			setPersisted(prev => {
				const next: OpsHubPersistedV1 = {
					schemaVersion: 1,
					updatedAt: new Date().toISOString(),
					locale: lang,
					tasks: patch.tasks !== undefined ? patch.tasks : prev.tasks,
					notes: patch.notes !== undefined ? patch.notes.slice(0, 8000) : prev.notes,
				};
				writeBundle(next);
				schedulePush(next);
				scheduleCloudPush(next);
				return next;
			});
		},
		[lang, schedulePush, scheduleCloudPush],
	);

	useEffect(() => {
		return () => {
			if (pushDebounceRef.current) clearTimeout(pushDebounceRef.current);
			if (cloudPushDebounceRef.current) clearTimeout(cloudPushDebounceRef.current);
		};
	}, []);

	useEffect(() => {
		if (sessionLoading) return;
		let cancelled = false;
		(async () => {
			const [apiRemote, cloudRemote] = await Promise.all([
				fetchOperationsHubRemote(),
				user?.id ? fetchOpsHubFromSupabase(user.id) : Promise.resolve(null),
			]);
			if (cancelled) return;
			setPersisted(prev => {
				const winner = pickNewest(prev, apiRemote, cloudRemote);
				const merged = { ...winner, locale: lang };
				if (revisionMs(winner) > revisionMs(prev)) {
					writeBundle(merged);
					schedulePush(merged);
					scheduleCloudPush(merged);
					return merged;
				}
				schedulePush(prev);
				scheduleCloudPush(prev);
				return prev;
			});
		})();
		return () => {
			cancelled = true;
		};
	}, [lang, schedulePush, scheduleCloudPush, sessionLoading, user?.id]);

	const tasks = persisted.tasks;
	const notes = persisted.notes;

	const [draftTitle, setDraftTitle] = useState('');

	const counts = useMemo(() => {
		let todo = 0;
		let doing = 0;
		let done = 0;
		for (const t of tasks) {
			if (t.column === 'todo') todo++;
			else if (t.column === 'doing') doing++;
			else done++;
		}
		return { todo, doing, done, total: tasks.length };
	}, [tasks]);

	const byColumn = useCallback(
		(col: OpsTaskColumn) => tasks.filter(t => t.column === col),
		[tasks],
	);

	const addTask = (column: OpsTaskColumn) => {
		const title = draftTitle.trim();
		if (!title) return;
		commitPersisted({
			tasks: [...tasks, { id: newId(), title: title.slice(0, 280), column }],
		});
		setDraftTitle('');
	};

	const removeTask = (id: string) => commitPersisted({ tasks: tasks.filter(t => t.id !== id) });

	const setColumn = (id: string, column: OpsTaskColumn) =>
		commitPersisted({
			tasks: tasks.map(t => (t.id === id ? { ...t, column } : t)),
		});

	const cols: { key: OpsTaskColumn; label: string }[] = [
		{ key: 'todo', label: tr.opsColTodo },
		{ key: 'doing', label: tr.opsColDoing },
		{ key: 'done', label: tr.opsColDone },
	];

	const pinsTabBody =
		watchedDeals.length === 0 ? (
			<div>
				<p className="muted">{tr.opsPinsEmpty}</p>
				<p className="muted" style={{ marginTop: 10, fontSize: '.86rem' }}>
					{tr.opsPinsStorageHint}
				</p>
				<div className="deal-actions" style={{ marginTop: 14 }}>
					<button type="button" className="deal-chip-btn active" onClick={() => onNavigate('market')}>
						{tr.opsPinsGoMarket}
					</button>
				</div>
			</div>
		) : (
			<div className="grid">
				{watchedDeals.map(deal => {
					const delta = deal.profit - deal.prevProfit;
					return (
						<div className="deal-card top" key={`w-${deal.id}`}>
							<div
								style={{
									display: 'flex',
									justifyContent: 'space-between',
									marginBottom: 8,
								}}>
								<span
									style={{
										fontSize: '.75rem',
										background: deal.isMENA ? '#f59e0b' : '#3b82f6',
										borderRadius: 6,
										padding: '3px 9px',
									}}>
									{deal.flag} {deal.isMENA ? 'MENA' : 'EU'}
								</span>
								<strong style={{ color: '#7ccd9c' }}>+{deal.profit}%</strong>
							</div>
							<h3 style={{ margin: '0 0 6px' }}>{deal.product}</h3>
							<div className="muted" style={{ fontSize: '.84rem' }}>
								{deal.from} → {deal.to}
							</div>
							<div
								className="muted"
								style={{
									background: '#101914',
									marginTop: 8,
									borderRadius: 8,
									padding: 8,
									fontSize: '.84rem',
								}}>
								<div>📦 {deal.packaging}</div>
								<div style={{ color: '#7ccd9c', marginTop: 3 }}>
									📜 {deal.certification}
								</div>
								<div style={{ marginTop: 3 }}>
									🏷️ {tr.dealCategory}: {deal.category}
								</div>
								<div style={{ marginTop: 3 }}>
									🧪 {tr.dealQuality}: {deal.qualitySpec}
								</div>
								<div style={{ marginTop: 3 }}>
									📦 {tr.dealVolume}: {deal.availableVolume}
								</div>
								<div style={{ marginTop: 3 }}>
									🚢 {tr.dealIncoterm}: {deal.incoterm}
								</div>
								<div style={{ marginTop: 3 }}>
									📅 {tr.dealDelivery}: {deal.deliveryWindow}
								</div>
							</div>
							<div className="muted" style={{ fontSize: '.8rem', marginTop: 6 }}>
								{tr.terminalVol}: {deal.volatility} · Δ {delta >= 0 ? '+' : ''}
								{delta}%
							</div>
							<div style={{ marginTop: 8, fontWeight: 900 }}>{deal.price}</div>
							<div className="deal-actions">
								<button
									type="button"
									className="deal-chip-btn active"
									onClick={() => toggleWatchlist(deal.id)}>
									{tr.watchSaved}
								</button>
								<button
									type="button"
									className={`deal-chip-btn ${alertsEnabledIds.includes(deal.id) ? 'active' : ''}`}
									onClick={() => toggleAlert(deal.id)}>
									{alertsEnabledIds.includes(deal.id) ? tr.alertOn : tr.alertOff}
								</button>
							</div>
						</div>
					);
				})}
			</div>
		);

	return (
		<section className="section">
			<h2 style={{ marginTop: 0 }}>{tr.opsHubPageTitle}</h2>
			<p className="muted" style={{ margin: '0 0 14px', fontSize: '.9rem', lineHeight: 1.45 }}>
				{tr.opsHubIntro}
			</p>
			{user?.id && !sessionLoading ? (
				<p className="muted" style={{ margin: '-8px 0 14px', fontSize: '.82rem', lineHeight: 1.45 }}>
					{tr.opsHubCloudSyncActive}
				</p>
			) : null}

			<div className="deal-actions" style={{ margin: '0 0 14px', flexWrap: 'wrap' }}>
				<button
					type="button"
					className={`deal-chip-btn ${tab === 'workspace' ? 'active' : ''}`}
					onClick={() => setTab('workspace')}>
					{tr.opsHubTabWorkspace}
				</button>
				<button
					type="button"
					className={`deal-chip-btn ${tab === 'pins' ? 'active' : ''}`}
					onClick={() => setTab('pins')}>
					{tr.opsHubTabMarketPins}
				</button>
			</div>

			{tab === 'workspace' ? (
				<>
					<div
						style={{
							display: 'grid',
							gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
							gap: 10,
							marginBottom: 18,
						}}>
						<div className="meta-kv">
							<strong>{tr.opsStatTasks}</strong>
							<p className="muted" style={{ margin: '6px 0 0', fontSize: '.88rem' }}>
								{counts.total} · {tr.opsStatTodoShort}:{counts.todo} · {tr.opsStatDoingShort}:
								{counts.doing} · {tr.opsStatDoneShort}:{counts.done}
							</p>
						</div>
						<div className="meta-kv">
							<strong>{tr.opsStatPins}</strong>
							<p className="muted" style={{ margin: '6px 0 0', fontSize: '.88rem' }}>
								{watchedDeals.length}
							</p>
						</div>
						<div className="meta-kv">
							<strong>{tr.opsStatAlerts}</strong>
							<p className="muted" style={{ margin: '6px 0 0', fontSize: '.88rem' }}>
								{alertsEnabledIds.length}
							</p>
						</div>
						<div className="meta-kv">
							<strong>{tr.opsStatLastPin}</strong>
							<p className="muted" style={{ margin: '6px 0 0', fontSize: '.88rem' }}>
								{lastSavedDeal ? `#${lastSavedDeal.id} ${lastSavedDeal.product}` : tr.opsStatNoActivity}
							</p>
						</div>
						<div className="meta-kv">
							<strong>{tr.opsStatLastAlert}</strong>
							<p className="muted" style={{ margin: '6px 0 0', fontSize: '.88rem' }}>
								{lastAlertDeal ? `#${lastAlertDeal.id} ${lastAlertDeal.product}` : tr.opsStatNoActivity}
							</p>
						</div>
					</div>

					<div className="contact-panel" style={{ marginBottom: 18 }}>
						<h3 style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
							<ClipboardList size={18} aria-hidden />
							{tr.opsKanbanTitle}
						</h3>
						<p className="muted" style={{ margin: '0 0 12px', fontSize: '.8rem' }}>
							{tr.opsAutoPersistHint}
						</p>
						<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
							<input
								type="text"
								value={draftTitle}
								onChange={e => setDraftTitle(e.target.value)}
								onKeyDown={e => {
									if (e.key === 'Enter') addTask('todo');
								}}
								placeholder={tr.opsAddTaskPlaceholder}
								style={{
									flex: '1 1 220px',
									minWidth: 0,
									padding: '9px 11px',
									borderRadius: 8,
									border: '1px solid rgba(148,163,184,0.35)',
									background: 'rgba(15,23,42,0.35)',
									color: 'inherit',
								}}
							/>
							<button type="button" className="deal-chip-btn active" onClick={() => addTask('todo')}>
								{tr.opsAddTaskBtn}
							</button>
						</div>

						<div
							style={{
								display: 'grid',
								gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
								gap: 14,
								alignItems: 'start',
							}}>
							{cols.map(({ key, label }) => (
								<div
									key={key}
									style={{
										background: 'rgba(15,23,42,0.25)',
										border: '1px solid rgba(148,163,184,0.22)',
										borderRadius: 10,
										padding: 12,
										minHeight: 160,
									}}>
									<div
										style={{
											display: 'flex',
											justifyContent: 'space-between',
											alignItems: 'baseline',
											marginBottom: 10,
											gap: 8,
										}}>
										<strong style={{ fontSize: '.88rem' }}>{label}</strong>
										<span className="muted" style={{ fontSize: '.78rem' }}>
											{byColumn(key).length}
										</span>
									</div>
									<ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
										{byColumn(key).length === 0 ? (
											<li className="muted" style={{ fontSize: '.82rem', padding: '8px 0' }}>
												{tr.opsEmptyColumn}
											</li>
										) : (
											byColumn(key).map(task => (
												<li
													key={task.id}
													style={{
														background: 'rgba(15,23,42,0.45)',
														border: '1px solid rgba(148,163,184,0.18)',
														borderRadius: 8,
														padding: '8px 9px',
														marginBottom: 8,
														fontSize: '.86rem',
													}}>
													<div style={{ marginBottom: 6 }}>{task.title}</div>
													<div
														style={{
															display: 'flex',
															flexWrap: 'wrap',
															gap: 6,
															alignItems: 'center',
														}}>
														<select
															value={task.column}
															onChange={e =>
																setColumn(task.id, e.target.value as OpsTaskColumn)
															}
															style={{
																fontSize: '.78rem',
																padding: '4px 6px',
																borderRadius: 6,
																border: '1px solid rgba(148,163,184,0.35)',
																background: 'rgba(15,23,42,0.55)',
																color: 'inherit',
																maxWidth: '100%',
															}}
															aria-label={tr.opsColumnSelectAria}>
															<option value="todo">{tr.opsColTodo}</option>
															<option value="doing">{tr.opsColDoing}</option>
															<option value="done">{tr.opsColDone}</option>
														</select>
														<button
															type="button"
															className="deal-chip-btn"
															style={{ fontSize: '.75rem', padding: '4px 8px' }}
															onClick={() => removeTask(task.id)}>
															{tr.opsDeleteTask}
														</button>
													</div>
												</li>
											))
										)}
									</ul>
								</div>
							))}
						</div>
					</div>

					<div
						style={{
							display: 'grid',
							gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
							gap: 18,
							marginBottom: 18,
						}}>
						<div className="contact-panel">
							<h3 style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
								<StickyNote size={18} aria-hidden />
								{tr.opsNotesTitle}
							</h3>
							<p className="muted" style={{ marginTop: 0, fontSize: '.82rem' }}>
								{tr.opsNotesHint}
							</p>
							<textarea
								value={notes}
								onChange={e => commitPersisted({ notes: e.target.value.slice(0, 8000) })}
								placeholder={tr.opsNotesPlaceholder}
								rows={8}
								style={{
									width: '100%',
									boxSizing: 'border-box',
									marginTop: 8,
									padding: 10,
									borderRadius: 8,
									border: '1px solid rgba(148,163,184,0.35)',
									background: 'rgba(15,23,42,0.35)',
									color: 'inherit',
									resize: 'vertical',
									minHeight: 120,
									fontFamily: 'inherit',
									fontSize: '.88rem',
								}}
							/>
						</div>

						<div className="contact-panel">
							<h3 style={{ margin: '0 0 10px' }}>{tr.opsQuickLinksTitle}</h3>
							<p className="muted" style={{ marginTop: 0, fontSize: '.82rem', marginBottom: 12 }}>
								{tr.opsQuickLinksHint}
							</p>
							<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
								<button
									type="button"
									className="deal-chip-btn"
									style={{ justifyContent: 'flex-start', gap: 10 }}
									onClick={() => onNavigate('subsidy-calculator')}>
									<Calculator size={17} aria-hidden />
									{tr.opsLinkSubsidy}
								</button>
								<button
									type="button"
									className="deal-chip-btn"
									style={{ justifyContent: 'flex-start', gap: 10 }}
									onClick={() => onNavigate('command')}>
									<LineChart size={17} aria-hidden />
									{tr.opsLinkPlan}
								</button>
								<button
									type="button"
									className="deal-chip-btn"
									style={{ justifyContent: 'flex-start', gap: 10 }}
									onClick={() => onNavigate('season-calendar')}>
									<CalendarDays size={17} aria-hidden />
									{tr.opsLinkSeason}
								</button>
								<button
									type="button"
									className="deal-chip-btn"
									style={{ justifyContent: 'flex-start', gap: 10 }}
									onClick={() => onNavigate('crop-statistics')}>
									<BarChart3 size={17} aria-hidden />
									{tr.opsLinkCropStats}
								</button>
								<button
									type="button"
									className="deal-chip-btn"
									style={{ justifyContent: 'flex-start', gap: 10 }}
									onClick={() => onNavigate('transport-directory')}>
									<Truck size={17} aria-hidden />
									{tr.opsLinkTransport}
								</button>
								<button
									type="button"
									className="deal-chip-btn"
									style={{ justifyContent: 'flex-start', gap: 10 }}
									onClick={() => onNavigate('equipment-rental')}>
									<Wrench size={17} aria-hidden />
									{tr.opsLinkRental}
								</button>
								<button
									type="button"
									className="deal-chip-btn"
									style={{ justifyContent: 'flex-start', gap: 10 }}
									onClick={() => onNavigate('trade-documents')}>
									<FileText size={17} aria-hidden />
									{tr.opsLinkDocs}
								</button>
								<button
									type="button"
									className="deal-chip-btn"
									style={{ justifyContent: 'flex-start', gap: 10 }}
									onClick={() => onNavigate('assistant')}>
									{tr.opsLinkAssistant}
								</button>
								<button
									type="button"
									className="deal-chip-btn"
									style={{ justifyContent: 'flex-start', gap: 10 }}
									onClick={() => onNavigate('market')}>
									{tr.opsLinkMarket}
								</button>
								{!MVP_MODE && (
									<button
										type="button"
										className="deal-chip-btn"
										style={{ justifyContent: 'flex-start', gap: 10 }}
										onClick={() => onNavigate('clients')}>
										{tr.opsLinkClients}
									</button>
								)}
								<button
									type="button"
									className="deal-chip-btn"
									style={{ justifyContent: 'flex-start', gap: 10 }}
									onClick={() => onNavigate('company')}>
									{tr.opsLinkCompany}
								</button>
							</div>
						</div>
					</div>

					<p className="muted" style={{ fontSize: '.82rem', margin: 0 }}>
						{tr.opsHubStorageHint}
					</p>
				</>
			) : (
				pinsTabBody
			)}
		</section>
	);
}
