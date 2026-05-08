import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleWeatherForecastGet } from '../lib/weather-handler.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
	res.setHeader('Content-Type', 'application/json; charset=utf-8');

	try {
		if (req.method === 'OPTIONS') {
			res.status(204).end();
			return;
		}
		if (req.method !== 'GET') {
			res.status(405).json({ ok: false, error: 'Method not allowed' });
			return;
		}
		const query = new URLSearchParams();
		const q = req.query;
		const lat = q.lat;
		const lon = q.lon;
		if (typeof lat === 'string') query.set('lat', lat);
		else if (Array.isArray(lat) && lat[0]) query.set('lat', String(lat[0]));
		if (typeof lon === 'string') query.set('lon', lon);
		else if (Array.isArray(lon) && lon[0]) query.set('lon', String(lon[0]));

		const result = await handleWeatherForecastGet(query);
		if (!result.ok) {
			res.status(400).json(result);
			return;
		}
		res.status(200).json(result);
	} catch (e) {
		res.status(500).json({
			ok: false,
			error: e instanceof Error ? e.message : 'Unexpected server error',
		});
	}
}
