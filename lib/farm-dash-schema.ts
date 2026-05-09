/**
 * Локално табло Operations — типове и персистентност в браузъра (localStorage).
 */

export type FieldTileStatus = 'great' | 'good' | 'warn' | 'critical' | 'rest';

export type FieldTile = { id: number; status: FieldTileStatus };

export type FarmDashPersisted = {
	schemaVersion: 1;
	fields: FieldTile[];
	cropShares: number[];
	harvestMonthly: { wheat: number[]; maize: number[]; sunflower: number[] };
	moisture: number[];
	moistureTarget: number;
	harvestYears: { y2026: number[]; y2025: number[]; y2024: number[] };
	topFields: number[];
	harvestTrend: number[];
	weatherLat: number;
	weatherLon: number;
};

/** Начални 24 полета (демо мрежа). */
export const FARM_DASH_FIELD_SEED: FieldTile[] = [
	{ id: 1, status: 'great' },
	{ id: 2, status: 'great' },
	{ id: 3, status: 'good' },
	{ id: 4, status: 'warn' },
	{ id: 5, status: 'rest' },
	{ id: 6, status: 'great' },
	{ id: 7, status: 'warn' },
	{ id: 8, status: 'good' },
	{ id: 9, status: 'great' },
	{ id: 10, status: 'good' },
	{ id: 11, status: 'rest' },
	{ id: 12, status: 'warn' },
	{ id: 13, status: 'great' },
	{ id: 14, status: 'good' },
	{ id: 15, status: 'great' },
	{ id: 16, status: 'good' },
	{ id: 17, status: 'critical' },
	{ id: 18, status: 'great' },
	{ id: 19, status: 'critical' },
	{ id: 20, status: 'good' },
	{ id: 21, status: 'great' },
	{ id: 22, status: 'good' },
	{ id: 23, status: 'warn' },
	{ id: 24, status: 'great' },
];

export const FARM_DASH_STORAGE_KEY = 'agrinexus-farm-dash-v1';

function clampNum(v: unknown, fallback: number): number {
	const n = typeof v === 'number' ? v : Number(v);
	return Number.isFinite(n) ? n : fallback;
}

function normalizeLen7(raw: unknown, fallback: number[]): number[] {
	const a = Array.isArray(raw) ? raw.map(x => clampNum(x, NaN)).filter(Number.isFinite) : [];
	const out = [...fallback];
	for (let i = 0; i < 7; i += 1) {
		if (typeof a[i] === 'number' && Number.isFinite(a[i])) out[i] = a[i] as number;
	}
	return out;
}

function normalizeLen4(raw: unknown, fallback: number[]): number[] {
	const a = Array.isArray(raw) ? raw.map(x => clampNum(x, NaN)).filter(Number.isFinite) : [];
	const out = [...fallback];
	for (let i = 0; i < 4; i += 1) {
		if (typeof a[i] === 'number' && Number.isFinite(a[i])) out[i] = a[i] as number;
	}
	return out;
}

function normalizeLen5(raw: unknown, fallback: number[]): number[] {
	const a = Array.isArray(raw) ? raw.map(x => clampNum(x, NaN)).filter(Number.isFinite) : [];
	const out = [...fallback];
	for (let i = 0; i < 5; i += 1) {
		if (typeof a[i] === 'number' && Number.isFinite(a[i])) out[i] = a[i] as number;
	}
	return out;
}

export function defaultFarmDash(): FarmDashPersisted {
	return {
		schemaVersion: 1,
		fields: FARM_DASH_FIELD_SEED.map(f => ({ ...f })),
		cropShares: [38, 32, 20, 10],
		harvestMonthly: {
			wheat: [120, 280, 410, 520, 390, 180, 60],
			maize: [60, 140, 220, 380, 520, 430, 200],
			sunflower: [0, 80, 160, 290, 440, 380, 120],
		},
		moisture: [72, 70, 68, 65, 63, 67, 67],
		moistureTarget: 72,
		harvestYears: {
			y2026: [1960, 1540, 964, 356],
			y2025: [1815, 1340, 868, 310],
			y2024: [1650, 1200, 790, 280],
		},
		topFields: [420, 380, 340, 310, 290],
		harvestTrend: [180, 500, 790, 1190, 1350, 990, 380],
		weatherLat: 42.6977,
		weatherLon: 23.3219,
	};
}

export function parseFarmDash(raw: unknown): FarmDashPersisted {
	const d = defaultFarmDash();
	if (!raw || typeof raw !== 'object') return d;
	const o = raw as Record<string, unknown>;
	if (o.schemaVersion !== 1) return d;

	if (Array.isArray(o.fields) && o.fields.length >= FARM_DASH_FIELD_SEED.length) {
		const next: FieldTile[] = [];
		for (let i = 0; i < FARM_DASH_FIELD_SEED.length; i += 1) {
			const row = o.fields[i];
			const baseId = FARM_DASH_FIELD_SEED[i].id;
			if (row && typeof row === 'object' && 'status' in row) {
				const st = String((row as { status: string }).status);
				if (st === 'great' || st === 'good' || st === 'warn' || st === 'critical' || st === 'rest') {
					next.push({ id: baseId, status: st });
					continue;
				}
			}
			next.push({ ...FARM_DASH_FIELD_SEED[i] });
		}
		d.fields = next;
	}

	d.cropShares = normalizeLen4(o.cropShares, d.cropShares);

	if (o.harvestMonthly && typeof o.harvestMonthly === 'object') {
		const hm = o.harvestMonthly as Record<string, unknown>;
		d.harvestMonthly = {
			wheat: normalizeLen7(hm.wheat, d.harvestMonthly.wheat),
			maize: normalizeLen7(hm.maize, d.harvestMonthly.maize),
			sunflower: normalizeLen7(hm.sunflower, d.harvestMonthly.sunflower),
		};
	}

	d.moisture = normalizeLen7(o.moisture, d.moisture);
	d.moistureTarget = clampNum(o.moistureTarget, d.moistureTarget);

	if (o.harvestYears && typeof o.harvestYears === 'object') {
		const hy = o.harvestYears as Record<string, unknown>;
		d.harvestYears = {
			y2026: normalizeLen4(hy.y2026, d.harvestYears.y2026),
			y2025: normalizeLen4(hy.y2025, d.harvestYears.y2025),
			y2024: normalizeLen4(hy.y2024, d.harvestYears.y2024),
		};
	}

	d.topFields = normalizeLen5(o.topFields, d.topFields);
	d.harvestTrend = normalizeLen7(o.harvestTrend, d.harvestTrend);

	const lat = clampNum(o.weatherLat, d.weatherLat);
	const lon = clampNum(o.weatherLon, d.weatherLon);
	d.weatherLat = lat >= -90 && lat <= 90 ? lat : d.weatherLat;
	d.weatherLon = lon >= -180 && lon <= 180 ? lon : d.weatherLon;

	return d;
}

export function loadFarmDash(): FarmDashPersisted {
	try {
		const raw = localStorage.getItem(FARM_DASH_STORAGE_KEY);
		if (!raw) return defaultFarmDash();
		return parseFarmDash(JSON.parse(raw) as unknown);
	} catch {
		return defaultFarmDash();
	}
}
