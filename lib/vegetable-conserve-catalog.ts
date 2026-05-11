/**
 * Каталог: зеленчукови консерви — ориентировъчни заводски (EXW) нива.
 *
 * ВАЖНО: Цените са шаблон/демо за структура и UI — не са жива оферта.
 * Реални EXW нива: по заявка към производител, обем, Incoterms, ДДС, опаковка.
 */

export type ConservePackaging = {
	/** Нето / бруто, брой в транспортна единица */
	specBg: string;
	specEn: string;
};

export type VegetableConserveRow = {
	id: string;
	productBg: string;
	productEn: string;
	categoryBg: string;
	packaging: ConservePackaging;
	/** Ориентировъчна заводска цена, лв. без ДДС, EXW */
	priceExWorksBgn: number;
	/** Ориентировъчна цена EUR (фикс. курс 1 EUR ≈ 1.95586 BGN — само за ориентир) */
	priceExWorksEurApprox: number;
	unitBg: string;
	unitEn: string;
	notesBg: string;
	notesEn: string;
};

const EUR_PER_BGN = 1 / 1.95586;

/** BGN → EUR ориентир при фиксиран курс (като в другите модули). */
export function eurFromBgn(bgn: number): number {
	return Math.round(bgn * EUR_PER_BGN * 100) / 100;
}

/** Локален календарен ден YYYY-MM-DD (полунощ според часовата зона на браузъра). */
export function calendarDayISOLocal(d = new Date()): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

function djb2(str: string): number {
	let h = 5381 >>> 0;
	for (let i = 0; i < str.length; i += 1) {
		h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
	}
	return h >>> 0;
}

function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Детерминиран дневен множител за демо (±7% около базата), еднакъв за всички потребители за даден ден+SKU.
 * Не е борсова емисия — само визуално „опресняване“ при смяна на датата.
 */
export function dailyFactoryPriceMultiplier(isoDay: string, productId: string): number {
	const rnd = mulberry32(djb2(`${isoDay}|${productId}`));
	return 0.93 + rnd() * 0.14;
}

