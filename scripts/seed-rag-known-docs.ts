/**
 * Seed на `doc_discovery_embeddings` с известни (локални + публични) агро документи.
 *
 * Прави RAG-а **веднага полезен**, докато doc-discovery cron-ът натрупа още източници.
 *
 * Записите са `DiscoveredDocLink` с богати български заглавия — точно те се вграждат
 * (`discoveryToEmbedText` използва само title + topic + URL).
 *
 * Идемпотентен: `upsertDiscoveryEmbeddings` прави UPSERT по `url`.
 *
 * Usage:
 *   npm run seed:rag
 */
import { config } from 'dotenv';
import { indexDiscoveriesForMl } from '../lib/doc-discovery/ml-index.js';
import type { DiscoveredDocLink } from '../lib/doc-discovery/types.js';

for (const key of [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'MISTRAL_API_KEY',
  'OPENAI_API_KEY',
  'DOC_DISCOVERY_EMBEDDINGS',
  'DOC_DISCOVERY_VECTOR_DIM',
]) {
  delete process.env[key];
}
config();

const SEED_DOCS: DiscoveredDocLink[] = [
  {
    url: '/docs/dfz-subsidii-neredosti-srokove.pdf',
    title:
      'ДФЗ — Субсидии, нередности и срокове за директни плащания: ръководство за земеделски производители 2026',
    sourceId: 'local',
    topicId: 'subsidies',
    score: 12,
    matchedExtras: [
      'субсидии',
      'директни плащания',
      'срокове',
      'нередности',
      'кампания',
      'кандидатстване',
      'изплащане',
      'дфз',
      'subsidy',
      'payment',
    ],
  },
  {
    url: '/docs/mlad-fermer-narachnik.pdf',
    title:
      'Млад фермер — Наръчник за кандидатстване по мярка „Млад земеделски стопанин“ (ПРСР)',
    sourceId: 'local',
    topicId: 'subsidies',
    score: 11,
    matchedExtras: [
      'млад фермер',
      'наръчник',
      'кандидатстване',
      'прср',
      'мярка',
      'стопанин',
      'инвестиция',
      'бизнес план',
      'young farmer',
    ],
  },
  {
    url: '/docs/zayavleniya-dfz.pdf',
    title:
      'ДФЗ — Заявления за подпомагане: бланки и указания за директни плащания и схеми',
    sourceId: 'local',
    topicId: 'subsidies',
    score: 11,
    matchedExtras: [
      'заявления',
      'бланки',
      'дфз',
      'подпомагане',
      'указания',
      'схеми',
      'application',
      'forms',
    ],
  },
  {
    url: '/docs/iznos-bg-es-turcia-egipet-2026-05.pdf',
    title:
      'Износ на земеделска продукция от България за ЕС, Турция и Египет — справочник 2026 (документи, мита, фитосанитарни изисквания)',
    sourceId: 'local',
    topicId: 'trade_export',
    score: 13,
    matchedExtras: [
      'износ',
      'търговия',
      'мита',
      'еспот',
      'турция',
      'египет',
      'фитосанитарни',
      'сертификати',
      'произход',
      'export',
      'customs',
      'trade',
    ],
  },
  {
    url: '/docs/dokumenti-vnos-iznos-bg.pdf',
    title:
      'Документи при внос и износ на земеделски стоки — митнически и фитосанитарни процедури (България)',
    sourceId: 'local',
    topicId: 'trade_export',
    score: 12,
    matchedExtras: [
      'внос',
      'износ',
      'митническ',
      'фитосанитар',
      'процедур',
      'документи',
      'агенция',
      'инспекц',
      'import',
      'export',
    ],
  },
  {
    url: '/docs/dogovori-lc-odbh-2026-05.pdf',
    title:
      'Договори за лицензиране и контрол при Областна дирекция „Безопасност на храните“ (ОДБХ) — образци 2026',
    sourceId: 'local',
    topicId: 'phytosanitary',
    score: 11,
    matchedExtras: [
      'одбх',
      'безопасност',
      'храни',
      'лицензиране',
      'контрол',
      'договор',
      'инспекция',
      'бабх',
      'phytosanitary',
    ],
  },
  {
    url: '/docs/dogovor-agenti-proforma.pdf',
    title:
      'Проформа договор с агент/посредник за продажба на земеделска продукция — типов образец',
    sourceId: 'local',
    topicId: 'trade_export',
    score: 9,
    matchedExtras: [
      'договор',
      'агент',
      'посредник',
      'продажба',
      'проформа',
      'образец',
      'търговия',
      'agent',
      'broker',
    ],
  },
  // --- Публични справочни URL-и (RAG-ът ще ги препоръчва на чата) ---
  {
    url: 'https://www.dfz.bg/bg/Schemes-and-Measures/',
    title:
      'ДФЗ — Схеми и мерки за подпомагане на земеделски стопани (директни плащания, ПРСР, преходни мерки)',
    sourceId: 'dfz',
    topicId: 'subsidies',
    score: 14,
    matchedExtras: [
      'схеми',
      'мерки',
      'подпомагане',
      'директни плащания',
      'прср',
      'дфз',
      'subsidy',
      'scheme',
    ],
  },
  {
    url: 'https://eumis2020.government.bg/',
    title:
      'ИСУН 2020 — Информационна система за управление и наблюдение на средствата от ЕС (ОПРСР, Европейски земеделски фонд)',
    sourceId: 'isun',
    topicId: 'subsidies',
    score: 13,
    matchedExtras: [
      'исун',
      'оперативна програма',
      'фонд',
      'еврофинансиране',
      'управление',
      'наблюдение',
      'eu funds',
    ],
  },
  {
    url: 'https://www.mzh.government.bg/bg/politiki-i-programi/programi-i-strategii/',
    title:
      'МЗХ — Политики и стратегии: Стратегически план по ОСП 2023–2027 (директни плащания и развитие на селските райони)',
    sourceId: 'mzh',
    topicId: 'law_norm',
    score: 12,
    matchedExtras: [
      'осп',
      'стратегически план',
      'политики',
      'мзх',
      'директни плащания',
      'селски райони',
      'cap',
    ],
  },
  {
    url: 'https://agriculture.ec.europa.eu/common-agricultural-policy_bg',
    title:
      'Европейска комисия — Обща селскостопанска политика (ОСП): директни плащания, екосхеми и развитие на селските райони',
    sourceId: 'ec',
    topicId: 'subsidies',
    score: 13,
    matchedExtras: [
      'осп',
      'cap',
      'екосхеми',
      'директни плащания',
      'селски райони',
      'европейска комисия',
      'eco-scheme',
    ],
  },
  {
    url: 'https://www.babh.government.bg/bg/Page/legal',
    title:
      'БАБХ — Нормативни актове за безопасност на храните, фитосанитарен контрол и растителна защита',
    sourceId: 'babh',
    topicId: 'phytosanitary',
    score: 13,
    matchedExtras: [
      'бабх',
      'нормативн',
      'фитосанитар',
      'растителн',
      'защита',
      'безопасност',
      'храни',
      'plant health',
    ],
  },
  {
    url: 'https://lex.bg/bg/laws/ldoc/2135509437',
    title:
      'Закон за подпомагане на земеделските производители — актуална редакция (lex.bg)',
    sourceId: 'lex',
    topicId: 'law_norm',
    score: 14,
    matchedExtras: [
      'закон',
      'подпомагане',
      'земеделски производители',
      'нормативна уредба',
      'lex',
      'редакция',
      'law',
    ],
  },
  {
    url: 'https://lex.bg/bg/laws/ldoc/2135481077',
    title:
      'Закон за защита на растенията — фитосанитарни изисквания и употреба на продукти за растителна защита',
    sourceId: 'lex',
    topicId: 'phytosanitary',
    score: 13,
    matchedExtras: [
      'закон',
      'защита',
      'растения',
      'фитосанитар',
      'пестицид',
      'продукт',
      'растителна защита',
      'plant protection',
    ],
  },
  {
    url: 'https://www.mzh.government.bg/bg/politiki-i-programi/biologichno-zemedelie/',
    title:
      'МЗХ — Биологично земеделие: правила за сертификация, контрол и преход към еко производство',
    sourceId: 'mzh',
    topicId: 'organic',
    score: 13,
    matchedExtras: [
      'био',
      'биологично',
      'еко',
      'сертификация',
      'контрол',
      'преход',
      'organic',
      'eco',
    ],
  },
];

const result = await indexDiscoveriesForMl(SEED_DOCS, SEED_DOCS.length);

console.log('Seeded docs:', SEED_DOCS.length);
console.log('Indexed:', result.indexed);
console.log('Model:', result.model || '(unknown)');
if (result.error) {
  console.error('Error:', result.error);
  process.exit(1);
}

if (result.indexed === 0) {
  console.error('Nothing was indexed. Check Supabase + embedding provider keys.');
  process.exit(1);
}

console.log('OK: seed completed.');
