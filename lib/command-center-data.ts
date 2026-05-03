/**
 * Ориентировъчни срокове и правила за „командния център“.
 * Реална продукция: синхронизация с официални обявления на ДФЗ / ИСУН (API или импорт).
 */

import type { FarmerLocalProfile } from './farmer-profile-storage';

export type LocalizedLine = { bg: string; en: string; ar: string };

export type CommandDeadline = {
	id: string;
	dateISO: string;
	scheme: LocalizedLine;
	action: LocalizedLine;
	/** Публичен източник за ръчна проверка */
	sourceNote: LocalizedLine;
};

export type CommandMissingDoc = {
	id: string;
	label: LocalizedLine;
	hint: LocalizedLine;
};

export type CommandRisk = {
	id: string;
	severity: 'high' | 'medium';
	label: LocalizedLine;
};

/** Кампания 2026 — датите следват публично обсъжданите прозорци (ориентир, не правно обвързващи). */
export const COMMAND_DEADLINES: CommandDeadline[] = [
	{
		id: 'unified-may15',
		dateISO: '2026-05-15',
		scheme: {
			bg: 'Единно заявление — директни плащания и мерки (ИСУН)',
			en: 'Single application — direct payments and measures (ISUN)',
			ar: 'طلب موحّد — المدفوعات المباشرة والإجراءات (ISUN)',
		},
		action: {
			bg: 'Подай или актуализирай заявлението до тази дата (без намаление за закъснение).',
			en: 'Submit or update your application by this date (standard window).',
			ar: 'قدّم أو حدّث طلبك قبل هذا التاريخ (النافذة العادية).',
		},
		sourceNote: {
			bg: 'Провери актуалната заповед и приложенията на www.dfz.bg за текущата кампания.',
			en: 'Verify the current DAFS order and annexes on the official portal for the active campaign.',
			ar: 'تحقق من أمر الوكالة الحالي والملاحق على البوابة الرسمية.',
		},
	},
	{
		id: 'late-jun9',
		dateISO: '2026-06-09',
		scheme: {
			bg: 'Късно подаване с намаление',
			en: 'Late submission with reduction',
			ar: 'تقديم متأخر مع تخفيض',
		},
		action: {
			bg: 'Последен ден за подаване с намаление на плащанията (ориентир).',
			en: 'Last day for late filing with payment reduction (indicative).',
			ar: 'آخر يوم للتقديم المتأخر مع خصم (إرشادي).',
		},
		sourceNote: {
			bg: 'Сроковете се променят по заповед — не разчитай само на този екран.',
			en: 'Deadlines change by order — do not rely on this screen alone.',
			ar: 'تتغير المواعيد بقرار — لا تعتمد على هذه الشاشة وحدها.',
		},
	},
	{
		id: 'advance-oct',
		dateISO: '2026-10-01',
		scheme: {
			bg: 'Есенни авансови плащания (ако са обявени)',
			en: 'Autumn advance payments (if announced)',
			ar: 'دفعات مقدّمة خريفية (إن أُعلنت)',
		},
		action: {
			bg: 'Следи обявление за аванс — подготви липсващите документи предварително.',
			en: 'Watch for the advance notice — prepare missing documents early.',
			ar: 'راقب إشعار الدفعة المقدّمة — جهّز الوثائق الناقصة مبكراً.',
		},
		sourceNote: {
			bg: 'ДФЗ публикува графика на авансовете по кампания.',
			en: 'DAFS publishes the advance schedule per campaign.',
			ar: 'تنشر الوكالة جدول الدفعات المقدّمة لكل حملة.',
		},
	},
];

function pick<T extends LocalizedLine>(line: T, lang: 'bg' | 'en' | 'ar'): string {
	if (lang === 'en') return line.en;
	if (lang === 'ar') return line.ar;
	return line.bg;
}

export function getActiveDeadlines(now = new Date()): CommandDeadline[] {
	const t = now.getTime();
	return [...COMMAND_DEADLINES].filter(d => {
		const end = new Date(d.dateISO + 'T23:59:59').getTime();
		return end >= t - 86400000 * 2;
	});
}

export function formatDeadlineHeadline(d: CommandDeadline, lang: 'bg' | 'en' | 'ar'): string {
	const date = new Date(d.dateISO);
	const loc = lang === 'ar' ? 'ar-BG' : lang === 'en' ? 'en-GB' : 'bg-BG';
	const when = date.toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' });
	if (lang === 'bg') return `До ${when}: ${pick(d.scheme, lang)}`;
	if (lang === 'en') return `By ${when}: ${pick(d.scheme, lang)}`;
	return `بحلول ${when}: ${pick(d.scheme, lang)}`;
}

