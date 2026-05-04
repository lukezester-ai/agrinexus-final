import type { EquipmentRentalCompany } from './equipment-rental-types';

export const SEED_EQUIPMENT_RENTAL_COMPANIES: EquipmentRentalCompany[] = [
	{
		id: 'equip-seed-1',
		companyName: 'AgroRent North',
		contactName: 'Dispatch desk',
		email: 'office@agrorent-north.bg',
		phone: '+359 888 101 202',
		coverage: 'Dobrich, Silistra, Varna',
		equipmentHint: 'Claas Lexion combines; 240-320 hp tractors; 6-8 m disc harrows',
		services: 'Harvest; tillage; transport to farm base',
		notes: 'Peak-season bookings are usually filled 2-3 weeks ahead.',
		createdAt: '2026-01-10T09:12:00.000Z',
	},
	{
		id: 'equip-seed-2',
		companyName: 'TrakServis Thrace',
		contactName: 'Rental coordinator',
		email: 'rent@trakservis.bg',
		phone: '+359 889 404 505',
		coverage: 'Plovdiv, Stara Zagora, Haskovo',
		equipmentHint: '150-260 hp tractors; 24-36 m sprayers; row-crop planters',
		services: 'Seeding; spraying; operator + on-site service',
		notes: 'Operator-only shifts available for single-day jobs.',
		createdAt: '2026-01-09T08:40:00.000Z',
	},
	{
		id: 'equip-seed-3',
		companyName: 'Balkan Field Machines',
		contactName: 'Operations lead',
		email: 'info@balkanfield.eu',
		phone: '+359 878 222 909',
		coverage: 'Pleven, Lovech, Veliko Tarnovo',
		equipmentHint: 'New Holland combines; telehandlers; 18-24 t trailers',
		services: 'Harvest + logistics; loading services; short-term rental',
		notes: 'Long-term lease options available by request.',
		createdAt: '2026-01-08T13:20:00.000Z',
	},
];

