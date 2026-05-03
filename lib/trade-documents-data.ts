import type { UiLang } from './i18n';

export type LocalizedDoc = { bg: string; en: string; ar: string };

export type TradeDocSection = {
	id: string;
	title: LocalizedDoc;
	items: LocalizedDoc[];
};

export function pickLocalized(doc: LocalizedDoc, lang: UiLang): string {
	if (lang === 'bg') return doc.bg;
	if (lang === 'ar') return doc.ar;
	return doc.en;
}

/** Внос в България — ориентировъчен списък (не замества консултация с митник / БАБХ). */
export const TRADE_DOCS_IMPORT_BG: TradeDocSection[] = [
	{
		id: 'id-vat',
		title: {
			bg: 'Регистрация, EORI и ДДС',
			en: 'Registration, EORI and VAT',
			ar: 'التسجيل ورقم EORI وضريبة القيمة المضافة',
		},
		items: [
			{
				bg: 'EORI номер за подаване на митнически декларации пред НАП/Агенция „Митници“ (за юридически лица и при нужда за физически лица по режима).',
				en: 'EORI number for lodging customs declarations with Bulgarian Customs / NRA rules as applicable.',
				ar: 'رقم EORI لتقديم إقرارات جمركية لدى الجمارك البلغارية وفق القواعد المعمول بها.',
			},
			{
				bg: 'Валидна регистрация по ЗДДС при внос от трети страни (начисляване и обявяване на ДДС при внос според случая).',
				en: 'Valid VAT registration when importing from third countries (import VAT reporting per case).',
				ar: 'تسجيل ضريبة القيمة المضافة الساري عند الاستيراد من خارج الاتحاد الأوروبي.',
			},
			{
				bg: 'Идентификация на страната на произход и тарифна номенклатура (комбинирана номенклатура — CN) за ставки, мита и режими.',
				en: 'Origin determination and Combined Nomenclature (CN) codes for duties, preferences and controls.',
				ar: 'تحديد المنشأ ورموز CN للرسوم والامتيازات والضوابط.',
			},
		],
	},
	{
		id: 'commercial',
		title: {
			bg: 'Търговски и транспортни документи',
			en: 'Commercial and transport documents',
			ar: 'المستندات التجارية والنقل',
		},
		items: [
			{
				bg: 'Търговска фактура (invoice) с описание, количество, стойност, условия на доставка (Incoterms).',
				en: 'Commercial invoice with description, quantities, value and Incoterms.',
				ar: 'فاتورة تجارية مع الوصف والكميات والقيمة وشروط التسليم (Incoterms).',
			},
			{
				bg: 'Опаковъчна спецификация / packing list при групаж или смесени товари.',
				en: 'Packing list for grouped or mixed consignments.',
				ar: 'قائمة تعبئة للشحنات المجمعة أو المختلطة.',
			},
			{
				bg: 'Документ за превоз: CMR (път), коносамент или авиационна товарителница според вида транспорт.',
				en: 'Transport document: CMR (road), bill of lading or air waybill as applicable.',
				ar: 'وثيقة نقل: CMR أو بوليصة شحن أو وثيقة جوية حسب الحالة.',
			},
			{
				bg: 'Договор или поръчка (при искане от митница или банка за плащане).',
				en: 'Contract or purchase order if requested for customs or payment verification.',
				ar: 'عقد أو أمر شراء عند طلب الجمارك أو البنك.',
			},
		],
	},
	{
		id: 'customs',
		title: {
			bg: 'Митница (внос от трети страни и ЕС)',
			en: 'Customs (third countries and EU)',
			ar: 'الجمارك (دول ثالثة والاتحاد الأوروبي)',
		},
		items: [
			{
				bg: 'Митническа декларация за внос при стоки извън свободно обращение в ЕС; подаване чрез декларант с профил в ИС УНП / АИС.',
				en: 'Import customs declaration when goods are not yet in EU free circulation; filed via authorized declarant systems.',
				ar: 'إقرار استيراد جمركي عند عدم دوران البضائع بحرية في الاتحاد الأوروبي.',
			},
			{
				bg: 'При внос от друга държава от ЕС стоките обикновено са в свободно обращение — все пак са нужни фактура и доказателство за транзакцията за ДДС цели.',
				en: 'For intra-EU acquisitions, goods are usually in free circulation — invoices and evidence remain needed for VAT.',
				ar: 'للمشتريات داخل الاتحاد الأوروبي غالباً تكون البضائع في التداول الحر، مع الحاجة لفواتير لأغراض ضريبة القيمة المضافة.',
			},
			{
				bg: 'Лицензи или количествени квоти при подреждани стоки (напр. някои селскостопански продукти) — проверка по актуалните европейски и национални списъци.',
				en: 'Licences or quotas for sensitive goods — verify current EU and national lists.',
				ar: 'تراخيص أو حصص للسلع الحساسة — راجع القوائم الأوروبية والوطنية.',
			},
			{
				bg: 'Доказателства за преференциален произход (EUR.1, declaration on invoice) при приложими споразумения за намалени мита.',
				en: 'Proof of preferential origin (EUR.1, invoice declarations) where trade agreements apply.',
				ar: 'إثبات المنشأ التفضيلي (EUR.1 أو إقرارات الفاتورة) عند اتفاقيات التجارة.',
			},
		],
	},
	{
		id: 'phyt',
		title: {
			bg: 'Растителна защита, семена, храни от неживотински произход',
			en: 'Plant health, seeds, non-animal-origin food',
			ar: 'صحة النبات، البذور، غذاء المنشأ غير الحيواني',
		},
		items: [
			{
				bg: 'Фитосанитарен сертификат за растения, продукти от растения, плодове и зеленчуци от трети страни (граничен контрол на определени ГКПП).',
				en: 'Phytosanitary certificate for plants and plant products from third countries (border control at designated BCPs).',
				ar: 'شهادة صحية نباتية للنباتات ومنتجاتها من خارج الاتحاد الأوروبي.',
			},
			{
				bg: 'Предварително уведомяване и проверки през системите за храни на ЕС (част от стоките изискват регистрация на оператори и партидна проследимост).',
				en: 'Pre-notification and EU food chain traceability requirements where applicable.',
				ar: 'إخطار مسبق ومتطلبات تتبع سلسلة الغذاء في الاتحاد الأوروبي عند الاقتضاء.',
			},
			{
				bg: 'Семена и посадъчен материал — сортова регистрация и документи за съответствие с българското и европейското законодателство.',
				en: 'Seeds and propagating material — variety compliance with EU and national rules.',
				ar: 'البذور والموالد — مطابقة الأصناف وفق قواعد الاتحاد الأوروبي والوطنية.',
			},
		],
	},
	{
		id: 'vet',
		title: {
			bg: 'Животни, храни от животински произход, фуражи',
			en: 'Animals, products of animal origin, feed',
			ar: 'الحيوانات ومنتجات المنشأ الحيواني والأعلاف',
		},
		items: [
			{
				bg: 'Ветеринарно-санитарни сертификати и предварително уведомяване през TRACES за живи животни и много храни от ЖП.',
				en: 'Veterinary health certificates and TRACES pre-notification for live animals and many POAO.',
				ar: 'شهادات صحية بيطرية وإخطار TRACES للحيوانات الحية والعديد من منتجات المنشأ الحيواني.',
			},
			{
				bg: 'Одобрение на предприятия за произход (establishments) при внос от трети страни, когато режимът го изисква.',
				en: 'Approved establishments of origin for third-country imports when required.',
				ar: 'منشآت معتمدة في بلد المنشأ عند الحاجة وفق النظام.',
			},
			{
				bg: 'Фуражи, ГМО и добавки — специални регистрации и декларации по регламентите за храна за животни.',
				en: 'Feed, GMOs and additives — registrations and declarations under feed legislation.',
				ar: 'الأعلاف والمواد المعدِّلة والمُعدَّلة وراثياً — تسجيلات وإقرارات وفق تشريعات الأعلاف.',
			},
		],
	},
	{
		id: 'special',
		title: {
			bg: 'Специални режими и контрол',
			en: 'Special regimes and controls',
			ar: 'أنظمة خاصة وضوابط',
		},
		items: [
			{
				bg: 'БИО / екологично производство — сертификат по европейското биозаконодателство и веригата на контрол.',
				en: 'Organic production — EU organic certificate and control chain.',
				ar: 'الإنتاج العضوي — شهادة الاتحاد الأوروبي وسلسلة الرقابة.',
			},
			{
				bg: 'Химикали и препарати (REACH, CLP, биоциди) — регистрации, етикети, MSDS/SDS и одобрения за пускане на пазара.',
				en: 'Chemicals (REACH, CLP, biocides) — registrations, labelling, SDS and market approvals.',
				ar: 'المواد الكيميائية (REACH وCLP والمبيدات الحيوية) — التسجيل والملصقات وبيانات السلامة.',
			},
			{
				bg: 'CITES — разрешения за защитени видове при внос на растения/животни или изделия от тях.',
				en: 'CITES permits for protected species when importing plants, animals or derivatives.',
				ar: 'تصاريح CITES للأنواع المحمية عند استيراد النباتات أو الحيوانات أو مشتقاتها.',
			},
			{
				bg: 'Контрол на двойна употреба и санкции — изисквания при определени стоки и дестинации.',
				en: 'Dual-use and sanctions screening for certain goods and destinations.',
				ar: 'فحص الاستخدام المزدوج والعقوبات لسلع ووجهات محددة.',
			},
		],
	},
];