export const VEGETABLE_CONSERVE_CATALOG: VegetableConserveRow[] = [
	{
		id: 'tom-paste-22-400',
		productBg: 'Доматено пюре 22–24% сухо вещество',
		productEn: 'Tomato paste 22–24% solids',
		categoryBg: 'Доматени',
		packaging: {
			specBg: 'Консерва 400 g нето, 6 бр. / опаковка',
			specEn: 'Can 400 g net, 6 pcs / shipper',
		},
		priceExWorksBgn: 2.45,
		priceExWorksEurApprox: eurFromBgn(2.45),
		unitBg: 'за 1 бр. (консерва)',
		unitEn: 'per can',
		notesBg: 'EXW; типичен ритейл опаковъчен ред — за FCA/FOB добавете логистика.',
		notesEn: 'EXW; adjust for FCA/FOB logistics.',
	},
	{
		id: 'tom-paste-28-800',
		productBg: 'Доматено пюре 28–30% сухо вещество',
		productEn: 'Tomato paste 28–30% solids',
		categoryBg: 'Доматени',
		packaging: {
			specBg: 'Консерва 800 g, 12 бр. / кашон',
			specEn: 'Can 800 g, 12 pcs / carton',
		},
		priceExWorksBgn: 4.85,
		priceExWorksEurApprox: eurFromBgn(4.85),
		unitBg: 'за 1 бр.',
		unitEn: 'per can',
		notesBg: 'По-висок % сухо вещество — по-плътен продукт.',
		notesEn: 'Higher solids — denser product.',
	},
	{
		id: 'tom-diced-400',
		productBg: 'Домати нарязани / кубчета в собствен сок',
		productEn: 'Diced tomatoes in juice',
		categoryBg: 'Доматени',
		packaging: {
			specBg: 'Консерва 400 g, 6×4 кашона / палет (ориентир)',
			specEn: 'Can 400 g, palletized layers (indicative)',
		},
		priceExWorksBgn: 1.95,
		priceExWorksEurApprox: eurFromBgn(1.95),
		unitBg: 'за 1 бр.',
		unitEn: 'per can',
		notesBg: 'Зависи от реколта и киселинност.',
		notesEn: 'Crop and acidity dependent.',
	},
	{
		id: 'tom-peeled-800',
		productBg: 'Домати белени цели',
		productEn: 'Whole peeled tomatoes',
		categoryBg: 'Доматени',
		packaging: {
			specBg: 'Консерва 800 g, 12 бр. / кашон',
			specEn: 'Can 800 g, 12 pcs / carton',
		},
		priceExWorksBgn: 3.6,
		priceExWorksEurApprox: eurFromBgn(3.6),
		unitBg: 'за 1 бр.',
		unitEn: 'per can',
		notesBg: 'Често HoReCa линия.',
		notesEn: 'Often HoReCa line.',
	},
	{
		id: 'pickle-gherkin-680',
		productBg: 'Корнишони в оцет / саламура',
		productEn: 'Gherkins in brine or vinegar',
		categoryBg: 'Кисели краставички',
		packaging: {
			specBg: 'Буркан 680–720 ml, 6 бр. / кашон',
			specEn: 'Jar 680–720 ml, 6 pcs / carton',
		},
		priceExWorksBgn: 3.15,
		priceExWorksEurApprox: eurFromBgn(3.15),
		unitBg: 'за 1 бр.',
		unitEn: 'per jar',
		notesBg: 'Размер 3–6 cm; за extra fine — надценка.',
		notesEn: '3–6 cm grade; extra fine = premium.',
	},
	{
		id: 'pickle-salad-720',
		productBg: 'Кисела туршия / микс зеленчуци',
		productEn: 'Mixed pickled vegetables',
		categoryBg: 'Туршии',
		packaging: {
			specBg: 'Буркан 720 ml, 6 бр. / кашон',
			specEn: 'Jar 720 ml, 6 pcs / carton',
		},
		priceExWorksBgn: 3.45,
		priceExWorksEurApprox: eurFromBgn(3.45),
		unitBg: 'за 1 бр.',
		unitEn: 'per jar',
		notesBg: 'Състав: морков, карфиол, краставички и др. — по рецепта.',
		notesEn: 'Recipe-dependent mix.',
	},
	{
		id: 'pepper-roasted-520',
		productBg: 'Печени чушки / капии (лютеница база)',
		productEn: 'Roasted peppers (Ajvar-style base)',
		categoryBg: 'Чушки',
		packaging: {
			specBg: 'Буркан 520 g, 6 бр. / кашон',
			specEn: 'Jar 520 g, 6 pcs / carton',
		},
		priceExWorksBgn: 4.2,
		priceExWorksEurApprox: eurFromBgn(4.2),
		unitBg: 'за 1 бр.',
		unitEn: 'per jar',
		notesBg: 'Сезонни пиперки — ценов прозорец пролет–есен.',
		notesEn: 'Seasonal pepper window.',
	},
	{
		id: 'pepper-chopped-680',
		productBg: 'Чушки нарязани / македонска зеленчукова основа',
		productEn: 'Chopped peppers / vegetable base',
		categoryBg: 'Чушки',
		packaging: {
			specBg: 'Буркан 680 g',
			specEn: 'Jar 680 g',
		},
		priceExWorksBgn: 3.95,
		priceExWorksEurApprox: eurFromBgn(3.95),
		unitBg: 'за 1 бр.',
		unitEn: 'per jar',
		notesBg: 'За кетъринг — проверка на pH и срок.',
		notesEn: 'Check pH and shelf life for catering.',
	},
	{
		id: 'peas-400',
		productBg: 'Грах зелен консервиран',
		productEn: 'Canned green peas',
		categoryBg: 'Бобови / зеленчук',
		packaging: {
			specBg: 'Консерва 400 g, 12 бр. / кашон',
			specEn: 'Can 400 g, 12 pcs / carton',
		},
		priceExWorksBgn: 2.05,
		priceExWorksEurApprox: eurFromBgn(2.05),
		unitBg: 'за 1 бр.',
		unitEn: 'per can',
		notesBg: 'Фино / екстра — стъпка нагоре по цена.',
		notesEn: 'Extra fine grade = higher tier.',
	},
	{
		id: 'beans-white-400',
		productBg: 'Боб бял консервиран',
		productEn: 'Canned white beans',
		categoryBg: 'Бобови / зеленчук',
		packaging: {
			specBg: 'Консерва 400 g',
			specEn: 'Can 400 g',
		},
		priceExWorksBgn: 2.25,
		priceExWorksEurApprox: eurFromBgn(2.25),
		unitBg: 'за 1 бр.',
		unitEn: 'per can',
		notesBg: 'Сос доматен / „в собствен сок“ — различни SKU.',
		notesEn: 'Tomato sauce vs natural juice SKUs differ.',
	},
	{
		id: 'sweet-corn-340',
		productBg: 'Царевица сладка зърна',
		productEn: 'Sweet corn kernels',
		categoryBg: 'Царевица',
		packaging: {
			specBg: 'Консерва 340 g, 24 бр. / кашон',
			specEn: 'Can 340 g, 24 pcs / carton',
		},
		priceExWorksBgn: 1.85,
		priceExWorksEurApprox: eurFromBgn(1.85),
		unitBg: 'за 1 бр.',
		unitEn: 'per can',
		notesBg: 'Super sweet сортове — премия.',
		notesEn: 'Super-sweet varieties = premium.',
	},
	{
		id: 'beet-sliced-680',
		productBg: 'Цвекло нарязано / цели корени',
		productEn: 'Beetroot sliced or whole',
		categoryBg: 'Кореноплоди',
		packaging: {
			specBg: 'Буркан 680 ml',
			specEn: 'Jar 680 ml',
		},
		priceExWorksBgn: 2.65,
		priceExWorksEurApprox: eurFromBgn(2.65),
		unitBg: 'за 1 бр.',
		unitEn: 'per jar',
		notesBg: 'Цвят и стабилност — ключови за HoReCa.',
		notesEn: 'Color stability matters for HoReCa.',
	},
	{
		id: 'carrot-salad-500',
		productBg: 'Морковена салата / рендосан морков консервиран',
		productEn: 'Carrot salad / grated carrot preserve',
		categoryBg: 'Кореноплоди',
		packaging: {
			specBg: 'Буркан 500–520 g',
			specEn: 'Jar 500–520 g',
		},
		priceExWorksBgn: 2.35,
		priceExWorksEurApprox: eurFromBgn(2.35),
		unitBg: 'за 1 бр.',
		unitEn: 'per jar',
		notesBg: 'Често B2B за готварски бази.',
		notesEn: 'Often B2B for kitchens.',
	},
	{
		id: 'mushroom-sliced-280',
		productBg: 'Гъби консервирани (нарязани)',
		productEn: 'Canned sliced mushrooms',
		categoryBg: 'Гъби',
		packaging: {
			specBg: 'Консерва / стъкло 280–314 ml',
			specEn: 'Can or glass 280–314 ml',
		},
		priceExWorksBgn: 2.95,
		priceExWorksEurApprox: eurFromBgn(2.95),
		unitBg: 'за 1 бр.',
		unitEn: 'per unit',
		notesBg: 'Цената силно зависи от суровина (печурка / шийтаке).',
		notesEn: 'Raw material drives price (button vs shiitake).',
	},
	{
		id: 'olives-green-314',
		productBg: 'Маслини зелени без костилка (консервни)',
		productEn: 'Green pitted olives (canned/jarred)',
		categoryBg: 'Маслини',
		packaging: {
			specBg: 'Стъкло 314–370 ml',
			specEn: 'Glass 314–370 ml',
		},
		priceExWorksBgn: 4.5,
		priceExWorksEurApprox: eurFromBgn(4.5),
		unitBg: 'за 1 бр.',
		unitEn: 'per jar',
		notesBg: 'Импортна суровина често — завод = дозировка/пастьоризация.',
		notesEn: 'Often imported brine; factory = packing/pasteurization.',
	},
	{
		id: 'veg-mix-400',
		productBg: 'Зеленчуков микс (грах + морков + царевица)',
		productEn: 'Mixed vegetables (peas, carrot, corn)',
		categoryBg: 'Миксове',
		packaging: {
			specBg: 'Консерва 400 g',
			specEn: 'Can 400 g',
		},
		priceExWorksBgn: 2.15,
		priceExWorksEurApprox: eurFromBgn(2.15),
		unitBg: 'за 1 бр.',
		unitEn: 'per can',
		notesBg: 'Соотношение зеленчуци по спецификация на купувача.',
		notesEn: 'Blend ratios per buyer spec.',
	},
	{
		id: 'sauerkraut-900',
		productBg: 'Кисело зеле консервирано / пастьоризирано',
		productEn: 'Sauerkraut canned / pasteurized',
		categoryBg: 'Зеле',
		packaging: {
			specBg: 'Пауч / буркан 900 g – 1.5 kg',
			specEn: 'Pouch or jar 900 g – 1.5 kg',
		},
		priceExWorksBgn: 3.8,
		priceExWorksEurApprox: eurFromBgn(3.8),
		unitBg: 'за 1 kg нето (ориентир)',
		unitEn: 'per 1 kg net (indicative)',
		notesBg: 'Цената по kg нормализира различните опаковки.',
		notesEn: 'Per-kg normalizes pack sizes.',
	},
	{
		id: 'lecho-680',
		productBg: 'Лечо / зеленчукова подлога за сосове',
		productEn: 'Lecso / vegetable ragout base',
		categoryBg: 'Готови ястия',
		packaging: {
			specBg: 'Буркан 680 g',
			specEn: 'Jar 680 g',
		},
		priceExWorksBgn: 3.55,
		priceExWorksEurApprox: eurFromBgn(3.55),
		unitBg: 'за 1 бр.',
		unitEn: 'per jar',
		notesBg: 'Съдържание домат/чушка — по рецептура.',
		notesEn: 'Tomato/pepper ratio per recipe.',
	},
];

