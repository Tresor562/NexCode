import fs from 'node:fs';

const themeSource = fs.readFileSync(new URL('../src/ui/theme.ts', import.meta.url), 'utf8');

function readHexToken(name) {
  const match = themeSource.match(new RegExp(`\\b${name}:\\s*'(#(?:[0-9a-fA-F]{6}))'`));
  if (!match) throw new Error(`Missing hex color token: ${name}`);
  return match[1];
}

function channelToLinear(channel) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const value = hex.slice(1);
  const red = channelToLinear(Number.parseInt(value.slice(0, 2), 16));
  const green = channelToLinear(Number.parseInt(value.slice(2, 4), 16));
  const blue = channelToLinear(Number.parseInt(value.slice(4, 6), 16));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground, background) {
  const first = luminance(foreground);
  const second = luminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

const white = readHexToken('white');
const primary = readHexToken('primary');
const ratio = contrastRatio(white, primary);

if (ratio < 4.5) {
  throw new Error(`Primary CTA contrast is ${ratio.toFixed(2)}:1; expected at least 4.50:1 for normal white text.`);
}

console.log(`Theme contrast audit passed: primary CTA ${ratio.toFixed(2)}:1.`);