/** Износ от България */
export const TRADE_DOCS_EXPORT_BG: TradeDocSection[] = [
	{
		id: 'ex-id',
		title: {
			bg: 'Идентификация и роли',
			en: 'Identification and roles',
			ar: 'الهوية والأدوار',
		},
		items: [
			{
				bg: 'EORI на износителя/декларанта и регистрация за митнически операции.',
				en: 'Exporter/declarant EORI and registration for customs procedures.',
				ar: 'رقم EORI للمصدّر/المصرّح والتسجيل للإجراءات الجمركية.',
			},
			{
				bg: 'Ясно определен получател в третата страна и банкови детайли при искане от партньора.',
				en: 'Named consignee in the third country and banking details as required by the partner.',
				ar: 'مستلم محدد في الدولة الثالثة وتفاصيل بنكية حسب طلب الطرف المقابل.',
			},
		],
	},
	{
		id: 'ex-commercial',
		title: {
			bg: 'Търговски и транспортни документи',
			en: 'Commercial and transport documents',
			ar: 'المستندات التجارية والنقل',
		},
		items: [
			{
				bg: 'Проформа или крайна фактура, packing list, спецификация на партидите.',
				en: 'Proforma or commercial invoice, packing list, batch specification.',
				ar: 'فاتورة أولية أو نهائية وقائمة تعبئة ومواصفات الدفعات.',
			},
			{
				bg: 'CMR, коносамент или AWB в зависимост от превозвача и маршрута.',
				en: 'CMR, bill of lading or AWB depending on mode and route.',
				ar: 'CMR أو بوليصة شحن أو وثيقة جوية حسب وسيلة النقل.',
			},
			{
				bg: 'Доказателство за произход за прилагане на преференции в споразуменията на ЕС с трети страни.',
				en: 'Evidence of origin for EU preferential agreements with third countries.',
				ar: 'إثبات المنشأ لاتفاقيات الاتحاد الأوروبي التفضيلية مع دول ثالثة.',
			},
		],
	},
	{
		id: 'ex-customs',
		title: {
			bg: 'Митнически износ към трети страни',
			en: 'Customs export to third countries',
			ar: 'التصدير الجمركي إلى دول ثالثة',
		},
		items: [
			{
				bg: 'Износна митническа декларация (EX) и навременно освобождаване на стоките за износ през определен ГКПП.',
				en: 'Export customs declaration (EX) and exit formalities at the appropriate customs office.',
				ar: 'إقرار تصدير جمركي (EX) وإجراءات الخروج عند الجمارك المناسبة.',
			},
			{
				bg: 'Към държави от ЕС обикновено няма износна декларация в смисъла на трети страни — достатъчни са търговските документи за ДДС и проследимост.',
				en: 'For EU destinations, typically no “third country” export declaration — commercial docs for VAT intra-EU.',
				ar: 'لوجهات الاتحاد الأوروبي غالباً لا يوجد إقرار تصدير لدولة ثالثة — تكفي المستندات التجارية لضريبة القيمة المضافة داخل الاتحاد.',
			},
		],
	},
	{
		id: 'ex-phyt-vet',
		title: {
			bg: 'Фитосанитарни и ветеринарни износни удостоверения',
			en: 'Phytosanitary and veterinary export certificates',
			ar: 'شهادات التصدير الصحية النباتية والبيطرية',
		},
		items: [
			{
				bg: 'Фитосанитарен сертификат за растения и растителни продукти към трети страни — заявява се пред БАБХ според изискванията на страната получател.',
				en: 'Phytosanitary certificate for plants and plant products — requested via BFSA per destination rules.',
				ar: 'شهادة صحية نباتية للنباتات ومنتجاتها — عبر الهيئة البلغارية وفق بلد الوجهة.',
			},
			{
				bg: 'Ветеринарно здравен сертификат за животни и храни от ЖП; издаване след проверка и често чрез TRACES.',
				en: 'Veterinary health certificate for animals and POAO; often via TRACES.',
				ar: 'شهادة صحية بيطرية للحيوانات ومنتجات المنشأ الحيواني؛ غالباً عبر TRACES.',
			},
			{
				bg: 'Одобрение на получаващи обекти в страната на внос, когато е условие за издаване на сертификат.',
				en: 'Approved import establishments in the destination country when required for certification.',
				ar: 'منشآت استيراد معتمدة في بلد الوصول عند اشتراطها للشهادة.',
			},
		],
	},
	{
		id: 'ex-origin',
		title: {
			bg: 'Произход, органик и специални износи',
			en: 'Origin, organic and special exports',
			ar: 'المنشأ والعضوية والصادرات الخاصة',
		},
		items: [
			{
				bg: 'EUR.1 или декларация за произход на фактура за преференциални режими; доказателства за обработка в ЕС.',
				en: 'EUR.1 or invoice origin declaration for preferences; evidence of EU processing.',
				ar: 'EUR.1 أو إقرار منشأ على الفاتورة للأنظمة التفضيلية.',
			},
			{
				bg: 'БИО сертификат и износни декларации за органик към пазари извън ЕС.',
				en: 'Organic certificate and export declarations for non-EU organic markets.',
				ar: 'شهادة عضوية وإقرارات تصدير للأسواق خارج الاتحاد الأوروبي.',
			},
			{
				bg: 'CITES износно разрешение при защитени видове.',
				en: 'CITES export permit for protected species.',
				ar: 'تصريح تصدير CITES للأنواع المحمية.',
			},
			{
				bg: 'Контрол на стратегически стоки и санкционни режими при чувствителни дестинации.',
				en: 'Strategic trade controls and sanctions for sensitive destinations.',
				ar: 'ضوابط التجارة الاستراتيجية والعقوبات للوجهات الحساسة.',
			},
		],
	},
];
