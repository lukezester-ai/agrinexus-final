import type { AppLocale } from "../context/LanguageContext";

export const copy = {
	en: {
		login: {
			header: "Login (skeleton)",
			kicker: "AgriNexus · mobile",
			body: "Email + JWT from apps/backend (dev stub). Catalog loads from Next /api/mobile/courses.",
			email: "Email",
			placeholder: "you@farm.example",
			continue: "Sign in & get token",
			hint: "Token is stored on device (SecureStore / AsyncStorage on web).",
			back: "← Home",
			busy: "Signing in…",
			errorTitle: "Could not sign in",
			errorFallback: "Check EXPO_PUBLIC_BACKEND_URL and that FastAPI is running.",
		},
		academy: {
			header: "Academy",
			kicker: "AgriNexus Academy",
			heading: "Courses for the farm",
			intro: "Short modules you can finish between seasons — practical checklists, not theory walls.",
			coursesTitle: "Catalog",
			modules: "{{count}} modules",
			lectures: "Lectures",
			openCourse: "Open course",
			notFound: "Course not found",
			backList: "← All courses",
			loading: "Loading catalog from Next…",
			errorTitle: "Could not load catalog",
			retry: "Retry",
			offlineHint: "Showing bundled catalog (Next unreachable).",
		},
		home: {
			title: "AgriNexus",
			subtitle: "Mobile app — same roadmap as apps/web.",
			login: "Login",
			academy: "Academy",
			signedInAs: "Signed in as {{email}}",
			signOut: "Sign out",
		},
	},
	bg: {
		home: {
			title: "AgriNexus",
			subtitle: "Мобилно приложение — същият път като apps/web.",
			login: "Вход",
			academy: "Академия",
			signedInAs: "Влязъл като {{email}}",
			signOut: "Изход",
		},
		login: {
			header: "Вход (скелет)",
			kicker: "AgriNexus · mobile",
			body: "Имейл + JWT от apps/backend (dev). Каталогът идва от Next /api/mobile/courses.",
			email: "Имейл",
			placeholder: "ti@ferma.example",
			continue: "Вход и токен",
			hint: "Токенът се пази на устройството (SecureStore; в web — AsyncStorage).",
			back: "← Начало",
			busy: "Влизане…",
			errorTitle: "Неуспешен вход",
			errorFallback: "Провери EXPO_PUBLIC_BACKEND_URL и дали FastAPI работи.",
		},
		academy: {
			header: "Академия",
			kicker: "AgriNexus Academy",
			heading: "Курсове за стопанството",
			intro: "Кратки модули между сезоните — практични чеклисти, не стени от теория.",
			coursesTitle: "Каталог",
			modules: "{{count}} модула",
			lectures: "Лекции",
			openCourse: "Отвори курса",
			notFound: "Курсът не е намерен",
			backList: "← Всички курсове",
			loading: "Зареждане на каталога от Next…",
			errorTitle: "Каталогът не се зареди",
			retry: "Опитай отново",
			offlineHint: "Показвам вградения каталог (Next е недостъпен).",
		},
	},
} as const;

export type Copy = (typeof copy)["en"];

export function strings(locale: AppLocale) {
	return copy[locale];
}

export function moduleLine(locale: AppLocale, count: number) {
	const raw = copy[locale].academy.modules;
	return raw.replace("{{count}}", String(count));
}
