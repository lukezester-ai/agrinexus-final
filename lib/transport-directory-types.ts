export type TransportCompany = {
	id: string;
	companyName: string;
	contactName: string;
	email: string;
	phone: string;
	/** Региони / коридори, напр. „BG ↔ RO / Constanța“, „Дунавска равнина“ */
	coverage: string;
	/** Вид превоз: рефрижератор, цистерна, брезент и т.н. */
	fleetHint: string;
	notes: string;
	createdAt: string;
};

export type TransportCompanyDraft = Omit<TransportCompany, 'id' | 'createdAt'>;
