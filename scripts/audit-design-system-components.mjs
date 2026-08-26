import fs from 'node:fs';
import path from 'node:path';

const componentsFile = path.resolve('src/ui/components.tsx');
const themeFile = path.resolve('src/ui/theme.ts');
const components = fs.readFileSync(componentsFile, 'utf8');
const theme = fs.readFileSync(themeFile, 'utf8');

const requireSnippet = (source, snippet, message) => {
  if (!source.includes(snippet)) throw new Error(message);
};

const requiredTokens = [
  'surfaceCard',
  'surfaceStat',
  'borderSubtle',
  'borderSoft',
  'borderControl',
  'borderEmphasis',
  'primarySurface',
  'primaryBorder',
  'primaryBorderStrong',
  'primaryText',
  'primaryTextSoft',
  'successSurface',
  'successGlass',
  'successBorder',
  'successBorderStrong',
  'warningGlass',
  'warningBorder',
];

for (const token of requiredTokens) {
  requireSnippet(theme, `${token}:`, `Design system must keep semantic token theme.colors.${token}.`);
  requireSnippet(components, `theme.colors.${token}`, `Shared components must consume semantic token theme.colors.${token}.`);
}

requireSnippet(components, "import { shadows, theme } from './theme';", 'Shared components must use the central theme.');
requireSnippet(components, "import { useMotionPreferences } from './motionPreferences';", 'Shared controls must retain the shared motion lifecycle.');
requireSnippet(components, 'minHeight: theme.control.heightLg', 'Primary controls must keep tokenized touch target sizing.');
requireSnippet(components, 'width: theme.control.heightSm', 'Icon controls must keep tokenized 44pt sizing.');
requireSnippet(components, 'backgroundColor: theme.colors.primary', 'Primary button must keep the semantic primary token.');
requireSnippet(components, 'backgroundColor: theme.colors.surfaceGlassStrong', 'Progress track must keep a shared surface token.');

if (/#[0-9A-Fa-f]{3,8}|rgba?\(/.test(components)) {
  throw new Error('Shared component semantic colors must come from theme tokens, not local color literals.');
}

const readHexToken = (token) => {
  const match = theme.match(new RegExp(`${token}:\\s*'(#(?:[0-9A-Fa-f]{6}))'`));
  if (!match) throw new Error(`Expected ${token} to be a six-digit hex color for contrast auditing.`);
  return match[1];
};

const relativeLuminance = (hex) => {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
};

const contrastRatio = (foreground, background) => {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
};

const mutedText = readHexToken('textMuted');
const darkestSurfaces = [readHexToken('background'), readHexToken('surface')];
const minimumMutedContrast = Math.min(...darkestSurfaces.map((surface) => contrastRatio(mutedText, surface)));
if (minimumMutedContrast < 4.5) {
  throw new Error(`Muted text contrast must stay AA-readable on core dark surfaces (found ${minimumMutedContrast.toFixed(2)}:1).`);
}

console.log(`Design system components audit OK: semantic colors, shared motion lifecycle, tokenized touch targets, and muted-text AA contrast (${minimumMutedContrast.toFixed(2)}:1 minimum) are centralized.`);