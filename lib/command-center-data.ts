/**
 * Ориентировъчни срокове и правила за „командния център“.
 * Реална продукция: синхронизация с официални обявления на ДФЗ / ИСУН (API или импорт).
 */

export type LocalizedLine = { bg: string; en: string };

export type CommandDeadline = {
	id: string;
	dateISO: string;
	scheme: LocalizedLine;
	action: LocalizedLine;
	/** Публичен източник за ръчна проверка */
	sourceNote: LocalizedLine;
};

/** Кампания 2026 — датите следват публично обсъжданите прозорци (ориентир, не правно обвързващи). */
export const COMMAND_DEADLINES: CommandDeadline[] = [
	{
		id: 'unified-may15',
		dateISO: '2026-05-15',
		scheme: {
			bg: 'Единно заявление — директни плащания и мерки (ИСУН)',
			en: 'Single application — direct payments and measures (ISUN)',
		},
		action: {
			bg: 'Подай или актуализирай заявлението до тази дата (без намаление за закъснение).',
			en: 'Submit or update your application by this date (standard window).',
		},
		sourceNote: {
			bg: 'Провери актуалната заповед и приложенията на www.dfz.bg за текущата кампания.',
			en: 'Verify the current DAFS order and annexes on the official portal for the active campaign.',
		},
	},
	{
		id: 'late-jun9',
		dateISO: '2026-06-09',
		scheme: {
			bg: 'Късно подаване с намаление',
			en: 'Late submission with reduction',
		},
		action: {
			bg: 'Последен ден за подаване с намаление на плащанията (ориентир).',
			en: 'Last day for late filing with payment reduction (indicative).',
		},
		sourceNote: {
			bg: 'Сроковете се променят по заповед — не разчитай само на този екран.',
			en: 'Deadlines change by order — do not rely on this screen alone.',
		},
	},
	{
		id: 'advance-oct',
		dateISO: '2026-10-01',
		scheme: {
			bg: 'Есенни авансови плащания (ако са обявени)',
			en: 'Autumn advance payments (if announced)',
		},
		action: {
			bg: 'Следи обявление за аванс — подготви липсващите документи предварително.',
			en: 'Watch for the advance notice — prepare missing documents early.',
		},
		sourceNote: {
			bg: 'ДФЗ публикува графика на авансовете по кампания.',
			en: 'DAFS publishes the advance schedule per campaign.',
		},
	},
];

function pick<T extends LocalizedLine>(line: T, lang: 'bg' | 'en'): string {
	if (lang === 'en') return line.en;
	return line.bg;
}

export function getActiveDeadlines(now = new Date()): CommandDeadline[] {
	const t = now.getTime();
	return [...COMMAND_DEADLINES].filter(d => {
		const end = new Date(d.dateISO + 'T23:59:59').getTime();
		return end >= t - 86400000 * 2;
	});
}

export function formatDeadlineHeadline(d: CommandDeadline, lang: 'bg' | 'en'): string {
	const date = new Date(d.dateISO);
	const loc = lang === 'en' ? 'en-GB' : 'bg-BG';
	const when = date.toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' });
	if (lang === 'bg') return `До ${when}: ${pick(d.scheme, lang)}`;
	return `By ${when}: ${pick(d.scheme, lang)}`;
}

export function line(lang: 'bg' | 'en', L: LocalizedLine): string {
	return pick(L, lang);
}
