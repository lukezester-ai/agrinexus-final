/**
 * Single place for RAG size limits: `/api/chat` joins platform preamble + retrieval,
 * then truncates to `MAX_CHAT_RAG_COMBINED_CHARS`.
 */
export const MAX_CHAT_RAG_COMBINED_CHARS = 22000;

/**
 * Max size for the doc-discovery retrieval block alone (`buildDocDiscoveryRagContextForChat`).
 * Kept below the combined cap so the platform map from `buildAgrinexusPlatformRagPreamble` still fits.
 */
export const MAX_DOC_DISCOVERY_RAG_CHARS = MAX_CHAT_RAG_COMBINED_CHARS - 4500;
