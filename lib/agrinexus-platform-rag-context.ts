/**
 * Invariant product/process map for chat RAG: always injected so the model knows
 * every major surface in SIMA (ops, fields, weather, compliance paths).
 * Supplements pgvector retrieval from doc_discovery_* tables.
 */
export function buildAgrinexusPlatformRagPreamble(locale: 'bg' | 'en'): string {
	if (locale === 'bg') {
		return `=== AGRI NEXUS — ПЛАТФОРМЕН ОБХВАТ (вътрешна карта на процесите; не е правен съвет) ===
Индексираното търсене (RAG) е **водещ слой за факти**, щом в prompt-а има откъси от документи по-долу: тогава отговорът тръгва от тях, а DAFS/официалните портали допълват рамката и проверката — не обратното.
Модули и потоци:
• Начало / AI помощник: чат през /api/chat (по подразбиране unified; по заявка lawyer|agronomist|finance); десет бързи въпроса за млад фермер с опционален ragPromptId за по-точен retrieval; контекст от профил „Твоят план“, Field Watch якор и индексирани документи (ДФЗ/износ и др.) когато е конфигурирано.
• Статистика: статистика на култури (БГ); документи внос/износ (БГ); Метео+PDF — прогноза Open-Meteo по областен център, PDF с метео и ръчни полета „финансов ефект“.
• Поле и поддръжка: Field Watch — Leaflet карта (сателит/OSM), geosearch, очертаване на полигон, площ и GeoJSON; опционален NDVI WMS при VITE_SENTINEL_WMS_URL + VITE_SENTINEL_WMS_LAYERS; класически timelapse през /agrinexus-field-watch.html; калкулатор субсидии; сезонен календар с RAG за месечен план; команден център (оперативен план и рискове от профил).
• Food Sec.: хранителна сигурност / break-even; качване на файлове към логистиката.
• Operations (навигация „Operations“): Kanban задачи todo/doing/done; бележки с локално + API workspace + Supabase; бутони RAG препоръка и дневен бриф към /api/chat с контекст задачи/полета/риск; линкове към команден център, Метео+PDF, Field Watch; списък полета от /api/fields когато е налично.
• Fieldlot: публичен лендинг на същия домейн (/fieldlot.html) — концепция за B2B каталог с агро оферти (България), ранна фаза без escrow/плащания през платформата; отделен AI водач през /api/fieldlot-chat. В този чат можеш да обясниш идеята и ориентацията; за норми, срокове и документи по стопанството насочвай към модулите по-горе и официалните портали.
• Backend dev: Vite прокси към dev API (DEV_API_PORT); метео /api/weather-forecast; operations hub sync към сървъра при логнат потребител.
Подсказка: при въпрос за „какво прави приложението“ или оперативен процес — свържи отговора с горните модули и посочи къде потребителят натиска в UI.`;
	}

	return `=== AGRI NEXUS — PLATFORM SCOPE (internal process map; not legal advice) ===
Indexed retrieval (RAG) is the **leading factual layer** whenever document excerpts appear later in the prompt: the answer starts from them, and DAFS/official portals extend the frame and verification — not the other way around.
Modules and flows:
• Home / AI assistant: chat via /api/chat (default unified; optional lawyer|agronomist|finance); ten young-farmer quick prompts with optional ragPromptId for tighter retrieval; context from “Your plan” profile, Field Watch anchor, and indexed docs (DAFS, export, etc.) when configured.
• Statistics: crop statistics (BG); trade/customs docs (BG); Weather+PDF — Open-Meteo by oblast centre, PDF export with manual “financial effect” notes.
• Field & support: Field Watch — Leaflet (satellite/OSM), geosearch, polygon draw, area & GeoJSON; optional NDVI WMS via VITE_SENTINEL_WMS_URL + VITE_SENTINEL_WMS_LAYERS; legacy timelapse at /agrinexus-field-watch.html; subsidy calculator; season calendar with RAG month plan; command centre (operational plan and profile risks).
• Food Sec.: food security / break-even; file upload for logistics.
• Operations (nav label “Operations”): Kanban todo/doing/done; notes with local + API workspace + Supabase; “RAG recommendation” and daily brief call /api/chat with tasks/fields/risk context; links to command centre, Weather+PDF, Field Watch; field list from /api/fields when available.
• Fieldlot: public landing on the same domain (/fieldlot.html) — concept for a Bulgarian B2B agri-offers catalogue (early phase, no escrow/in-platform payments); separate guide via /api/fieldlot-chat. In **this** chat you may explain the idea and orientation; for regulations, deadlines, and farm documentation, steer to the modules above and official portals.
• Dev backend: Vite proxies to dev API (DEV_API_PORT); weather /api/weather-forecast; operations hub sync when signed in.
Hint: for “what does the app do?” or operational workflow questions — tie answers to the modules above and name where the user clicks in the UI.`;
}
