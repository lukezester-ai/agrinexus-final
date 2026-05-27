import type { CourseRow } from "./courses";
import { getBackendUrl, getWebOrigin } from "./config";

export type TokenResponse = {
	access_token: string;
	token_type: string;
};

export async function requestBackendToken(email: string): Promise<TokenResponse> {
	const base = getBackendUrl();
	const res = await fetch(`${base}/auth/token`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Accept: "application/json" },
		body: JSON.stringify({ email }),
	});
	const text = await res.text();
	let json: unknown;
	try {
		json = text ? JSON.parse(text) : {};
	} catch {
		json = {};
	}
	if (!res.ok) {
		const detail =
			typeof json === "object" && json !== null && "detail" in json
				? String((json as { detail: unknown }).detail)
				: text || res.statusText;
		throw new Error(detail || `HTTP ${res.status}`);
	}
	const data = json as TokenResponse;
	if (!data.access_token) {
		throw new Error("missing_access_token");
	}
	return data;
}

export async function requestBackendMe(token: string): Promise<{ email: string }> {
	const base = getBackendUrl();
	const res = await fetch(`${base}/auth/me`, {
		method: "GET",
		headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
	});
	if (!res.ok) {
		throw new Error(`me ${res.status}`);
	}
	return (await res.json()) as { email: string };
}

export async function fetchCoursesFromNext(token: string | null): Promise<CourseRow[]> {
	const origin = getWebOrigin();
	const headers: Record<string, string> = { Accept: "application/json" };
	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}
	const res = await fetch(`${origin}/api/mobile/courses`, { headers });
	const text = await res.text();
	let json: unknown;
	try {
		json = text ? JSON.parse(text) : {};
	} catch {
		json = {};
	}
	if (!res.ok) {
		const err =
			typeof json === "object" && json !== null && "error" in json
				? String((json as { error: unknown }).error)
				: text || res.statusText;
		throw new Error(err || `HTTP ${res.status}`);
	}
	const data = json as { courses?: CourseRow[] };
	if (!data.courses || !Array.isArray(data.courses)) {
		throw new Error("invalid_courses_payload");
	}
	return data.courses;
}
