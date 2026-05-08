import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import { GeoSearchControl, OpenStreetMapProvider } from 'leaflet-geosearch';
import 'leaflet-geosearch/dist/geosearch.css';
import { polygonRingAreaHa } from '../lib/geo/polygon-area-ha';

type GeoJsonFeature = {
	type: 'Feature';
	geometry: { type: 'Polygon'; coordinates: [number, number][][] };
};

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: () => string })._getIconUrl;
L.Icon.Default.mergeOptions({
	iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
	iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
	shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export type FieldWatchLeafletProps = {
	lang: 'bg' | 'en';
	initialLat: number;
	initialLon: number;
	initialZoom?: number;
	onWeatherAnchor?: (lat: number, lon: number) => void;
};

function labels(lang: 'bg' | 'en') {
	return lang === 'bg'
		? {
				baseSatellite: 'Сателит (Esri)',
				baseStreet: 'OSM карта',
				ndvi: 'NDVI (WMS)',
				searchHint: 'Търси населено място…',
				drawHint:
					'Очертай полигон с инструментите вляво. При завършване се записват площ (ha) и GeoJSON.',
				area: 'Площ',
				geoJson: 'GeoJSON',
				copy: 'Копирай',
				ndviNote:
					'За NDVI задайте VITE_SENTINEL_WMS_URL и VITE_SENTINEL_WMS_LAYERS (.env) към вашия Sentinel Hub / WMS слой.',
				noPolygon: 'Няма очертан полигон.',
			}
		: {
				baseSatellite: 'Satellite (Esri)',
				baseStreet: 'OSM map',
				ndvi: 'NDVI (WMS)',
				searchHint: 'Search place…',
				drawHint:
					'Draw a polygon with the toolbar on the left. On finish we store area (ha) and GeoJSON.',
				area: 'Area',
				geoJson: 'GeoJSON',
				copy: 'Copy',
				ndviNote:
					'For NDVI set VITE_SENTINEL_WMS_URL and VITE_SENTINEL_WMS_LAYERS (.env) for your Sentinel Hub WMS layer.',
				noPolygon: 'No polygon drawn yet.',
			};
}

export function FieldWatchLeaflet({
	lang,
	initialLat,
	initialLon,
	initialZoom = 12,
	onWeatherAnchor,
}: FieldWatchLeafletProps) {
	const wrapRef = useRef<HTMLDivElement | null>(null);
	const mapRef = useRef<L.Map | null>(null);
	const drawnRef = useRef<L.FeatureGroup | null>(null);
	const ndviLayerRef = useRef<L.TileLayer.WMS | null>(null);
	const [polygonGeoJson, setPolygonGeoJson] = useState<string | null>(null);
	const [areaHa, setAreaHa] = useState<number | null>(null);
	const t = useMemo(() => labels(lang), [lang]);

	const wmsUrl = useMemo(() => (import.meta.env.VITE_SENTINEL_WMS_URL ?? '').trim(), []);
	const wmsLayers = useMemo(() => (import.meta.env.VITE_SENTINEL_WMS_LAYERS ?? '').trim(), []);
	const ndviAvailable = Boolean(wmsUrl && wmsLayers);

	useEffect(() => {
		const el = wrapRef.current;
		if (!el || mapRef.current) return;

		const map = L.map(el, { zoomControl: true }).setView([initialLat, initialLon], initialZoom);

		const esri = L.tileLayer(
			'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
			{
				maxZoom: 19,
				attribution:
					'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
			},
		);

		const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			maxZoom: 19,
			attribution: '© OpenStreetMap contributors',
		});

		esri.addTo(map);

		const baseMaps: Record<string, L.TileLayer> = {
			[t.baseSatellite]: esri,
			[t.baseStreet]: osm,
		};
		L.control.layers(baseMaps).addTo(map);

		const provider = new OpenStreetMapProvider();
		const searchControl = GeoSearchControl({
			provider,
			style: 'bar',
			showMarker: true,
			showPopup: false,
			searchLabel: t.searchHint,
		});
		map.addControl(searchControl);

		const drawnItems = new L.FeatureGroup();
		drawnRef.current = drawnItems;
		map.addLayer(drawnItems);

		const drawControl = new L.Control.Draw({
			edit: {
				featureGroup: drawnItems,
				remove: true,
			},
			draw: {
				polygon: {
					allowIntersection: false,
					showArea: true,
				},
				polyline: false,
				marker: false,
				circle: false,
				circlemarker: false,
				rectangle: {
					shapeOptions: {
						color: '#7ccd9c',
						weight: 2,
					},
				},
			},
		});
		map.addControl(drawControl);

		let ndviLayer: L.TileLayer.WMS | null = null;
		if (ndviAvailable) {
			ndviLayer = L.tileLayer.wms(wmsUrl, {
				layers: wmsLayers,
				format: 'image/png',
				transparent: true,
				version: '1.3.0',
				opacity: 0.72,
				attribution: 'NDVI source: Sentinel Hub / configured WMS',
			});
			ndviLayerRef.current = ndviLayer;
			L.control
				.layers(
					{},
					{
						[t.ndvi]: ndviLayer,
					},
				)
				.addTo(map);
		}

		const extractPolygon = (layer: L.Layer): { geom: GeoJsonFeature['geometry']; ha: number } | null => {
			const gjUnknown = (layer as L.Layer & { toGeoJSON?: () => unknown }).toGeoJSON?.();
			if (!gjUnknown || typeof gjUnknown !== 'object') return null;
			const gj = gjUnknown as GeoJsonFeature;
			if (gj.type !== 'Feature' || !gj.geometry || gj.geometry.type !== 'Polygon') return null;
			const coords = gj.geometry.coordinates[0] as [number, number][];
			const ha = polygonRingAreaHa(coords);
			return { geom: gj.geometry, ha };
		};

		map.on(L.Draw.Event.CREATED, ((e: L.DrawEvents.Created) => {
			const layer = e.layer;
			drawnItems.addLayer(layer);
			const parsed = extractPolygon(layer);
			if (parsed) {
				setPolygonGeoJson(JSON.stringify(parsed.geom));
				setAreaHa(parsed.ha);
				try {
					const poly = layer as L.Polygon;
					const c = poly.getBounds().getCenter();
					if (c && onWeatherAnchor) onWeatherAnchor(c.lat, c.lng);
				} catch {
					/* ignore */
				}
			}
		}) as L.LeafletEventHandlerFn);

		map.on(L.Draw.Event.DELETED, () => {
			setPolygonGeoJson(null);
			setAreaHa(null);
		});

		mapRef.current = map;

		return () => {
			map.remove();
			mapRef.current = null;
			drawnRef.current = null;
			ndviLayerRef.current = null;
		};
	}, [
		initialLat,
		initialLon,
		initialZoom,
		ndviAvailable,
		wmsLayers,
		wmsUrl,
		onWeatherAnchor,
		t.baseSatellite,
		t.baseStreet,
		t.ndvi,
		t.searchHint,
	]);

	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;
		map.setView([initialLat, initialLon], map.getZoom());
	}, [initialLat, initialLon]);

	const copyGeoJson = () => {
		if (!polygonGeoJson) return;
		void navigator.clipboard?.writeText(polygonGeoJson);
	};

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
			<p className="muted" style={{ margin: 0, fontSize: '.88rem' }}>
				{t.drawHint}
			</p>
			{!ndviAvailable ? (
				<p className="muted" style={{ margin: 0, fontSize: '.82rem' }}>
					{t.ndviNote}
				</p>
			) : null}
			<div
				ref={wrapRef}
				style={{
					height: 'min(72vh, 640px)',
					minHeight: 380,
					width: '100%',
					borderRadius: 12,
					overflow: 'hidden',
					border: '1px solid var(--border, rgba(255,255,255,.12))',
				}}
			/>
			<div className="contact-panel" style={{ padding: 12, display: 'grid', gap: 8 }}>
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
					<strong style={{ fontSize: '.9rem' }}>
						{t.area}:{' '}
						<span style={{ fontWeight: 700 }}>{areaHa != null ? `${areaHa.toFixed(2)} ha` : '—'}</span>
					</strong>
					<button type="button" className="btn-mini" disabled={!polygonGeoJson} onClick={copyGeoJson}>
						{t.copy} GeoJSON
					</button>
				</div>
				{polygonGeoJson ? (
					<pre
						style={{
							margin: 0,
							maxHeight: 120,
							overflow: 'auto',
							fontSize: '.72rem',
							background: 'rgba(0,0,0,.2)',
							padding: 8,
							borderRadius: 8,
							whiteSpace: 'pre-wrap',
							wordBreak: 'break-all',
						}}>
						{polygonGeoJson}
					</pre>
				) : (
					<p className="muted" style={{ margin: 0, fontSize: '.82rem' }}>
						{t.noPolygon}
					</p>
				)}
			</div>
		</div>
	);
}
