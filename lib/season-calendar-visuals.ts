/**
 * Визуална сцена за месечна клетка в сезонния календар (SVG банер в UI).
 */
import type { CropCalendarKey } from './season-calendar-data';

export type SeasonVisual =
	| 'seeds_plan'
	| 'tractor_soil'
	| 'seeding'
	| 'young_crop'
	| 'docs_admin'
	| 'spray_field'
	| 'combine_harvest'
	| 'grain_logistics'
	| 'sunflower_gold'
	| 'corn_rows'
	| 'irrigate'
	| 'vine_row'
	| 'grape_harvest'
	| 'wine_cellar'
	| 'orchard_prune'
	| 'orchard_fruit'
	| 'winter_rest';

/** Месец 1–12 → сцена за избраната култура */
export const SEASON_MONTH_VISUAL: Record<CropCalendarKey, Partial<Record<number, SeasonVisual>>> = {
	wheat_barley: {
		1: 'seeds_plan',
		2: 'tractor_soil',
		3: 'seeding',
		4: 'young_crop',
		5: 'docs_admin',
		6: 'combine_harvest',
		7: 'combine_harvest',
		8: 'grain_logistics',
		9: 'seeding',
		10: 'young_crop',
		11: 'winter_rest',
		12: 'docs_admin',
	},
	sunflower: {
		1: 'seeds_plan',
		3: 'tractor_soil',
		4: 'seeding',
		5: 'docs_admin',
		6: 'young_crop',
		7: 'irrigate',
		8: 'spray_field',
		9: 'sunflower_gold',
		10: 'combine_harvest',
		11: 'grain_logistics',
	},
	maize: {
		3: 'tractor_soil',
		4: 'seeding',
		5: 'docs_admin',
		6: 'corn_rows',
		7: 'irrigate',
		8: 'young_crop',
		9: 'corn_rows',
		10: 'combine_harvest',
	},
	vine: {
		1: 'vine_row',
		2: 'vine_row',
		3: 'spray_field',
		5: 'vine_row',
		6: 'vine_row',
		7: 'irrigate',
		8: 'grape_harvest',
		9: 'grape_harvest',
		10: 'wine_cellar',
	},
	apple: {
		1: 'orchard_prune',
		3: 'spray_field',
		4: 'orchard_fruit',
		5: 'orchard_fruit',
		6: 'irrigate',
		7: 'spray_field',
		8: 'orchard_fruit',
		9: 'orchard_fruit',
		10: 'orchard_fruit',
	},
};

export function resolveSeasonVisual(crop: CropCalendarKey, month: number): SeasonVisual {
	const v = SEASON_MONTH_VISUAL[crop][month];
	return v ?? 'young_crop';
}
