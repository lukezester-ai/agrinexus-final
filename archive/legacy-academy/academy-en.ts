/**
 * English catalog copy for AgriNexus Academy (Bulgarian Markdown files unchanged).
 */
export const courseEn: Record<
	string,
	{
		title: string;
		description: string;
		lectures: Record<string, { title: string; summary: string }>;
	}
> = {
	"soil-fertility": {
		title: "Soil fertility and fertilization",
		description: "Soil tests, pH, organic matter, and sensible NPK rates for resilient yield.",
		lectures: {
			"sf-probi": {
				title: "Soil tests and basic diagnostics",
				summary: "What to order from the lab and how to read results with a business mindset.",
			},
			"sf-npk": {
				title: "NPK balance without burning budget",
				summary: "When more fertilizer does not mean more profit.",
			},
		},
	},
	"crop-markets": {
		title: "Crop markets for the farm",
		description: "Exchange, basis, logistics — from futures quotes to price at the field gate.",
		lectures: {
			"cm-basis": {
				title: "Basis and local price",
				summary: "Why two neighbours can get different prices with the same exchange print.",
			},
			"cm-timing": {
				title: "Selling timing and storage",
				summary: "Seasonality, moisture, discounts — how “waiting” costs money.",
			},
		},
	},
	"water-irrigation": {
		title: "Water and irrigation",
		description: "Water budget, drought risk, and talking to your banker in m³/ha language.",
		lectures: {
			"wi-budget": {
				title: "Season water budget",
				summary: "A dedicated cost line — not a leftover after fertilizer.",
			},
			"wi-energy": {
				title: "Pumps and energy",
				summary: "When electricity eats the savings from “less fertilizer”.",
			},
		},
	},
	"farm-finance": {
		title: "Farm finance and risk",
		description: "Working capital, insurance, subsidies, and simple metrics for decisions.",
		lectures: {
			"ff-working-capital": {
				title: "Working capital in the campaign",
				summary: "Why drought is also a credit risk.",
			},
			"ff-insurance": {
				title: "Insurance and weather triggers",
				summary: "What “verifiable” means to a financial partner.",
			},
		},
	},
	"precision-data": {
		title: "Precision farming and data",
		description: "Maps and layers, GPS, weather for operations, yield maps, records — less guesswork.",
		lectures: {
			"pd-yield-maps": {
				title: "Yield maps and zoning",
				summary: "From a picture to a decision: where to spend the next euro.",
			},
			"pd-traceability": {
				title: "Traceability and records",
				summary: "Why a field diary pays at purchase and in disputes.",
			},
			"pd-maps-gps": {
				title: "Maps, GPS, and layers in the field",
				summary: "Orthophoto, layers, phone vs receiver, boundaries and AB lines without confusion.",
			},
			"pd-weather-ops": {
				title: "Weather for field operations",
				summary: "Short vs seasonal outlook, local station, spray wind limits, rain radar.",
			},
			"pd-field-sat-maps-practice": {
				title: "Hands-on: maps, field outlines, and satellite in (near) real time",
				summary: "Draw parcel polygons, use satellite time series, walk boundaries with live GPS, and refresh layers safely in the field.",
			},
		},
	},
	"maps-and-fields": {
		title: "Maps and fields",
		description:
			"A dedicated course with a live training map in the browser: streets (OpenStreetMap), satellite layer, click-to-outline blocks, and GeoJSON export.",
		lectures: {
			"mf-why-draw": {
				title: "Why we draw blocks and what a polygon is",
				summary: "The map as shared language between farm, agronomist, and machinery — concepts before the lab.",
			},
			"mf-live-map": {
				title: "Live map: AgriNexus lab",
				summary: "The /academy/maps page — real tiles, satellite, vertices by click, and GeoJSON for class exercises.",
			},
			"mf-export-workflow": {
				title: "From sketch to machinery and partners",
				summary: "Handing files to FMIS/QGIS and checks before running an operation in the field.",
			},
		},
	},
	"drone-pilots": {
		title: "Farm drone pilots",
		description: "Simulator training (DJI tools where relevant, plus free-tier options like FPV SkyDive), stick skills, and a safe path to flights over cropland.",
		lectures: {
			"dp-sim": {
				title: "Simulator training before the first flight",
				summary: "DJI simulators, free-tier options (e.g. FPV SkyDive on Steam), and short sessions — fewer expensive prop and orientation mistakes.",
			},
			"dp-field": {
				title: "From simulator to field: safety and rules",
				summary: "Checklists, two-person crew, privacy — without replacing the official regulator.",
			},
		},
	},
};
