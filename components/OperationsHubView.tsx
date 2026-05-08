import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppStrings, UiLang } from '../lib/i18n';
import { useSupabaseSession } from '../hooks/use-supabase-session';
import type { OpsHubPersistedV1, OpsTask, OpsTaskColumn } from '../lib/operations-hub-types';
import { normalizePersistedBody, parseTasks } from '../lib/operations-hub-types';
import { fetchOpsHubFromSupabase, upsertOpsHubToSupabase } from '../lib/operations-hub-supabase';
import { fetchOperationsHubRemote, pushOperationsHubRemote } from '../lib/operations-hub-sync-client';
import { loadFarmerProfile } from '../lib/farmer-profile-storage';
import { getRiskFlags, line } from '../lib/command-center-data';

const BUNDLE_KEY = 'agrinexus-ops-state-v1';
const LEGACY_TASKS = 'agrinexus-ops-tasks';
const LEGACY_NOTES = 'agrinexus-ops-notes';
const DAILY_BRIEF_PREFIX = 'agrinexus-ops-daily-brief-v1';

export type OpsHubNavigate =
	| 'subsidy-calculator'
	| 'crop-statistics'
	| 'season-calendar'
	| 'command'
	| 'field-watch'
	| 'trade-documents'
	| 'food-security'
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

type FieldApiRow = {
	id: string | number;
	name: string;
	crop: string;
	area_decares: number;
};

