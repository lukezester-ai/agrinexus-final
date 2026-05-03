import type { ChatPersona } from './chat-persona';

/** Елемент от лентата „бързи подкани“ — текст по език + персона за заявката и UI чипа. */
export type AssistantQuickPromptItem = {
	id: string;
	persona: ChatPersona;
	bg: string;
	en: string;
};

export const ASSISTANT_QUICK_PROMPTS: AssistantQuickPromptItem[] = [
	{
		id: 'team-profile',
		persona: 'unified',
		bg: 'Екип (трите заедно): по моя профил — какво да подам първо, какво липсва, какъв е рискът и струва ли си схемата?',
		en: 'All three together: from my profile — what to file first, what is missing, risks, and is the scheme worth it?',
	},
	{
		id: 'lawyer-deadline',
		persona: 'lawyer',
		bg: 'Юрист: какво точно трябва и не трябва да правя до края на кампанията по единното заявление?',
		en: 'Lawyer focus: what must/must not I do before the single-application campaign deadline?',
	},
	{
		id: 'agronomist-spray',
		persona: 'agronomist',
		bg: 'Агроном: пръскам с фунгицид — какво да впиша в дневника и къде се отразява в документацията за ДФЗ?',
		en: 'Agronomist focus: I spray fungicide — what to log and how it shows in DAFS paperwork?',
	},
	{
		id: 'finance-scheme',
		persona: 'finance',
		bg: 'Финансист: при моите декари и фиксирани разходи — струва ли си конкретна схема спрямо очакваното плащане?',
		en: 'Finance focus: given my hectares and fixed costs — is this scheme worth it vs expected payment?',
	},
	{
		id: 'trade-tomatoes-uae',
		persona: 'unified',
		bg: 'Дай BUY/HOLD/AVOID за домати България → UAE.',
		en: 'Give BUY/HOLD/AVOID for tomatoes Bulgaria → UAE.',
	},
	{
		id: 'trade-ksa-certs',
		persona: 'unified',
		bg: 'Кои сертификати са критични за export към KSA?',
		en: 'Which certifications matter most for export to KSA?',
	},
	{
		id: 'trade-mena-risk',
		persona: 'unified',
		bg: 'Бърз risk-check за EU → MENA маршрут.',
		en: 'Quick risk-check for EU → MENA route.',
	},
];

export function quickPromptLabel(item: AssistantQuickPromptItem, lang: 'bg' | 'en'): string {
	return lang === 'bg' ? item.bg : item.en;
}
