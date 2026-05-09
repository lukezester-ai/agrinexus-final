/**
 * Open-Meteo forecast (no API key). Used for farmer-facing weather briefs.
 * https://open-meteo.com/
 */

export type OpenMeteoCurrent = {
	time: string;
	temperature_2m: number;
	relative_humidity_2m: number;
	apparent_temperature: number;
	precipitation: number;
	weather_code: number;
	wind_speed_10m: number;
	wind_direction_10m: number;
	surface_pressure: number;
	/** Present when requested in `current` params (e.g. farm dash / UV card). */
	uv_index?: number;
};

export type OpenMeteoDaily = {
	time: string[];
	weather_code: number[];
	temperature_2m_max: number[];
	temperature_2m_min: number[];
	precipitation_sum: number[];
	precipitation_probability_max: number[];
	wind_speed_10m_max: number[];
};

export type WeatherForecastPayload = {
	ok: true;
	latitude: number;
	longitude: number;
	timezone: string;
	generatedAt: string;
	current: OpenMeteoCurrent;
	daily: OpenMeteoDaily;
	source: 'open_meteo';
};

export type WeatherForecastError = {
	ok: false;
	error: string;
};

const OPEN_METEO =
	'https://api.open-meteo.com/v1/forecast';

export async function fetchOpenMeteoForecast(
	latitude: number,
	longitude: number,
	signal?: AbortSignal,
): Promise<WeatherForecastPayload | WeatherForecastError> {
	try {
		const params = new URLSearchParams({
			latitude: String(latitude),
			longitude: String(longitude),
			timezone: 'Europe/Sofia',
			forecast_days: '7',
			current:
				'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure,uv_index',
			daily:
				'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max',
		});
		const res = await fetch(`${OPEN_METEO}?${params.toString()}`, {
			signal,
			headers: { Accept: 'application/json' },
		});
		if (!res.ok) {
			return { ok: false, error: `Open-Meteo HTTP ${res.status}` };
		}
		const data = (await res.json()) as {
			latitude?: number;
			longitude?: number;
			timezone?: string;
			current?: OpenMeteoCurrent;
			daily?: OpenMeteoDaily;
		};
		if (!data.current || !data.daily) {
			return { ok: false, error: 'Invalid forecast payload' };
		}
		return {
			ok: true,
			latitude: data.latitude ?? latitude,
			longitude: data.longitude ?? longitude,
			timezone: data.timezone ?? 'Europe/Sofia',
			generatedAt: new Date().toISOString(),
			current: data.current,
			daily: data.daily,
			source: 'open_meteo',
		};
	} catch (e) {
		const name = typeof e === 'object' && e && 'name' in e ? String((e as { name: string }).name) : '';
		if (name === 'AbortError') {
			return { ok: false, error: 'Request aborted' };
		}
		return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
	}
}
