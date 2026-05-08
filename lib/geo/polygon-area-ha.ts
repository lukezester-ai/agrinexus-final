/** Approximate geodesic area for an outer ring in GeoJSON order [lon, lat]. Closed ring expected. */
export function polygonRingAreaHa(ring: [number, number][]): number {
	if (ring.length < 4) return 0;
	const R = 6371008; // mean Earth radius (m)
	let sum = 0;
	for (let i = 0; i < ring.length - 1; i++) {
		const [lon1, lat1] = ring[i];
		const [lon2, lat2] = ring[i + 1];
		const λ1 = (lon1 * Math.PI) / 180;
		const λ2 = (lon2 * Math.PI) / 180;
		const φ1 = (lat1 * Math.PI) / 180;
		const φ2 = (lat2 * Math.PI) / 180;
		sum += (λ2 - λ1) * (2 + Math.sin(φ1) + Math.sin(φ2));
	}
	const m2 = Math.abs((sum * R * R) / 2);
	return m2 / 10000;
}
