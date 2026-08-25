"use client";

import type { LatLngExpression } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useRef, useState } from "react";

type Locale = "en" | "bg";

const copy = {
	bg: {
		hint: "Клик върху картата за върхове на полигон. Минимум три точки за затворен блок.",
		layerStreet: "Улици (OSM)",
		layerSat: "Сателит (Esri)",
		stopDraw: "Спри чертане",
		startDraw: "Продължи чертане",
		clear: "Изчисти",
		exportGeo: "Изтегли GeoJSON",
		points: (n: number) => `Точки: ${n}`,
		note: "Учебна карта — не замества официални кадастърни граници. За сателита важат условията на доставчика на плочките.",
	},
	en: {
		hint: "Click the map to add polygon vertices. You need at least three points for a closed block.",
		layerStreet: "Streets (OSM)",
		layerSat: "Satellite (Esri)",
		stopDraw: "Stop drawing",
		startDraw: "Resume drawing",
		clear: "Clear",
		exportGeo: "Download GeoJSON",
		points: (n: number) => `Vertices: ${n}`,
		note: "Teaching map — not a legal cadastral record. Satellite tiles are subject to the provider’s terms.",
	},
} as const;

export function AcademyMapsLab({ locale }: { locale: Locale }) {
	const c = copy[locale];
	const wrapRef = useRef<HTMLDivElement | null>(null);
	const mapRef = useRef<L.Map | null>(null);
	const vectorRef = useRef<L.Layer | null>(null);
	const baseRef = useRef<{ osm: L.TileLayer; sat: L.TileLayer } | null>(null);
	const [points, setPoints] = useState<{ lat: number; lng: number }[]>([]);
	const [drawing, setDrawing] = useState(true);
	const drawingRef = useRef(drawing);
	const [layer, setLayer] = useState<"osm" | "sat">("osm");

	const redrawVector = useCallback((map: L.Map, pts: { lat: number; lng: number }[]) => {
		if (vectorRef.current) {
			map.removeLayer(vectorRef.current);
			vectorRef.current = null;
		}
		if (pts.length === 0) return;
		const latlngs = pts as unknown as LatLngExpression[];
		if (pts.length === 1) {
			vectorRef.current = L.circleMarker(latlngs[0], { radius: 5, color: "#1f4d2c", fillColor: "#5a9968", fillOpacity: 0.9 }).addTo(map);
			return;
		}
		if (pts.length === 2) {
			vectorRef.current = L.polyline(latlngs, { color: "#1f4d2c", weight: 2 }).addTo(map);
			return;
		}
		vectorRef.current = L.polygon(latlngs, {
			color: "#1f4d2c",
			weight: 2,
			fillColor: "#5a9968",
			fillOpacity: 0.25,
		}).addTo(map);
	}, []);

	useEffect(() => {
		drawingRef.current = drawing;
	}, [drawing]);

	useEffect(() => {
		if (!wrapRef.current || mapRef.current) return;
		const center: LatLngExpression = [42.6977, 25.3223];
		const map = L.map(wrapRef.current, { zoomControl: true, scrollWheelZoom: true }).setView(center, 13);
		mapRef.current = map;

		const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
			maxZoom: 19,
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
		});
		const sat = L.tileLayer(
			"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
			{
				maxZoom: 19,
				attribution: "Tiles &copy; Esri — educational use; check provider terms",
			},
		);
		baseRef.current = { osm, sat };
		osm.addTo(map);

		const onClick = (e: L.LeafletMouseEvent) => {
			if (!drawingRef.current) return;
			setPoints((prev) => [...prev, { lat: e.latlng.lat, lng: e.latlng.lng }]);
		};
		map.on("click", onClick);

		const ro = new ResizeObserver(() => {
			map.invalidateSize();
		});
		ro.observe(wrapRef.current);

		return () => {
			ro.disconnect();
			map.off("click", onClick);
			map.remove();
			mapRef.current = null;
			baseRef.current = null;
			vectorRef.current = null;
		};
	}, []);

	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;
		redrawVector(map, points);
	}, [points, redrawVector]);

	useEffect(() => {
		const map = mapRef.current;
		const bases = baseRef.current;
		if (!map || !bases) return;
		if (layer === "osm") {
			if (map.hasLayer(bases.sat)) map.removeLayer(bases.sat);
			if (!map.hasLayer(bases.osm)) bases.osm.addTo(map);
		} else {
			if (map.hasLayer(bases.osm)) map.removeLayer(bases.osm);
			if (!map.hasLayer(bases.sat)) bases.sat.addTo(map);
		}
	}, [layer]);

	const onExport = () => {
		if (points.length < 3) return;
		const ring = points.map((p) => [p.lng, p.lat]);
		ring.push([points[0].lng, points[0].lat]);
		const geo = {
			type: "FeatureCollection",
			features: [
				{
					type: "Feature",
					properties: { name: "agrinexus-academy-lab", source: "AgriNexus maps lab" },
					geometry: { type: "Polygon", coordinates: [ring] },
				},
			],
		};
		const blob = new Blob([JSON.stringify(geo, null, 2)], { type: "application/geo+json" });
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = "agrinexus-field-lab.geojson";
		a.click();
		URL.revokeObjectURL(a.href);
	};

	return (
		<div className="mt-8 space-y-4">
			<p className="text-sm text-slate-600">{c.hint}</p>
			<div className="flex flex-wrap items-center gap-2">
				<button
					type="button"
					onClick={() => setLayer("osm")}
					className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
						layer === "osm" ? "bg-forest-800 text-white" : "bg-white/80 text-slate-700 ring-1 ring-slate-200"
					}`}
				>
					{c.layerStreet}
				</button>
				<button
					type="button"
					onClick={() => setLayer("sat")}
					className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
						layer === "sat" ? "bg-forest-800 text-white" : "bg-white/80 text-slate-700 ring-1 ring-slate-200"
					}`}
				>
					{c.layerSat}
				</button>
				<span className="ml-auto font-mono text-xs text-slate-500">{c.points(points.length)}</span>
			</div>
			<div ref={wrapRef} className="relative z-0 h-[min(70vh,520px)] w-full overflow-hidden rounded-2xl ring-1 ring-slate-200 shadow-lg" />
			<div className="flex flex-wrap gap-2">
				<button
					type="button"
					onClick={() => setDrawing((d) => !d)}
					className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-900"
				>
					{drawing ? c.stopDraw : c.startDraw}
				</button>
				<button
					type="button"
					onClick={() => {
						setPoints([]);
						const map = mapRef.current;
						if (map && vectorRef.current) {
							map.removeLayer(vectorRef.current);
							vectorRef.current = null;
						}
					}}
					className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50"
				>
					{c.clear}
				</button>
				<button
					type="button"
					disabled={points.length < 3}
					onClick={onExport}
					className="rounded-lg bg-forest-800 px-3 py-2 text-xs font-semibold text-white hover:bg-forest-900 disabled:cursor-not-allowed disabled:opacity-40"
				>
					{c.exportGeo}
				</button>
			</div>
			<p className="text-xs text-slate-500">{c.note}</p>
		</div>
	);
}