type BriefHistoryItem = {
	title: string;
	body: string;
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

function freshSeed(lang: UiLang): OpsHubPersistedV1 {
	return {
		schemaVersion: 1,
		updatedAt: new Date().toISOString(),
		locale: lang,
		tasks: [],
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
		const migrated: OpsHubPersistedV1 = {
			schemaVersion: 1,
			updatedAt: new Date().toISOString(),
			locale: lang,
			tasks: legacyTasks,
			notes: legacyNotes.slice(0, 8000),
		};
		writeBundle(migrated);
		return migrated;
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
	const { tr, lang, watchedDeals, alertsEnabledIds, toggleWatchlist, toggleAlert, onNavigate } = props;
	const pick = (bg: string, en: string) => (lang === 'bg' ? bg : en);
	const [persisted, setPersisted] = useState<OpsHubPersistedV1>(() => loadInitialPersisted(lang));
	const [draftTask, setDraftTask] = useState('');
	const [ragQuestion, setRagQuestion] = useState('');
	const [ragAnswer, setRagAnswer] = useState('');
	const [ragLoading, setRagLoading] = useState(false);
	const [ragError, setRagError] = useState('');
	const [dailyBriefLoading, setDailyBriefLoading] = useState(false);
	const [historyExpanded, setHistoryExpanded] = useState(false);
	const notesRef = useRef<HTMLTextAreaElement | null>(null);
	const [fields, setFields] = useState<FieldApiRow[]>([]);
	const [fieldsError, setFieldsError] = useState('');
	const [farmerRiskCount, setFarmerRiskCount] = useState(0);
	const [farmerTopRisk, setFarmerTopRisk] = useState('');
	const pushDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const cloudPushDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const cloudUserIdRef = useRef<string | null>(null);
	const { user, loading: sessionLoading } = useSupabaseSession();
	cloudUserIdRef.current = user?.id ?? null;

	const schedulePush = useCallback(
		(snapshot: OpsHubPersistedV1) => {
			if (pushDebounceRef.current) clearTimeout(pushDebounceRef.current);
			pushDebounceRef.current = setTimeout(async () => {
				pushDebounceRef.current = null;
				const r = await pushOperationsHubRemote(snapshot);
				if (r.ok && 'conflict' in r && r.conflict === true) {
					writeBundle(r.state);
					setPersisted({ ...r.state, locale: lang });
				}
			}, 650);
		},
		[lang],
	);

	const scheduleCloudPush = useCallback(
		(snapshot: OpsHubPersistedV1) => {
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
		},
		[lang],
	);

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
					return merged;
				}
				return prev;
			});
		})();
		return () => {
			cancelled = true;
		};
	}, [lang, sessionLoading, user?.id]);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				setFieldsError('');
				const res = await fetch('/api/fields', { method: 'GET' });
				const data = (await res.json()) as { ok?: boolean; fields?: FieldApiRow[]; error?: string };
				if (!res.ok || data.ok !== true) throw new Error(data.error || 'Failed to load fields');
				if (!cancelled) setFields(Array.isArray(data.fields) ? data.fields : []);
			} catch (e) {
				if (!cancelled) {
					setFields([]);
					setFieldsError(e instanceof Error ? e.message : 'Failed to load fields');
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		try {
			const profile = loadFarmerProfile();
			const risks = getRiskFlags(profile);
			const critical = risks.filter(r => r.severity === 'high');
			setFarmerRiskCount(critical.length);
			setFarmerTopRisk(risks.length > 0 ? line(lang, risks[0].label) : '');
		} catch {
			setFarmerRiskCount(0);
			setFarmerTopRisk('');
		}
	}, [lang]);

	const addTask = (column: OpsTaskColumn) => {
		if (!user?.id) return;
		const title = draftTask.trim();
		if (!title) return;
		commitPersisted({ tasks: [...persisted.tasks, { id: newId(), title: title.slice(0, 280), column }] });
		setDraftTask('');
	};
	const removeTask = (id: string) => {
		if (!user?.id) return;
		commitPersisted({ tasks: persisted.tasks.filter(t => t.id !== id) });
	};
	const setColumn = (id: string, column: OpsTaskColumn) => {
		if (!user?.id) return;
		commitPersisted({ tasks: persisted.tasks.map(t => (t.id === id ? { ...t, column } : t)) });
	};
	const byColumn = (column: OpsTaskColumn) => persisted.tasks.filter(t => t.column === column);

	const askRag = async () => {
		if (!user?.id || ragLoading) return;
		const q = ragQuestion.trim();
		if (!q) return;
		setRagError('');
		setRagLoading(true);
		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					messages: [
						{
							role: 'user',
							content: `${q}\n\nOperations workspace notes:\n${persisted.notes || '(empty)'}`,
						},
					],
					locale: lang,
					persona: 'finance',
				}),
			});
			const data = (await res.json()) as { reply?: string; error?: string };
			if (!res.ok) throw new Error(data.error || 'RAG request failed');
			setRagAnswer((data.reply || '').trim());
		} catch (e) {
			setRagError(e instanceof Error ? e.message : 'RAG request failed');
		} finally {
			setRagLoading(false);
		}
	};

	const totalDecares = useMemo(
		() =>
			fields.reduce((sum, field) => {
				const n = Number(field.area_decares);
				return Number.isFinite(n) ? sum + n : sum;
			}, 0),
		[fields],
	);

	const runDailyBrief = useCallback(async () => {
		if (!user?.id || dailyBriefLoading) return;
		const today = new Date().toISOString().slice(0, 10);
		const dailyKey = `${DAILY_BRIEF_PREFIX}:${user.id}:${today}`;
		try {
			const seen = window.localStorage.getItem(dailyKey);
			if (seen === '1') return;
		} catch {
			/* ignore */
		}

		setDailyBriefLoading(true);
		try {
			const payload = {
				messages: [
					{
						role: 'user',
						content:
							lang === 'bg'
								? `Направи кратък оперативен дневен бриф за ферма в 5-7 точки: най-важни рискове, действия днес, и какво да следя утре. Контекст:\n- Полета: ${fields.length}\n- Обща площ (дка): ${totalDecares.toFixed(1)}\n- Критични профилни рискове: ${farmerRiskCount}\n- Топ риск: ${farmerTopRisk || 'няма'}\n- Активни задачи: ${persisted.tasks.length}\n- Бележки:\n${persisted.notes || '(няма)'}`
								: `Create a concise daily farm operations brief in 5-7 bullets: key risks, actions for today, and what to monitor tomorrow. Context:\n- Fields: ${fields.length}\n- Total area (decares): ${totalDecares.toFixed(1)}\n- Critical profile risks: ${farmerRiskCount}\n- Top risk: ${farmerTopRisk || 'none'}\n- Active tasks: ${persisted.tasks.length}\n- Notes:\n${persisted.notes || '(empty)'}`,
					},
				],
				locale: lang,
				persona: 'finance',
			};
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const data = (await res.json()) as { reply?: string; error?: string };
			if (!res.ok) throw new Error(data.error || 'Daily brief request failed');
			const reply = (data.reply || '').trim();
			if (!reply) return;

			setRagAnswer(reply);
			const stamp = new Date().toLocaleString();
			const heading = lang === 'bg' ? `## Дневен RAG бриф (${stamp})` : `## Daily RAG brief (${stamp})`;
			const mergedNotes = `${heading}\n${reply}\n\n${persisted.notes}`.slice(0, 8000);
			commitPersisted({ notes: mergedNotes });

			try {
				window.localStorage.setItem(dailyKey, '1');
			} catch {
				/* ignore */
			}
		} catch (e) {
			setRagError(e instanceof Error ? e.message : 'Daily brief request failed');
		} finally {
			setDailyBriefLoading(false);
		}
	}, [
		commitPersisted,
		dailyBriefLoading,
		farmerRiskCount,
		farmerTopRisk,
		fields.length,
		lang,
		persisted.notes,
		persisted.tasks.length,
		totalDecares,
		user?.id,
	]);

	useEffect(() => {
		if (!user?.id || sessionLoading) return;
		void runDailyBrief();
	}, [runDailyBrief, sessionLoading, user?.id]);

	const briefHistory = useMemo<BriefHistoryItem[]>(() => {
		const out: BriefHistoryItem[] = [];
		const lines = persisted.notes.split('\n');
		for (let i = 0; i < lines.length; i += 1) {
			const line = lines[i].trim();
			if (!line.startsWith('## ')) continue;
			const isBrief = line.includes('Дневен RAG бриф') || line.includes('Daily RAG brief');
			if (!isBrief) continue;
			const buf: string[] = [];
			for (let j = i + 1; j < lines.length; j += 1) {
				const next = lines[j];
				if (next.trim().startsWith('## ')) break;
				buf.push(next);
			}
			out.push({ title: line.replace(/^##\s+/, ''), body: buf.join('\n').trim() });
		}
		return out.slice(0, 8);
	}, [persisted.notes]);

	const openBriefInNotes = useCallback((title: string) => {
		const el = notesRef.current;
		if (!el) return;
		const needle = `## ${title}`;
		const idx = persisted.notes.indexOf(needle);
		el.focus();
		if (idx >= 0) {
			try {
				el.setSelectionRange(idx, idx + needle.length);
			} catch {
				/* ignore */
			}
		}
		el.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}, [persisted.notes]);

	const metrics = useMemo(
		() => [
			{ label: pick('Активни задачи', 'Active tasks'), value: String(persisted.tasks.length) },
			{ label: pick('Полета (API)', 'Fields (API)'), value: String(fields.length) },
			{ label: pick('Обща площ (дка)', 'Total area (decares)'), value: totalDecares > 0 ? totalDecares.toFixed(1) : '0' },
			{ label: pick('Критичен риск (профил)', 'Critical risk (profile)'), value: String(farmerRiskCount) },
			{ label: pick('Следени оферти', 'Watched deals'), value: String(watchedDeals.length) },
			{ label: pick('Активни сигнали', 'Active alerts'), value: String(alertsEnabledIds.length) },
			{
				label: pick('Последна синхронизация', 'Last sync'),
				value: persisted.updatedAt ? new Date(persisted.updatedAt).toLocaleString() : '—',
			},
		],
		[
			alertsEnabledIds.length,
			farmerRiskCount,
			fields.length,
			lang,
			persisted.tasks.length,
			persisted.updatedAt,
			totalDecares,
			watchedDeals.length,
		],
	);

	return (
		<section
			className="section"
			style={{
				color: '#1a1a18',
				background: '#f4f3ee',
				borderRadius: 18,
				padding: 16,
				border: '1px solid rgba(0,0,0,.08)',
			}}>
			<style>{`
				.ops-grid { display:grid; gap:12px; }
				.ops-kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:10px; }
				.ops-main { display:grid; grid-template-columns: 1.3fr .9fr; gap:12px; }
				.ops-kpi-card { min-height: 92px; display:flex; flex-direction:column; justify-content:center; }
				.ops-panel {
					background: #ffffff;
					border: 1px solid rgba(0,0,0,.08);
					border-radius: 12px;
					padding: 16px;
					box-shadow: 0 2px 10px rgba(0,0,0,.05);
					transition: box-shadow .18s ease, transform .18s ease, border-color .18s ease;
				}
				.ops-panel:hover {
					box-shadow: 0 8px 22px rgba(0,0,0,.08);
					border-color: rgba(0,0,0,.14);
					transform: translateY(-1px);
				}
				.ops-title {
					margin: 0 0 8px;
					font-size: 14px;
					font-weight: 700;
					color: #1a1a18;
					letter-spacing: .01em;
				}
				.ops-sub {
					color: #6b6b65;
					font-size: 12px;
					margin: 0;
					font-weight: 500;
				}
				.ops-task {
					background: #f7f7f4;
					border: 1px solid rgba(0,0,0,.07);
					border-radius: 8px;
					padding: 8px;
					transition: border-color .16s ease, background .16s ease;
				}
				.ops-task:hover {
					border-color: rgba(42,157,110,.28);
					background: #fbfbf9;
				}
				.ops-strong { color:#1a1a18; font-weight:800; letter-spacing:.01em; }
				.ops-chip-ok {
					border-radius: 999px;
					padding: 6px 10px;
					background: #e6f5ef;
					color: #1a6e4a;
					font-size: 12px;
					font-weight: 800;
					border: 1px solid rgba(42,157,110,.25);
				}
				.ops-chip-warn {
					border-radius: 999px;
					padding: 6px 10px;
					background: #fdeaea;
					color: #8a2020;
					font-size: 12px;
					font-weight: 800;
					border: 1px solid rgba(217,64,64,.25);
				}
				.section .deal-chip-btn {
					background: #ffffff;
					color: #1a1a18;
					border: 1px solid rgba(0,0,0,.12);
					font-weight: 700;
					transition: transform .14s ease, box-shadow .14s ease, background .14s ease, color .14s ease, border-color .14s ease;
				}
				.section .deal-chip-btn:hover {
					transform: translateY(-1px);
					box-shadow: 0 4px 10px rgba(0,0,0,.08);
					border-color: rgba(0,0,0,.2);
				}
				.section .deal-chip-btn.active {
					background: #2a9d6e;
					color: #ffffff;
					border-color: #2a9d6e;
				}
				.ops-panel input,
				.ops-panel textarea,
				.ops-panel select {
					background: #ffffff !important;
					color: #1a1a18 !important;
					border: 1px solid rgba(0,0,0,.15) !important;
				}
				.ops-panel input::placeholder,
				.ops-panel textarea::placeholder {
					color: #8a8a84 !important;
					opacity: 1;
				}
				.ops-panel option {
					background: #ffffff;
					color: #1a1a18;
				}
				.ops-skeleton {
					border-radius: 8px;
					background: linear-gradient(90deg, #eef1f7 25%, #f7f9fc 37%, #eef1f7 63%);
					background-size: 300% 100%;
					animation: opsShimmer 1.25s ease-in-out infinite;
				}
				.ops-skeleton-line { height: 10px; margin-bottom: 8px; }
				.ops-skeleton-line:last-child { margin-bottom: 0; }
				.ops-skeleton-line.short { width: 68%; }
				.ops-skeleton-line.medium { width: 84%; }
				.ops-skeleton-box { height: 86px; margin-top: 10px; padding: 10px; }
				@keyframes opsShimmer {
					0% { background-position: 100% 0; }
					100% { background-position: 0 0; }
				}
				.ops-grid > .ops-panel,
				.ops-main > .ops-panel {
					margin: 0;
				}
				@media (max-width: 1000px) { .ops-main { grid-template-columns:1fr; } }
				@media (max-width: 760px) {
					.ops-grid { gap: 10px; }
					.ops-kpis { grid-template-columns: 1fr 1fr; gap: 8px; }
					.ops-kpi-card { min-height: 88px; }
					.ops-panel { padding: 12px; border-radius: 10px; }
				}
				@media (max-width: 520px) {
					.ops-kpis { grid-template-columns: 1fr; }
					.ops-grid { gap: 8px; }
				}
			`}</style>

			<div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
				<div>
					<h2 style={{ margin: 0, color: '#1a1a18' }}>
						{tr.opsHubPageTitle}
					</h2>
					<p className="ops-sub">{pick('Свързан с RAG и облачно запазване за регистрирани', 'RAG-connected with cloud save for registered users')}</p>
				</div>
				<div className={user?.id ? 'ops-chip-ok' : 'ops-chip-warn'}>
					{user?.id
						? pick('Вписан: запазването е активно', 'Signed in: save is active')
						: pick('Регистрация за запазване', 'Register to save')}
				</div>
			</div>

			<div className="ops-grid" style={{ marginTop: 12 }}>
				<div className="ops-kpis">
					{metrics.map(m => (
						<div key={m.label} className="ops-panel ops-kpi-card">
							<p className="ops-sub">{m.label}</p>
							<p className="ops-strong" style={{ margin: '4px 0 0', fontSize: '1.3rem', lineHeight: 1.15 }}>
								{m.value || '—'}
							</p>
						</div>
					))}
				</div>

				<div className="ops-main">
					<div className="ops-panel">
						<h3 className="ops-title">{pick('Канбан задачи (празен старт)', 'Kanban tasks (clean start)')}</h3>
						<p className="ops-sub" style={{ marginBottom: 10 }}>
							{pick('Няма предварително попълнени стойности. Добавете реални задачи.', 'No prefilled values. Add real tasks.')}
						</p>
						<div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
							<input
								value={draftTask}
								disabled={!user?.id}
								onChange={e => setDraftTask(e.target.value)}
								onKeyDown={e => {
									if (e.key === 'Enter') addTask('todo');
								}}
								placeholder={pick('Нова задача...', 'New task...')}
								style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,.1)' }}
							/>
							<button disabled={!user?.id} onClick={() => addTask('todo')} className="deal-chip-btn">
								{pick('Добави', 'Add')}
							</button>
						</div>
						<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(120px,1fr))', gap: 8 }}>
							{(['todo', 'doing', 'done'] as OpsTaskColumn[]).map(col => (
								<div key={col} className="ops-task">
									<strong style={{ fontSize: 12 }}>
										{col === 'todo' ? tr.opsColTodo : col === 'doing' ? tr.opsColDoing : tr.opsColDone}
									</strong>
									<div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
										{byColumn(col).map(task => (
											<div key={task.id} style={{ background: '#fff', border: '1px solid rgba(0,0,0,.08)', borderRadius: 8, padding: 8 }}>
												<div style={{ fontSize: 12, marginBottom: 6 }}>{task.title}</div>
												<div style={{ display: 'flex', gap: 6 }}>
													<select
														disabled={!user?.id}
														value={task.column}
														onChange={e => setColumn(task.id, e.target.value as OpsTaskColumn)}>
														<option value="todo">{tr.opsColTodo}</option>
														<option value="doing">{tr.opsColDoing}</option>
														<option value="done">{tr.opsColDone}</option>
													</select>
													<button disabled={!user?.id} onClick={() => removeTask(task.id)}>
														{pick('Изтрий', 'Delete')}
													</button>
												</div>
											</div>
										))}
										{byColumn(col).length === 0 ? <span className="ops-sub">{pick('Празно', 'Empty')}</span> : null}
									</div>
								</div>
							))}
						</div>
					</div>

					<div className="ops-panel">
						<h3 className="ops-title">{pick('RAG асистент за операциите', 'Operations RAG assistant')}</h3>
						<p className="ops-sub" style={{ marginBottom: 8 }}>
							{pick('Въпросът минава през /api/chat и ползва RAG контекст от базата знания.', 'Question goes through /api/chat and uses RAG context from your knowledge base.')}
						</p>
						<textarea
							value={ragQuestion}
							disabled={!user?.id}
							onChange={e => setRagQuestion(e.target.value)}
							rows={4}
							placeholder={pick('Напр. Какви са рисковете и стъпките за следващите 7 дни?', 'e.g. What are key risks and steps for next 7 days?')}
							style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid rgba(0,0,0,.1)', resize: 'vertical' }}
						/>
						<div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
							<button disabled={!user?.id || ragLoading} className="deal-chip-btn active" onClick={() => void askRag()}>
								{ragLoading ? pick('Генерирам...', 'Generating...') : pick('RAG препоръка', 'RAG recommendation')}
							</button>
							<button disabled={!user?.id || dailyBriefLoading} className="deal-chip-btn" onClick={() => void runDailyBrief()}>
								{dailyBriefLoading ? pick('Правя бриф...', 'Building brief...') : pick('Дневен бриф', 'Daily brief')}
							</button>
							<button disabled={!user?.id} className="deal-chip-btn" onClick={() => onNavigate('assistant')}>
								{tr.opsLinkAssistant}
							</button>
						</div>
						{ragError ? <p style={{ color: '#b91c1c', fontSize: 12, marginTop: 8 }}>{ragError}</p> : null}
						{ragLoading ? (
							<div className="ops-skeleton ops-skeleton-box" aria-hidden>
								<div className="ops-skeleton ops-skeleton-line medium" />
								<div className="ops-skeleton ops-skeleton-line" />
								<div className="ops-skeleton ops-skeleton-line short" />
								<div className="ops-skeleton ops-skeleton-line medium" />
							</div>
						) : null}
						{ragAnswer ? (
							<div style={{ marginTop: 10, background: '#f7f7f4', color: '#1a1a18', borderRadius: 8, padding: 10, whiteSpace: 'pre-wrap', fontSize: 13, border: '1px solid rgba(0,0,0,.08)' }}>
								{ragAnswer}
							</div>
						) : null}
					</div>
				</div>

				<div className="ops-panel">
					<h3 className="ops-title">{pick('Работни бележки', 'Working notes')}</h3>
					<textarea
						ref={notesRef}
						value={persisted.notes}
						disabled={!user?.id}
						onChange={e => commitPersisted({ notes: e.target.value })}
						rows={6}
						placeholder={pick('Добавете реални оперативни данни, наблюдения и решения...', 'Add real operational notes, observations and decisions...')}
						style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid rgba(0,0,0,.1)', resize: 'vertical' }}
					/>
					<p className="ops-sub" style={{ marginTop: 8 }}>
						{user?.id
							? pick('Бележките се пазят локално, в API workspace и в облака (Supabase).', 'Notes are saved locally, in API workspace, and in cloud (Supabase).')
							: pick('Влезте в акаунт за да се активира запазване.', 'Sign in to enable saving.')}
					</p>
					{farmerTopRisk ? (
						<div style={{ marginTop: 10, background: '#fdf3e0', color: '#7a5010', borderRadius: 8, padding: 8, fontSize: 12, border: '1px solid rgba(232,160,32,.25)' }}>
							<strong>{pick('Профилен риск:', 'Profile risk:')}</strong> {farmerTopRisk}
						</div>
					) : null}
				</div>

				<div className="ops-panel">
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
						<h3 className="ops-title" style={{ margin: 0 }}>
							{pick('История на дневни брифове', 'Daily brief history')}
						</h3>
						<button
							type="button"
							className="deal-chip-btn"
							onClick={() => setHistoryExpanded(v => !v)}
							disabled={briefHistory.length === 0}>
							{historyExpanded ? pick('Скрий', 'Hide') : pick('Покажи', 'Show')}
						</button>
					</div>
					<p className="ops-sub" style={{ marginTop: 6 }}>
						{pick('Показва последните автоматично запазени RAG брифове.', 'Shows the latest auto-saved RAG briefs.')}
					</p>
					{briefHistory.length === 0 ? (
						<p className="ops-sub" style={{ marginTop: 8 }}>
							{pick('Все още няма записан бриф за история.', 'No brief has been saved in history yet.')}
						</p>
					) : historyExpanded ? (
						<div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
							{briefHistory.map(item => (
								<div key={item.title} className="ops-task">
									<strong style={{ fontSize: 12 }}>{item.title}</strong>
									<p style={{ margin: '6px 0 0', fontSize: 12, color: '#5a5a52', whiteSpace: 'pre-wrap' }}>
										{item.body.length > 280 ? `${item.body.slice(0, 280)}…` : item.body}
									</p>
									<div style={{ marginTop: 6 }}>
										<button type="button" className="deal-chip-btn" onClick={() => openBriefInNotes(item.title)}>
											{pick('Отвори в бележките', 'Open in notes')}
										</button>
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="ops-task" style={{ marginTop: 10 }}>
							<strong style={{ fontSize: 12 }}>{briefHistory[0]?.title}</strong>
							<p style={{ margin: '6px 0 0', fontSize: 12, color: '#5a5a52' }}>
								{briefHistory[0]?.body?.slice(0, 180)}
								{(briefHistory[0]?.body?.length || 0) > 180 ? '…' : ''}
							</p>
							<div style={{ marginTop: 6 }}>
								<button
									type="button"
									className="deal-chip-btn"
									onClick={() => briefHistory[0] && openBriefInNotes(briefHistory[0].title)}>
									{pick('Отвори в бележките', 'Open in notes')}
								</button>
							</div>
						</div>
					)}
				</div>

				<div className="ops-panel">
					<h3 className="ops-title">{pick('Пазарни оферти', 'Market offers')}</h3>
					{watchedDeals.length === 0 ? (
						<p className="ops-sub">{tr.opsPinsEmpty}</p>
					) : (
						<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 8 }}>
							{watchedDeals.map(deal => (
								<div key={deal.id} className="ops-task">
									<strong>{deal.product}</strong>
									<p className="ops-sub" style={{ marginTop: 4 }}>
										{deal.from} → {deal.to} · {deal.price}
									</p>
									<div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
										<button className="deal-chip-btn active" onClick={() => toggleWatchlist(deal.id)}>
											{tr.watchSaved}
										</button>
										<button className={`deal-chip-btn ${alertsEnabledIds.includes(deal.id) ? 'active' : ''}`} onClick={() => toggleAlert(deal.id)}>
											{alertsEnabledIds.includes(deal.id) ? tr.alertOn : tr.alertOff}
										</button>
									</div>
								</div>
							))}
						</div>
					)}
					{fieldsError ? <p className="ops-sub" style={{ marginTop: 8, color: '#b91c1c' }}>{fieldsError}</p> : null}
				</div>

				<div className="ops-panel">
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
						<h3 className="ops-title" style={{ margin: 0 }}>
							{pick('Field Watch връзка', 'Field Watch link')}
						</h3>
						<div style={{ display: 'flex', gap: 8 }}>
							<button type="button" className="deal-chip-btn" onClick={() => onNavigate('command')}>
								{pick('Команден център', 'Command Center')}
							</button>
							<button type="button" className="deal-chip-btn active" onClick={() => onNavigate('field-watch')}>
								{pick('Отвори Field Watch', 'Open Field Watch')}
							</button>
						</div>
					</div>
					<p className="ops-sub" style={{ marginTop: 8 }}>
						{pick('Последни полета от /api/fields:', 'Latest fields from /api/fields:')}
					</p>
					{fields.length === 0 ? (
						<p className="ops-sub" style={{ marginTop: 8 }}>
							{pick('Няма заредени полета. Добавете от Field Watch картата.', 'No fields loaded. Add from Field Watch map.')}
						</p>
					) : (
						<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 8, marginTop: 8 }}>
							{fields.slice(0, 6).map(field => (
								<div key={String(field.id)} className="ops-task">
									<strong style={{ fontSize: 12 }}>{field.name}</strong>
									<p className="ops-sub" style={{ marginTop: 4 }}>
										{pick('Култура', 'Crop')}: {field.crop}
									</p>
									<p className="ops-sub">
										{pick('Площ', 'Area')}: {Number(field.area_decares).toFixed(1)} {pick('дка', 'decares')}
									</p>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</section>
	);
}
