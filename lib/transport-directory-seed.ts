import type { TransportCompany } from './transport-directory-types';

/** Демо записи — винаги видими за всички потребители */
export const SEED_TRANSPORT_COMPANIES: TransportCompany[] = [
	{
		id: 'seed-danube-logistics',
		companyName: 'Danube Corridor Logistics EOOD',
		contactName: 'Hristo Dimitrov',
		email: 'ops@danube-corridor.example.eu',
		phone: '+359888000111',
		coverage: 'BG ↔ RO / Constanța; Danube ports; Northern Bulgaria',
		fleetHint: 'Tautliner, refrigerated',
		notes: 'Grain & packaged foods — weekly departures from Ruse.',
		createdAt: '2025-03-01T10:00:00.000Z',
	},
	{
		id: 'seed-thracian-cold',
		companyName: 'Thracian Cold Chain Ltd',
		contactName: 'Maria Petrova',
		email: 'dispatch@thraki-cold.example.eu',
		phone: '+359877222333',
		coverage: 'Plovdiv — Sofia — Thessaloniki; Black Sea coast',
		fleetHint: 'Refrigerated, ATP-certified',
		notes: 'Fresh produce & dairy — GPS tracking.',
		createdAt: '2025-03-15T08:00:00.000Z',
	},
	{
		id: 'seed-mena-bridge',
		companyName: 'MENA Bridge Transport',
		contactName: 'Ahmed K.',
		email: 'cargo@mena-bridge.example.eu',
		phone: '+359899444555',
		coverage: 'BG ↔ TR — UAE corridors; Kapitan Andreevo border',
		fleetHint: 'Standard tilt, ADR upon request',
		notes: 'Customs-support partnerships at major border crossing.',
		createdAt: '2025-04-01T12:00:00.000Z',
	},
	{
		id: 'seed-black-sea-bulk',
		companyName: 'Black Sea Bulk Haulers',
		contactName: 'Georgi Stoyanov',
		email: 'chartering@bsbulk.example.eu',
		phone: '+359888666777',
		coverage: 'Varna — Burgas — interior silos; export to ports',
		fleetHint: 'Walking floor, tipper, bulk food-grade',
		notes: 'Oilseeds & cereals to port terminals.',
		createdAt: '2025-04-20T09:30:00.000Z',
	},
];