export function getMissingDocuments(profile: FarmerLocalProfile): CommandMissingDoc[] {
	const out: CommandMissingDoc[] = [];
	const dec = Number(String(profile.decares).replace(',', '.'));
	const hasArea = Number.isFinite(dec) && dec > 0;

	if (hasArea && !profile.hasLandRightsDoc) {
		out.push({
			id: 'land',
			label: {
				bg: 'Липсва ти документ за право на ползване на земята (договор наем / аренда / документ за собственост).',
				en: 'You are missing land use / tenure proof (lease, rental contract, or ownership document).',
				ar: 'تفتقد وثيقة إثبات استخدام الأرض (إيجار أو عقد أو ملكية).',
			},
			hint: {
				bg: 'Без него рискуваш отказ или санкция при кръстосъответствие.',
				en: 'Without it you risk refusal or penalties in cross-compliance checks.',
				ar: 'بدونها قد يُرفض الطلب أو تُفرض عقوبات.',
			},
		});
	}

	if (hasArea && !profile.hasBankAccountVerified) {
		out.push({
			id: 'bank',
			label: {
				bg: 'Липсва потвърждение за банкова сметка за плащания от ДФЗ.',
				en: 'Missing confirmation of the bank account for DAFS payments.',
				ar: 'يفتقد تأكيد الحساب البنكي لدفعات الوكالة.',
			},
			hint: {
				bg: 'Провери ИСУН и банката за актуален IBAN.',
				en: 'Check ISUN and your bank for the correct IBAN.',
				ar: 'تحقق من النظام والبنك لصحة الـ IBAN.',
			},
		});
	}

	if (profile.declaresOrganic && !profile.hasOrganicCertificate) {
		out.push({
			id: 'organic-cert',
			label: {
				bg: 'Липсва валиден био сертификат при декларирана екосхема / био.',
				en: 'Valid organic certificate is missing while organic / eco-scheme is declared.',
				ar: 'شهادة عضوية صالحة مفقودة رغم الإقرار بالزراعة العضوية.',
			},
			hint: {
				bg: 'Това е висок риск от санкция и отказано плащане.',
				en: 'High risk of sanctions and denied payments.',
				ar: 'خطر عالٍ من العقوبات ورفض الدفع.',
			},
		});
	}

	if (!profile.uin.trim()) {
		out.push({
			id: 'uin',
			label: {
				bg: 'Липсва ЕГН / ЕИК в профила — нужен е за автоматично попълване на документи.',
				en: 'Personal or company ID missing in profile — required for document autofill.',
				ar: 'معرّف شخصي أو شركة مفقود في الملف — مطلوب للتعبئة التلقائية.',
			},
			hint: {
				bg: 'Попълни полето по-долу.',
				en: 'Fill in the field below.',
				ar: 'عبئ الحقل أدناه.',
			},
		});
	}

	return out;
}

export function getRiskFlags(profile: FarmerLocalProfile): CommandRisk[] {
	const risks: CommandRisk[] = [];
	const dec = Number(String(profile.decares).replace(',', '.'));
	const hasArea = Number.isFinite(dec) && dec > 0;

	if (profile.declaresOrganic && !profile.hasOrganicCertificate) {
		risks.push({
			id: 'organic-sanction',
			severity: 'high',
			label: {
				bg: 'Имаш риск от санкция при проверка: декларирано био без валиден сертификат.',
				en: 'Sanction risk on inspection: organic declared without a valid certificate.',
				ar: 'خطر عقوبات عند التفتيش: عضوي مُقرّ بدون شهادة صالحة.',
			},
		});
	}

	if (hasArea && !profile.hasLandRightsDoc) {
		risks.push({
			id: 'land-gap',
			severity: 'high',
			label: {
				bg: 'Имаш риск от несъответствие на площите без документ за ползване.',
				en: 'Risk of area mismatch without land use documentation.',
				ar: 'خطر عدم تطابق المساحة دون وثائق استخدام الأرض.',
			},
		});
	}

	if (hasArea && dec > 5000) {
		risks.push({
			id: 'area-sanity',
			severity: 'medium',
			label: {
				bg: 'Провери декларираните декари — необичайно голяма стойност за тестов профил.',
				en: 'Verify declared decares — unusually large value for a test profile.',
				ar: 'تحقق من الديكارات المعلنة — قيمة كبيرة غير عادية.',
			},
		});
	}

	if (risks.length === 0 && hasArea && profile.hasLandRightsDoc && profile.hasBankAccountVerified) {
		risks.push({
			id: 'ok-continue',
			severity: 'medium',
			label: {
				bg: 'Няма автоматично открити критични рискове по тези полета — потвърди със специалист преди подаване.',
				en: 'No critical risks auto-detected from these fields — confirm with an adviser before filing.',
				ar: 'لا مخاطر حرجة مكتشفة تلقائياً — أكد مع مستشار قبل التقديم.',
			},
		});
	}

	if (risks.length === 0) {
		risks.push({
			id: 'profile-incomplete',
			severity: 'medium',
			label: {
				bg: 'Попълни профила и площите — без това не можем да оценим реални рискове и липсващи документи.',
				en: 'Complete your profile and area — without it we cannot assess real risks or missing documents.',
				ar: 'أكمل الملف والمساحة — بدون ذلك لا يمكن تقييم المخاطر أو النواقص.',
			},
		});
	}

	return risks;
}

export function line(lang: 'bg' | 'en' | 'ar', L: LocalizedLine): string {
	return pick(L, lang);
}
