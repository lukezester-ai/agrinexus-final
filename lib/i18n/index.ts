import type { AppStrings } from './catalog-en';
import { STR_EN } from './catalog-en';
import { STR_BG } from './catalog-bg';
import { STR_AR } from './catalog-ar';

export type UiLang = 'bg' | 'en' | 'ar';

export type { AppStrings } from './catalog-en';

export function parseStoredLang(raw: string | null | undefined): UiLang {
	if (raw === 'en' || raw === 'ar' || raw === 'bg') return raw;
	return 'bg';
}

export function isRtl(lang: UiLang): boolean {
	return lang === 'ar';
}

export function getUiStrings(lang: UiLang): AppStrings {
	if (lang === 'bg') return STR_BG;
	if (lang === 'ar') return STR_AR;
	return STR_EN;
}

/** Next language when cycling the globe control (BG → EN → AR → BG). */
export function cycleUiLang(current: UiLang): UiLang {
	if (current === 'bg') return 'en';
	if (current === 'en') return 'ar';
	return 'bg';
}

/** Short label for the active UI language (toolbar). */
export function uiLangShortLabel(lang: UiLang): string {
	if (lang === 'bg') return 'BG';
	if (lang === 'en') return 'EN';
	return 'عربي';
}

export function localeTagFor(lang: UiLang): string {
	if (lang === 'bg') return 'bg-BG';
	if (lang === 'ar') return 'ar-EG';
	return 'en-GB';
}

/** SpeechRecognition.lang — Arabic falls back to ar-SA for broader browser support. */
export function speechRecognitionLang(lang: UiLang): string {
	if (lang === 'bg') return 'bg-BG';
	if (lang === 'ar') return 'ar-SA';
	return 'en-US';
}
