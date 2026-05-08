/**
 * Извличане на текст от DOCX чрез `mammoth` (Microsoft Word XML формат).
 *
 * Връща plain text вариант (без HTML), готов за чункване. Поддържа списъци,
 * таблици (като табулиран текст) и заглавия. Lazy import — пакетът се зарежда
 * само ако вече сме засекли DOCX вход.
 */
type MammothResult = { value: string; messages?: Array<{ type?: string; message?: string }> };

type MammothModule = {
	default?: { extractRawText: (opts: { buffer: Buffer }) => Promise<MammothResult> };
	extractRawText?: (opts: { buffer: Buffer }) => Promise<MammothResult>;
};

export async function extractDocxText(bytes: Uint8Array): Promise<string> {
	const mod = (await import('mammoth')) as MammothModule;
	const extract = mod.extractRawText ?? mod.default?.extractRawText;
	if (!extract) {
		throw new Error('mammoth.extractRawText не е достъпен');
	}
	const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const result = await extract({ buffer: buf });
	return (result.value ?? '').trim();
}
