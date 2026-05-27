import type { CourseRow } from "./courses";

type CacheEntry = { key: string; data: CourseRow[]; at: number };

let cache: CacheEntry | null = null;
const TTL_MS = 45_000;

export function invalidateCourseCatalogCache() {
	cache = null;
}

export async function getCourseCatalogCached(
	cacheKey: string,
	fetcher: () => Promise<CourseRow[]>,
): Promise<CourseRow[]> {
	const now = Date.now();
	if (cache && cache.key === cacheKey && now - cache.at < TTL_MS) {
		return cache.data;
	}
	const data = await fetcher();
	cache = { key: cacheKey, data, at: now };
	return data;
}
