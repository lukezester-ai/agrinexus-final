import type { ChatPersona } from './chat-persona';

/** Линк към статичен PDF в `public/docs/cert-bio/`. */
export type CertBioPersonaDoc = {
	href: string;
	bg: string;
	en: string;
};

/**
 * Разпределение по персона (заглавия / смисъл):
 * - Юрист: норми, правила за сертификация, декларации, митница, всички заявления Ф-7.2.
 * - Агроном: дневници на операции, ОПП по дейност, описание на обекти.
 * - Финансист: указания и планове ЗВПП, ръководство ДП (субсидии / плащания).
 */
const LAWYER: CertBioPersonaDoc[] = [
	{ href: '/docs/cert-bio/01-regulamenti/COMMISSION_IMPLEMENTING_REGULATION_2021_1165_bg.pdf', bg: 'Регламент (ЕС) 2021/1165 — био етикетиране', en: 'EU 2021/1165 — organic labelling' },
	{ href: '/docs/cert-bio/01-regulamenti/naredba__9_ot_2023.pdf', bg: 'Наредба №9 от 2023 г.', en: 'Ordinance No. 9 of 2023' },
	{ href: '/docs/cert-bio/01-regulamenti/npdbp_20-02-2025.pdf', bg: 'НПДБП (национална програма)', en: 'National programme (NPDBP)' },
	{ href: '/docs/cert-bio/02-pravila-politiki/Certification_Rules.pdf', bg: 'Правила за сертификация', en: 'Certification rules' },
	{ href: '/docs/cert-bio/02-pravila-politiki/quality-policy.pdf', bg: 'Политика за качество', en: 'Quality policy' },
	{
		href: '/docs/cert-bio/02-pravila-politiki/Ф-4.1.3-01-в4.6-Правила-за-сертификация-био_03.11.2025.pdf',
		bg: 'Ф-4.1.3 — правила за сертификация „био“',
	en: 'Form 4.1.3 — organic certification rules',
	},
	{
		href: '/docs/cert-bio/03-zayavleniya/1_Ф-7.2-04-в.-3.6-Заявка-за-сертификация-дейност-растениевъдство_04.02.2025.pdf',
		bg: 'Заявка — сертификация растениевъдство',
	en: 'Application — crop production certification',
	},
	{ href: '/docs/cert-bio/03-zayavleniya/F7.2-09_v3.5_Заявление_Пчеларство-14.06.2024.pdf', bg: 'Заявление — пчеларство', en: 'Application — beekeeping' },
	{
		href: '/docs/cert-bio/03-zayavleniya/1_Ф-7.2-07-в.3.6-Заявление-дейност-Търговия_14.06.2024-1.pdf',
		bg: 'Заявление — търговия',
	en: 'Application — trade',
	},
	{
		href: '/docs/cert-bio/03-zayavleniya/1_Ф-7.2-05-в.-3.6-Заявление-дейност-Раст.-и-Животн._04.02.2025.pdf',
		bg: 'Заявление — растително и животновъдство',
	en: 'Application — crops & livestock',
	},
	{
		href: '/docs/cert-bio/03-zayavleniya/1_Ф-7.2-05-в.-3.6-Заявление-дейност-Раст.-и-Животн._04.02.2025@.pdf',
		bg: 'Заявление — растително и животновъдство (вариант)',
	en: 'Application — crops & livestock (alt.)',
	},
	{
		href: '/docs/cert-bio/03-zayavleniya/F7.2-08_v3.5_Заявление_Събиране-на-диворастящи_14.06.2024-1.pdf',
		bg: 'Заявление — диворастящи',
	en: 'Application — wild collection',
	},
	{
		href: '/docs/cert-bio/03-zayavleniya/Ф-7.2-06-в.3.5-Заявление-дейност-Преработвател_14.06.2024.pdf',
		bg: 'Заявление — преработвател',
	en: 'Application — processing',
	},
	{ href: '/docs/cert-bio/04-deklaratsii/Declaration_certification-Production.pdf', bg: 'Декларация — производство', en: 'Declaration — production' },
	{ href: '/docs/cert-bio/04-deklaratsii/Declaration_Certification-Trade.pdf', bg: 'Декларация — търговия', en: 'Declaration — trade' },
	{ href: '/docs/cert-bio/04-deklaratsii/Declaration_Certification-Processing.pdf', bg: 'Декларация — преработка', en: 'Declaration — processing' },
	{ href: '/docs/cert-bio/07-mitnitsa-vnos/EORI_blanka.pdf', bg: 'EORI — бланка', en: 'EORI — blank form' },
	{ href: '/docs/cert-bio/07-mitnitsa-vnos/Obrazec-palnom-2026.pdf', bg: 'Образец пълномощно (2026)', en: 'Power of attorney template (2026)' },
];

const AGRONOMIST: CertBioPersonaDoc[] = [
	{ href: '/docs/cert-bio/05-dnevnitsi/Diary_performed_cleaning_disinfection_activities.pdf', bg: 'Дневник — почистване и дезинфекция', en: 'Diary — cleaning & disinfection' },
	{ href: '/docs/cert-bio/05-dnevnitsi/Diary_produced_sold_bee_products.pdf', bg: 'Дневник — пчелни продукти', en: 'Diary — bee products' },
	{
		href: '/docs/cert-bio/05-dnevnitsi/Diary_produced_realized_products-Plant_production.pdf',
		bg: 'Дневник — растително производство',
	en: 'Diary — plant production',
	},
	{ href: '/docs/cert-bio/06-opp/OPP_Plant_Production.pdf', bg: 'ОПП — растително производство', en: 'OPP — plant production' },
	{ href: '/docs/cert-bio/06-opp/OPP-Animal_Production.pdf', bg: 'ОПП — животновъдство', en: 'OPP — animal production' },
	{ href: '/docs/cert-bio/06-opp/OPP-Beekeeping.pdf', bg: 'ОПП — пчеларство', en: 'OPP — beekeeping' },
	{ href: '/docs/cert-bio/06-opp/OPP-Wild_Plant_Collection.pdf', bg: 'ОПП — диворастящи', en: 'OPP — wild plants' },
	{ href: '/docs/cert-bio/09-proizvodstvo-obekti/Production_facilities.pdf', bg: 'Производствени обекти', en: 'Production facilities' },
];

const FINANCE: CertBioPersonaDoc[] = [
	{ href: '/docs/cert-bio/08-nastavleniya/Ukazania_plan_ZVPP3.pdf', bg: 'Указания — план ЗВПП (3)', en: 'Guidance — ZVPP plan (3)' },
	{ href: '/docs/cert-bio/08-nastavleniya/Ukazania_plan_ZVPP.pdf', bg: 'Указания — план ЗВПП', en: 'Guidance — ZVPP plan' },
	{ href: '/docs/cert-bio/08-nastavleniya/guide_dp_2026_2026_03_11_05.pdf', bg: 'Ръководство ДП (2026)', en: 'DP guide (2026)' },
];

export function certBioDocsForPersona(persona: ChatPersona): CertBioPersonaDoc[] | null {
	if (persona === 'lawyer') return LAWYER;
	if (persona === 'agronomist') return AGRONOMIST;
	if (persona === 'finance') return FINANCE;
	return null;
}
