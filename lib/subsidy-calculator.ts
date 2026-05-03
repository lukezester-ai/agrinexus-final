/**
 * Ориентировъчни изчисления за директни плащания (ДФЗ / ОСП ~2025).
 * Не са официални — ставките са закръглени от публично обобщени параметри.
 */

export const ILLUSTRATIVE_EUR_BGN = 1.956;

export type FarmProductionFocus = 'grain' | 'mixed' | 'horticulture' | 'vine' | 'livestock';

export type SubsidyCalcLang = 'bg' | 'en';

export interface SubsidyCalculatorInput {
	decares: number;
	focus: FarmProductionFocus;
	organicEco: boolean;
	youngFarmer: boolean;
	dairyCows?: number;
}

export interface EstimateLine {
	label: string;
	lowBgn: number;
	highBgn: number;
}

export interface SubsidyEstimateResult {
	lines: EstimateLine[];
	totalLowBgn: number;
	totalHighBgn: number;
}

export type SubsidyCalcErrorCode = 'DECARES_MIN' | 'DECARES_MAX' | 'COWS_RANGE' | 'COWS_MAX';

const LABELS: Record<
	'bg' | 'en',
	{
		livestockCoupled: string;
		livestockNoCows: string;
		bissArea: string;
		pndpIfEligible: string;
		youngOnArea: string;
		bissPerHa: string;
		pndpFirst30: string;
		youngExtra: string;
		eco: string;
	}
> = {
	bg: {
		livestockCoupled: 'Обвързано подпомагане — млечни крави (ориентировъчно лв/година)',
		livestockNoCows:
			'Животновъдство без достатъчен брой крави за автоматична сметка — уточни в AI помощника за твоя случай',
		bissArea: 'Директни плащания върху декларирана площ (БИСС — ако кандидатстваш за площ)',
		pndpIfEligible: 'ПНДП (до 30 ха — ако отговаряш на условията)',
		youngOnArea: 'Млад фермер върху площ (до 30 ха)',
		bissPerHa: 'БИСС (директно подпомагане на хектар — ориентир)',
		pndpFirst30: 'ПНДП за първите до 30 ха',
		youngExtra: 'Допълнително за млад земеделски производител (до 30 ха)',
		eco: 'Екосхема / био ориентир (силно опростено — реалната ставка зависи от култура и методология)',
	},
	en: {
		livestockCoupled: 'Coupled support — dairy cows (approx. BGN/year)',
		livestockNoCows:
			'Livestock without enough cows for this simplified estimate — ask the AI assistant for your case',
		bissArea: 'Direct payments on declared area (BISS — if you apply for area)',
		pndpIfEligible: 'SAPS top-up on first 30 ha (if eligible)',
		youngOnArea: 'Young farmer payment on area (up to 30 ha)',
		bissPerHa: 'BISS (direct support per hectare — indicative)',
		pndpFirst30: 'SAPS-style top-up for the first 30 ha',
		youngExtra: 'Additional young-farmer payment (up to 30 ha)',
		eco: 'Eco-scheme / organic (highly simplified — real rates depend on crop and rules)',
	},
};

function eurRangeToBgn(lowEur: number, highEur: number, hectares: number): EstimateLine {
	return {
		label: '',
		lowBgn: Math.round(lowEur * hectares * ILLUSTRATIVE_EUR_BGN),
		highBgn: Math.round(highEur * hectares * ILLUSTRATIVE_EUR_BGN),
	};
}

export function validateCalculatorInput(input: SubsidyCalculatorInput): SubsidyCalcErrorCode | null {
	if (!Number.isFinite(input.decares) || input.decares < 0.5) {
		return 'DECARES_MIN';
	}
	if (input.decares > 100000) {
		return 'DECARES_MAX';
	}
	if (input.focus === 'livestock') {
		const c = input.dairyCows ?? 0;
		if (c > 0 && c < 5) {
			return 'COWS_RANGE';
		}
		if (c > 50000) return 'COWS_MAX';
	}
	return null;
}

export function estimateSubsidy(
	input: SubsidyCalculatorInput,
	lang: SubsidyCalcLang = 'bg',
): SubsidyEstimateResult {
	const L = LABELS[lang];
	const ha = input.decares / 10;
	const lines: EstimateLine[] = [];

	if (input.focus === 'livestock') {
		const cows = input.dairyCows ?? 0;
		if (cows >= 5) {
			lines.push({
				label: L.livestockCoupled,
				lowBgn: cows * 250,
				highBgn: cows * 300,
			});
		} else {
			lines.push({
				label: L.livestockNoCows,
				lowBgn: 0,
				highBgn: 0,
			});
		}
		if (ha >= 0.05) {
			const biss = eurRangeToBgn(85, 90, ha);
			biss.label = L.bissArea;
			lines.push(biss);
			const pndpHa = Math.min(ha, 30);
			const pndp = eurRangeToBgn(24, 26, pndpHa);
			pndp.label = L.pndpIfEligible;
			lines.push(pndp);
			if (input.youngFarmer) {
				const yHa = Math.min(ha, 30);
				const yf = eurRangeToBgn(50, 60, yHa);
				yf.label = L.youngOnArea;
				lines.push(yf);
			}
		}
	} else {
		const landFactor =
			input.focus === 'mixed' ? 0.92 : input.focus === 'horticulture' || input.focus === 'vine' ? 1 : 1;
		const effHa = ha * landFactor;

		const biss = eurRangeToBgn(85, 90, effHa);
		biss.label = L.bissPerHa;
		lines.push(biss);

		const pndpHa = Math.min(effHa, 30);
		const pndp = eurRangeToBgn(24, 26, pndpHa);
		pndp.label = L.pndpFirst30;
		lines.push(pndp);

		if (input.youngFarmer) {
			const yHa = Math.min(effHa, 30);
			const yf = eurRangeToBgn(50, 60, yHa);
			yf.label = L.youngExtra;
			lines.push(yf);
		}

		if (input.organicEco) {
			let lowE = 38;
			let highE = 90;
			if (input.focus === 'horticulture') {
				lowE = 80;
				highE = 220;
			}
			if (input.focus === 'vine') {
				lowE = 75;
				highE = 198;
			}
			const ecoHa = Math.min(effHa, 30);
			const eco = eurRangeToBgn(lowE, highE, ecoHa);
			eco.label = L.eco;
			lines.push(eco);
		}
	}

	let totalLow = 0;
	let totalHigh = 0;
	for (const line of lines) {
		totalLow += line.lowBgn;
		totalHigh += line.highBgn;
	}

	return { lines, totalLowBgn: totalLow, totalHighBgn: totalHigh };
}

export function formatShareSnippet(
	decares: number,
	lowBgn: number,
	highBgn: number,
	siteUrl: string,
	lang: SubsidyCalcLang = 'bg',
): string {
	const u = siteUrl.replace(/\/$/, '');
	const loc = lang === 'en' ? 'en-GB' : 'bg-BG';
	const low = lowBgn.toLocaleString(loc);
	const high = highBgn.toLocaleString(loc);
	if (lang === 'en') {
		return `AgriNexus indicative subsidy calculator: for ${decares} decares the rough range is ${low}–${high} BGN/year (non-binding). Open: ${u}`;
	}
	return `Според ориентировъчния калкулатор на AgriNexus за ${decares} декара приблизителният диапазон е ${low}–${high} лв/година (неофициално, без гаранция). Виж на: ${u}`;
}
