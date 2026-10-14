import Constants from "expo-constants";

function stripSlash(s: string) {
	return s.replace(/\/$/, "");
}

/** Next origin (e.g. http://127.0.0.1:3000) — no /en prefix for /api routes. */
export function getWebOrigin(): string {
	const fromEnv = process.env.EXPO_PUBLIC_WEB_ORIGIN;
	if (fromEnv && fromEnv.length > 0) {
		return stripSlash(fromEnv);
	}
	const extra = Constants.expoConfig?.extra as { webOrigin?: string } | undefined;
	if (extra?.webOrigin) {
		return stripSlash(extra.webOrigin);
	}
	return "http://127.0.0.1:3000";
}

export function getBackendUrl(): string {
	const fromEnv = process.env.EXPO_PUBLIC_BACKEND_URL;
	if (fromEnv && fromEnv.length > 0) {
		return stripSlash(fromEnv);
	}
	const extra = Constants.expoConfig?.extra as { backendUrl?: string } | undefined;
	if (extra?.backendUrl) {
		return stripSlash(extra.backendUrl);
	}
	return "http://127.0.0.1:8000";
}
