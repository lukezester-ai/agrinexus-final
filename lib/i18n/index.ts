import type { AppStrings } from './catalog-en';
import { STR_EN } from './catalog-en';
import { STR_BG } from './catalog-bg';

export type UiLang = 'bg' | 'en';

export type { AppStrings } from './catalog-en';

export function parseStoredLang(raw: string | null | undefined): UiLang {
	if (raw === 'en' || raw === 'bg') return raw;
	/** Former Arabic UI selection → default to English */
	if (raw === 'ar') return 'en';
	return 'bg';
}

export function getUiStrings(lang: UiLang): AppStrings {
	if (lang === 'bg') return STR_BG;
	return STR_EN;
}

/** Next language when cycling the globe control (BG ↔ EN). */
export function cycleUiLang(current: UiLang): UiLang {
	return current === 'bg' ? 'en' : 'bg';
}

/** Short label for the active UI language (toolbar). */
export function uiLangShortLabel(lang: UiLang): string {
	return lang === 'bg' ? 'BG' : 'EN';
}

export function localeTagFor(lang: UiLang): string {
	return lang === 'bg' ? 'bg-BG' : 'en-GB';
}

/** SpeechRecognition.lang */
export function speechRecognitionLang(lang: UiLang): string {
	return lang === 'bg' ? 'bg-BG' : 'en-US';
}
