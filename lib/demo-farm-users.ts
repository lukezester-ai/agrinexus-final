export type DemoFarmUser = {
	email: string;
	password: string;
	name: string;
	farm: string;
	hectares: number;
};

export const DEMO_FARM_USERS: DemoFarmUser[] = [
	{
		email: 'fermer@demo.bg',
		password: 'agri2025',
		name: 'Иван Петров',
		farm: 'Стопанство Добруджа',
		hectares: 340,
	},
	{
		email: 'test@test.bg',
		password: 'test123',
		name: 'Мария Стоева',
		farm: 'Кооперация Балкан',
		hectares: 850,
	},
];

export function findDemoFarmUser(email: string, password: string): DemoFarmUser | null {
	const e = email.trim().toLowerCase();
	return (
		DEMO_FARM_USERS.find(u => u.email.toLowerCase() === e && u.password === password) ?? null
	);
}

export const DEMO_FARM_USER_STORAGE_KEY = 'agrinexus-demo-farm-user';
