/**
 * Опростен учебен модел за лабораторията — НЕ замества агроном, НЕ е калибриран към реални полета.
 * Цел: интуиция за връзка почва + време + разходи → добив и € резултат.
 */

export type CropId = "wheat" | "corn" | "sunflower" | "barley";

export type LabInputs = {
	crop: CropId;
	areaHa: number;
	/** 0–120 (условни единици на наличност) */
	soilN: number;
	soilP: number;
	soilK: number;
	/** % органична маса */
	organicMatterPct: number;
	/** pH */
	ph: number;
	/** валежи за сезона, mm */
	seasonRainMm: number;
	/** средна температура вегетация °C */
	avgTempC: number;
	/** дни с риск от сланина / стрес */
	frostRiskDays: number;
	/** €/ha */
	costSeed: number;
	costFert: number;
	costFuel: number;
	costChem: number;
	costOther: number;
	/** очаквана продажна цена €/t */
	expectedPricePerTon: number;
};

export type LabResult = {
	/** t/ha */
	estimatedYieldPerHa: number;
	/** 0–100 общ „успех на засаждането“ */
	plantingSuccessScore: number;
	verdictBg: string;
	totalCostEur: number;
	grossRevenueEur: number;
	netProfitEur: number;
	hintsBg: string[];
};

const BASE_YIELD_T_HA: Record<CropId, number> = {
	wheat: 5.2,
	corn: 9.0,
	sunflower: 2.6,
	barley: 4.8,
};

function clamp(n: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, n));
}

/** Колко близо е стойността до идеален интервал [idealLo, idealHi] → 0..1 */
function bandScore(value: number, idealLo: number, idealHi: number, span: number): number {
	const mid = (idealLo + idealHi) / 2;
	const half = (idealHi - idealLo) / 2 + span;
	const dist = Math.abs(value - mid);
	return clamp(1 - dist / half, 0.2, 1);
}

export function runLabSimulation(i: LabInputs): LabResult {
	const base = BASE_YIELD_T_HA[i.crop];

	const n = bandScore(i.soilN, 45, 85, 40);
	const p = bandScore(i.soilP, 35, 75, 40);
	const k = bandScore(i.soilK, 40, 80, 40);
	const om = bandScore(i.organicMatterPct, 2.5, 5.5, 4);
	const phs = bandScore(i.ph, 6.0, 7.2, 1.5);

	const rain = bandScore(i.seasonRainMm, 220, 480, 200);
	const temp = bandScore(i.avgTempC, 14, 24, 12);
	const frostPenalty = clamp(1 - i.frostRiskDays * 0.04, 0.35, 1);

	const soilWeather =
		(n * 0.28 + p * 0.22 + k * 0.22 + om * 0.16 + phs * 0.12) * (rain * 0.45 + temp * 0.55) * frostPenalty;

	const yieldFactor = clamp(soilWeather, 0.35, 1.12);
	const estimatedYieldPerHa = clamp(base * yieldFactor, 0.3, base * 1.15);

	const plantingSuccessScore = Math.round(clamp(soilWeather * 100, 12, 98));

	let verdictBg: string;
	if (plantingSuccessScore >= 78) verdictBg = "Силен шанс за успешно засаждане и добив близо до потенциала.";
	else if (plantingSuccessScore >= 55) verdictBg = "Умерен риск — с корекции (тор, вода, pH) може да се подобри.";
	else verdictBg = "Висок риск — комбинацията почва/време натиска добива; прегледайте инвестициите.";

	const totalCostHa =
		Math.max(0, i.costSeed) +
		Math.max(0, i.costFert) +
		Math.max(0, i.costFuel) +
		Math.max(0, i.costChem) +
		Math.max(0, i.costOther);
	const area = clamp(i.areaHa, 0.1, 5000);
	const totalCostEur = totalCostHa * area;
	const productionT = estimatedYieldPerHa * area;
	const grossRevenueEur = productionT * Math.max(0, i.expectedPricePerTon);
	const netProfitEur = grossRevenueEur - totalCostEur;

	const hintsBg: string[] = [];
	if (i.soilN < 40) hintsBg.push("Ниск азот — разгледайте азотно торене или предшественик с фиксация.");
	if (i.ph < 5.8 || i.ph > 7.8) hintsBg.push("pH извън комфортната зона — влияе на усвояването на хранителни елементи.");
	if (i.seasonRainMm < 200) hintsBg.push("По-малко валежи — иригацията става по-критична.");
	if (i.frostRiskDays > 4) hintsBg.push("Много дни със сланинов стрес — риск за поникване/цъфтеж.");
	if (netProfitEur < 0) hintsBg.push("При тези цени и разходи сметката излиза на минус — опитайте по-висока цена или по-ниски разходи по ставки/ha.");
	if (hintsBg.length === 0) hintsBg.push("Параметрите са в разумен баланс за този учебен сценарий.");

	return {
		estimatedYieldPerHa: Math.round(estimatedYieldPerHa * 10) / 10,
		plantingSuccessScore,
		verdictBg,
		totalCostEur: Math.round(totalCostEur),
		grossRevenueEur: Math.round(grossRevenueEur),
		netProfitEur: Math.round(netProfitEur),
		hintsBg,
	};
}

export const CROP_LABELS: Record<CropId, string> = {
	wheat: "Пшеница",
	corn: "Царевица",
	sunflower: "Слънчоглед",
	barley: "Ечемик",
};
