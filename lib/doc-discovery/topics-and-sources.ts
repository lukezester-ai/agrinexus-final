import type { DiscoverySource, DiscoveryTopic } from './types.js';

/** Теми по агро нормативка / търговия — разширяват се автоматично след всеки успешен обход */
export const DISCOVERY_TOPICS: DiscoveryTopic[] = [
	{
		id: 'subsidies',
		labelBg: 'Субсидии и директни плащания',
		seedKeywords: [
			'subsid',
			'payment',
			'direct',
			'scheme',
			'cap',
			'isun',
			'субсид',
			'плащан',
			'директн',
			'подпомаган',
			'мерки',
			'заявлен',
			'европейск',
		],
	},
	{
		id: 'phytosanitary',
		labelBg: 'Растителна защита и фитосанитарни изисквания',
		seedKeywords: [
			'phytosanit',
			'plant health',
			'spray',
			'pesticide',
			'ppp',
			'babh',
			'растителн',
			'защит',
			'пръскан',
			'пестицид',
			'фитосанитар',
			'бабх',
		],
	},
	{
		id: 'organic',
		labelBg: 'Био и екосхеми',
		seedKeywords: ['organic', 'bio', 'eco-scheme', 'biolog', 'био', 'екологич', 'екосхем'],
	},
	{
		id: 'trade_export',
		labelBg: 'Търговия и сертификати за износ',
		seedKeywords: [
			'export',
			'certificate',
			'origin',
			'phyto',
			'euro',
			'износ',
			'сертификат',
			'произход',
			'фито',
			'инспекц',
		],
	},
	{
		id: 'law_norm',
		labelBg: 'Закони и подзаконови актове',
		seedKeywords: [
			'law',
			'decree',
			'ordinance',
			'regulation',
			'naredba',
			'normativ',
			'закон',
			'наредб',
			'правилник',
			'обнародв',
			'дв',
			'постановлен',
		],
	},
];

/** Стартови публични индекси (HTML); обходът намира директни връзки към файлове */
export const DISCOVERY_SOURCES: DiscoverySource[] = [
	{
		id: 'dfz',
		labelBg: 'ДФЗ — начална страница',
		indexUrl: 'https://www.dfz.bg/',
	},
	{
		id: 'mzh',
		labelBg: 'МЗХ — нормативни актове (раздел)',
		indexUrl: 'https://www.mzh.government.bg/bg/ministerstvo/deystvashti-normativni-aktove/',
	},
];
