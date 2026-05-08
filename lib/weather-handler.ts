import type { WeatherForecastError, WeatherForecastPayload } from './weather-open-meteo.js';
import { fetchOpenMeteoForecast } from './weather-open-meteo.js';

function clampLatLon(lat: number, lon: number): { lat: number; lon: number } {
	return {
		lat: Math.min(90, Math.max(-90, lat)),
		lon: Math.min(180, Math.max(-180, lon)),
	};
}

export async function handleWeatherForecastGet(query: URLSearchParams): Promise<
	WeatherForecastPayload | WeatherForecastError
> {
	const rawLat = query.get('lat');
	const rawLon = query.get('lon');
	if (!rawLat || !rawLon) {
		return { ok: false, error: 'Missing lat or lon query parameter' };
	}
	const lat = Number(rawLat);
	const lon = Number(rawLon);
	if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
		return { ok: false, error: 'lat and lon must be numbers' };
	}
	const { lat: la, lon: lo } = clampLatLon(lat, lon);

	const controller = new AbortController();
	const t = setTimeout(() => controller.abort(), 12_000);
	try {
		return await fetchOpenMeteoForecast(la, lo, controller.signal);
	} finally {
		clearTimeout(t);
	}
}
