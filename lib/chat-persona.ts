/** Режим на екипа в AI чата — единен отговор или акцент върху една роля (винаги с кръстосани препратки). */
export type ChatPersona = 'unified' | 'lawyer' | 'agronomist' | 'finance';

export const CHAT_PERSONA_IDS: ChatPersona[] = ['unified', 'lawyer', 'agronomist', 'finance'];

export function parseChatPersona(raw: unknown): ChatPersona {
	if (raw === 'lawyer' || raw === 'agronomist' || raw === 'finance' || raw === 'unified') return raw;
	return 'unified';
}
