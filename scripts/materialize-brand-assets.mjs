import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const brandDir = path.join(root, 'assets', 'brand');
const iconPath = path.join(root, 'assets', 'icon.png');
const parts = [1, 2, 3, 4, 5].map((index) => path.join(brandDir, `icon.part${index}.b64`));

for (const part of parts) {
  if (!fs.existsSync(part)) throw new Error(`Missing NexCode brand asset part: ${path.relative(root, part)}`);
}

const encoded = parts.map((part) => fs.readFileSync(part, 'utf8').trim()).join('');
const png = Buffer.from(encoded, 'base64');
const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

if (png.length < 20_000 || !png.subarray(0, 8).equals(pngMagic)) {
  throw new Error('Official NexCode icon data is invalid or incomplete.');
}

fs.mkdirSync(path.dirname(iconPath), { recursive: true });
fs.writeFileSync(iconPath, png);
console.log(`Official NexCode icon materialized: ${path.relative(root, iconPath)} (${png.length} bytes)`);
