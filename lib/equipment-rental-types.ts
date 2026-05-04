export type EquipmentRentalCompany = {
	id: string;
	companyName: string;
	contactName: string;
	email: string;
	phone: string;
	/** Области / региони на покритие */
	coverage: string;
	/** Кратък списък от налична техника */
	equipmentHint: string;
	/** Допълнителни услуги: оператор, сервиз, транспорт */
	services: string;
	notes: string;
	createdAt: string;
};

export type EquipmentRentalCompanyDraft = Omit<EquipmentRentalCompany, 'id' | 'createdAt'>;

