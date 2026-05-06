/**
 * Rasterizes public/icons/icon-source.svg → PNG sizes for PWA + Apple touch icon.
 * Run: node scripts/generate-pwa-icons.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const svgPath = join(root, 'public', 'icons', 'icon-source.svg');
const outDir = join(root, 'public', 'icons');

const svg = readFileSync(svgPath);
const sizes = [
	{ name: 'icon-72.png', size: 72 },
	{ name: 'icon-96.png', size: 96 },
	{ name: 'icon-128.png', size: 128 },
	{ name: 'icon-152.png', size: 152 },
	{ name: 'icon-167.png', size: 167 },
	{ name: 'icon-180.png', size: 180 },
	{ name: 'icon-192.png', size: 192 },
	{ name: 'icon-384.png', size: 384 },
	{ name: 'icon-512.png', size: 512 },
];

for (const { name, size } of sizes) {
	const buf = await sharp(svg).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
	await sharp(buf).toFile(join(outDir, name));
	console.log('wrote', name);
}
