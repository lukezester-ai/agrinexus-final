/** Елемент от лентата „бързи въпроси“ — двуезичен текст; заявките към /api/chat са с единен режим (RAG + контекст).
 * `id` трябва да съвпада с ключовете в `lib/assistant-rag-retrieval.ts` (ragPromptId → retrieval). */
export type AssistantQuickPromptItem = {
	id: string;
	bg: string;
	en: string;
};

/** Десет стартови въпроса за млад/начинаещ фермер — подходящи за отговор с индексирани документи (RAG). */
export const ASSISTANT_QUICK_PROMPTS: AssistantQuickPromptItem[] = [
	{
		id: 'yf-cap-entry',
		bg: 'Започвам в схемите: първи стъпки в единното заявление и критични срокове за мен.',
		en: 'I am new to CAP schemes: first steps in the single application and critical deadlines for me.',
	},
	{
		id: 'yf-logs-dafs',
		bg: 'Кои регистри и дневници са задължителни спрямо ДФЗ за обработки, торове и семена?',
		en: 'Which registers and logbooks does DAFS require for sprays, fertilisers, and seed?',
	},
	{
		id: 'yf-direct-min-area',
		bg: 'Минимални площи и деклариране — как да не изгубя директни плащания като начинаещ?',
		en: 'Minimum areas and declarations — how do I avoid losing direct payments as a beginner?',
	},
	{
		id: 'yf-young-farmer',
		bg: 'Допълнение „млад фермер“: условия, документи и струва ли си за малко стопанство?',
		en: 'Young farmer payment: eligibility, paperwork, and is it worth it for a small holding?',
	},
	{
		id: 'yf-cross-compliance',
		bg: 'Кръстосано спазване: типични грешки с GAEC и санкции — как да ги избегна?',
		en: 'Cross-compliance: typical GAEC mistakes and penalties — how can I avoid them?',
	},
	{
		id: 'yf-first-year-field',
		bg: 'Първа година с нова земя: приоритети в севооборот и растителна защита.',
		en: 'First year on new land: priorities for rotation and crop protection.',
	},
	{
		id: 'yf-margin-subsidy',
		bg: 'Как да сметна марж със субсидии — кои разходи и приходи са решаващи?',
		en: 'How should I estimate margin with subsidies — which costs and revenues matter most?',
	},
	{
		id: 'yf-risk-small',
		bg: 'Климатичен и ценови риск: практични опции за малък производител в България.',
		en: 'Climate and price risk: practical options for a small producer in Bulgaria.',
	},
	{
		id: 'yf-official-sources',
		bg: 'Къде официално да следя мерки и срокове (ДФЗ, областни дирекции)?',
		en: 'Where should I officially track measures and deadlines (DAFS, regional offices)?',
	},
	{
		id: 'yf-quality-export',
		bg: 'Малък обем към пазар или износ: първи стъпки за документи и качество.',
		en: 'Small volume to market or export: first steps on paperwork and quality.',
	},
];

export function quickPromptLabel(item: AssistantQuickPromptItem, lang: 'bg' | 'en'): string {
	return lang === 'bg' ? item.bg : item.en;
}
