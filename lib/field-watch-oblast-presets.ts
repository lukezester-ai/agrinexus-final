/**
 * Oblast administrative centres used by Field Watch + weather presets.
 * Coordinates align with `public/agrinexus-field-watch.html` OBLAST_CITIES (lon/lat → lat/lon here).
 */

export type OblastCityPreset = {
	id: string;
	bg: string;
	en: string;
	lat: number;
	lon: number;
};

export const FIELD_WATCH_OBLAST_PRESETS: OblastCityPreset[] = [
	{ id: 'blagoevgrad', bg: 'Благоевград', en: 'Blagoevgrad', lat: 42.0209, lon: 23.1005 },
	{ id: 'burgas', bg: 'Бургас', en: 'Burgas', lat: 42.5048, lon: 27.4678 },
	{ id: 'varna', bg: 'Варна', en: 'Varna', lat: 43.2141, lon: 27.9147 },
	{ id: 'veliko-tarnovo', bg: 'Велико Търново', en: 'Veliko Tarnovo', lat: 43.0757, lon: 25.6172 },
	{ id: 'vidin', bg: 'Видин', en: 'Vidin', lat: 43.9962, lon: 22.8829 },
	{ id: 'vratsa', bg: 'Враца', en: 'Vratsa', lat: 43.2102, lon: 23.5528 },
	{ id: 'gabrovo', bg: 'Габрово', en: 'Gabrovo', lat: 42.8747, lon: 25.3239 },
	{ id: 'dobrich', bg: 'Добрич', en: 'Dobrich', lat: 43.5726, lon: 27.8273 },
	{ id: 'kardzhali', bg: 'Кърджали', en: 'Kardzhali', lat: 41.65, lon: 25.3669 },
	{ id: 'kyustendil', bg: 'Кюстендил', en: 'Kyustendil', lat: 42.2839, lon: 22.6911 },
	{ id: 'lovech', bg: 'Ловеч', en: 'Lovech', lat: 43.1368, lon: 24.7159 },
	{ id: 'montana', bg: 'Монтана', en: 'Montana', lat: 43.4083, lon: 23.225 },
	{ id: 'pazardzhik', bg: 'Пазарджик', en: 'Pazardzhik', lat: 42.1928, lon: 24.3336 },
	{ id: 'pernik', bg: 'Перник', en: 'Pernik', lat: 42.605, lon: 23.0378 },
	{ id: 'pleven', bg: 'Плевен', en: 'Pleven', lat: 43.417, lon: 24.6067 },
	{ id: 'plovdiv', bg: 'Пловдив', en: 'Plovdiv', lat: 42.1354, lon: 24.7453 },
	{ id: 'razgrad', bg: 'Разград', en: 'Razgrad', lat: 43.5333, lon: 26.5379 },
	{ id: 'ruse', bg: 'Русе', en: 'Ruse', lat: 43.8356, lon: 25.9547 },
	{ id: 'silistra', bg: 'Силистра', en: 'Silistra', lat: 44.1171, lon: 27.2606 },
	{ id: 'sliven', bg: 'Сливен', en: 'Sliven', lat: 42.6818, lon: 26.3242 },
	{ id: 'smolyan', bg: 'Смолян', en: 'Smolyan', lat: 41.5774, lon: 24.7137 },
	{ id: 'sofia', bg: 'София', en: 'Sofia', lat: 42.6977, lon: 23.3219 },
	{ id: 'sofia-oblast', bg: 'София област', en: 'Sofia Oblast', lat: 42.827, lon: 23.735 },
	{ id: 'stara-zagora', bg: 'Стара Загора', en: 'Stara Zagora', lat: 42.4258, lon: 25.6345 },
	{ id: 'targovishte', bg: 'Търговище', en: 'Targovishte', lat: 43.2512, lon: 26.5725 },
	{ id: 'haskovo', bg: 'Хасково', en: 'Haskovo', lat: 41.9342, lon: 25.5556 },
	{ id: 'shumen', bg: 'Шумен', en: 'Shumen', lat: 43.2712, lon: 26.9307 },
	{ id: 'yambol', bg: 'Ямбол', en: 'Yambol', lat: 42.4841, lon: 26.5038 },
];

export type OblastCityLabel = Pick<OblastCityPreset, 'id' | 'bg' | 'en'>;

export const FIELD_WATCH_OBLAST_CITIES: OblastCityLabel[] = FIELD_WATCH_OBLAST_PRESETS.map(
	({ id, bg, en }) => ({ id, bg, en }),
);
