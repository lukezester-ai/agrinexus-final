/**
 * Приблизително постоянно население по област (същите `id` като `FIELD_WATCH_OBLAST_PRESETS`).
 * Ориентир: преброяване 2021 (НСИ) / общи за административната област; закръглено за UI — не за официални доклади.
 */
export const BG_OBLAST_APPROX_POPULATION_2021: Record<string, number> = {
	blagoevgrad: 309_000,
	burgas: 416_000,
	varna: 431_000,
	'veliko-tarnovo': 233_000,
	vidin: 85_000,
	vratsa: 170_000,
	gabrovo: 106_000,
	dobrich: 164_000,
	kardzhali: 151_000,
	kyustendil: 125_000,
	lovech: 134_000,
	montana: 130_000,
	pazardzhik: 253_000,
	pernik: 121_000,
	pleven: 238_000,
	plovdiv: 683_000,
	razgrad: 111_000,
	ruse: 214_000,
	silistra: 80_000,
	sliven: 166_000,
	smolyan: 98_000,
	/** Столична община (град София) — за урбанизиран стапелен сценарий. */
	sofia: 1_327_000,
	/** Област София (без столицата като отделна адм. единица в преброяването). */
	'sofia-oblast': 247_000,
	'stara-zagora': 317_000,
	targovishte: 110_000,
	haskovo: 216_000,
	shumen: 162_000,
	yambol: 117_000,
};

export function getBgOblastApproxPopulation(oblastId: string): number | undefined {
	return BG_OBLAST_APPROX_POPULATION_2021[oblastId];
}
