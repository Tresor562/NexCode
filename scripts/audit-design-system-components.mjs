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

console.log('Design system components audit OK: semantic colors, shared motion lifecycle, and tokenized touch targets are centralized.');
