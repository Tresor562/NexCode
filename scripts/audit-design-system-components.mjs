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

requireSnippet(components, "import * as Haptics from 'expo-haptics';", 'Shared tactile controls must keep native haptic feedback wired through expo-haptics.');
requireSnippet(components, "import { shadows, theme } from './theme';", 'Shared components must use the central theme.');
requireSnippet(components, "import { useMotionPreferences } from './motionPreferences';", 'Shared controls must retain the shared motion lifecycle.');
requireSnippet(components, 'minHeight: theme.control.heightLg', 'Primary controls must keep tokenized touch target sizing.');
requireSnippet(components, 'width: theme.control.heightSm', 'Icon controls must keep tokenized 44pt sizing.');
requireSnippet(components, 'backgroundColor: theme.colors.primary', 'Primary button must keep the semantic primary token.');
requireSnippet(components, 'backgroundColor: theme.colors.surfaceGlassStrong', 'Progress track must keep a shared surface token.');
requireSnippet(components, 'if (appActive && !reduceMotion && !disabled) return;', 'Disabled tactile controls must reset active press motion.');
requireSnippet(components, 'if (disabled) {', 'Tactile animation must fail safe when a control is disabled.');
requireSnippet(components, 'scale.setValue(1);', 'Disabled tactile controls must restore neutral scale.');
requireSnippet(components, 'depth.setValue(0);', 'Disabled tactile controls must restore neutral depth.');
requireSnippet(components, 'void Haptics.impactAsync(style).catch(() => undefined);', 'Shared haptic feedback must fail softly when the native haptics API is unavailable.');
requireSnippet(components, 'if (disabled) return;\n    if (appActive) fireImpactHaptic(haptic);', 'Disabled tactile controls must never emit haptics and shared haptics must stay foreground-only.');
requireSnippet(components, 'haptic="medium"', 'Primary actions must keep a distinct medium haptic emphasis.');
requireSnippet(components, 'haptic="light"', 'Secondary actions must keep light haptic emphasis.');
requireSnippet(components, 'SecondaryButton({ label, onPress, icon, disabled = false }', 'Secondary actions must expose the same disable-safe contract as primary actions.');
requireSnippet(components, '<TactileButton accessibilityLabel={label} onPress={onPress} disabled={disabled}', 'Secondary disabled state must flow through the shared tactile control.');
requireSnippet(components, 'IconButton({ icon, label, onPress, active = false, disabled = false }', 'Icon controls must expose a disable-safe contract.');
requireSnippet(components, 'accessibilityState={{ selected: active, disabled }}', 'Disabled icon controls must expose their state to assistive technologies.');
requireSnippet(components, 'disabled={disabled}\n      onPress={handlePress}', 'Disabled icon controls must be disabled at the native Pressable boundary.');
requireSnippet(components, 'if (disabled) return;\n    if (appActive) fireImpactHaptic(\'light\');', 'Disabled icon controls must never emit haptics or invoke actions.');
requireSnippet(components, 'pressed && !disabled &&', 'Disabled icon controls must never show pressed motion feedback.');

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

console.log(`Design system components audit OK: semantic colors, shared motion lifecycle, foreground-only resilient haptics, disable-safe primary/secondary/icon controls, tokenized touch targets, and muted-text AA contrast (${minimumMutedContrast.toFixed(2)}:1 minimum) are centralized.`);