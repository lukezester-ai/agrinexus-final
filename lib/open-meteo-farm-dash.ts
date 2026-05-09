/**
 * Отделна обвивка: Operations табло ползва същия Open-Meteo клиент като /api/weather-forecast.
 */

import { fetchOpenMeteoForecast } from './weather-open-meteo.js';

export type FarmDashWeatherSnap = {
	temp: number;
	feels: number;
	humidity: number;
	wind: number;
	pressure: number;
	rain: number;
	uv: number;
	code: number;
	daily: {
		time: string[];
		weather_code: number[];
		temperature_2m_max: number[];
		temperature_2m_min: number[];
		precipitation_sum: number[];
		wind_speed_10m_max: number[];
	};
};

export type FarmDashWeatherResult =
	| { ok: true; snap: FarmDashWeatherSnap }
	| { ok: false; error: string };

export async function fetchFarmDashWeather(
	latitude: number,
	longitude: number,
	signal?: AbortSignal,
): Promise<FarmDashWeatherResult> {
	const r = await fetchOpenMeteoForecast(latitude, longitude, signal);
	if (!r.ok) return { ok: false, error: r.error };

	const { current: c, daily: d } = r;
	if (
		!d.time?.length ||
		!Array.isArray(d.precipitation_sum) ||
		d.precipitation_sum.length !== d.time.length
	) {
		return { ok: false, error: 'Daily forecast incomplete in Open-Meteo response' };
	}

	return {
		ok: true,
		snap: {
			temp: c.temperature_2m,
			feels: c.apparent_temperature,
			humidity: c.relative_humidity_2m,
			wind: c.wind_speed_10m,
			pressure: c.surface_pressure,
			rain: c.precipitation ?? 0,
			uv: typeof c.uv_index === 'number' ? c.uv_index : 0,
			code: c.weather_code,
			daily: {
				time: d.time,
				weather_code: d.weather_code,
				temperature_2m_max: d.temperature_2m_max,
				temperature_2m_min: d.temperature_2m_min,
				precipitation_sum: d.precipitation_sum,
				wind_speed_10m_max: d.wind_speed_10m_max,
			},
		},
	};
}