/** Каталог с цени за конкретен календарен ден (демо). */
export function getVegetableConserveCatalogForDay(isoDay: string): VegetableConserveRow[] {
	return VEGETABLE_CONSERVE_CATALOG.map(row => {
		const mult = dailyFactoryPriceMultiplier(isoDay, row.id);
		const bgn = Math.max(0.05, Math.round(row.priceExWorksBgn * mult * 100) / 100);
		return {
			...row,
			priceExWorksBgn: bgn,
			priceExWorksEurApprox: eurFromBgn(bgn),
		};
	});
}

/** Групиране по категория за таблици/експорт */
export function vegetableConserveByCategory(): Map<string, VegetableConserveRow[]> {
	const m = new Map<string, VegetableConserveRow[]>();
	for (const r of VEGETABLE_CONSERVE_CATALOG) {
		const list = m.get(r.categoryBg) ?? [];
		list.push(r);
		m.set(r.categoryBg, list);
	}
	return m;
}

export const VEGETABLE_CONSERVE_CATALOG_DISCLAIMER_BG =
	'Цените в таблицата са демонстрационни EXW ориентири (лв. без ДДС), не са търговски оферти. За реални заводски нива — контакт с производител и обем.';

export const VEGETABLE_CONSERVE_CATALOG_DISCLAIMER_EN =
	'Prices are illustrative demo EXW levels (BGN ex VAT), not firm offers. Real factory gate quotes depend on volume and contract.';
