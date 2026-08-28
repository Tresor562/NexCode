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
requireSnippet(components, 'const SHARED_TOUCH_HIT_SLOP = 8;', 'Shared tactile controls must keep an expanded invisible mobile hit target.');
requireSnippet(components, 'hitSlop={SHARED_TOUCH_HIT_SLOP}', 'Every shared tactile action must consume the centralized hit-slop boundary.');
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
requireSnippet(components, 'haptic="light"', 'Secondary and icon actions must keep light haptic emphasis.');
requireSnippet(components, 'accessibilityState={{ disabled: Boolean(disabled), selected: accessibilitySelected, busy: accessibilityBusy }}', 'The shared tactile boundary must expose disabled, selected, and busy state to assistive technologies.');
requireSnippet(components, 'loading = false', 'Shared premium controls must expose a loading state.');
requireSnippet(components, "loadingLabel = 'Chargement'", 'Shared premium controls must expose a readable loading label.');
requireSnippet(components, 'const inactive = disabled || loading;', 'Loading controls must become interaction-safe through the same inactive boundary as disabled controls.');
requireSnippet(components, 'accessibilityBusy={loading}', 'Loading state must flow to assistive technologies through the shared tactile boundary.');
requireSnippet(components, 'loading ? <ActivityIndicator', 'Loading controls must expose native progress feedback.');
requireSnippet(components, 'accessibilityHint={accessibilityHint}', 'Shared premium controls must preserve screen-specific accessibility guidance.');
requireSnippet(components, 'accessibilitySelected={active}', 'Selected icon state must flow through the shared tactile accessibility contract.');
requireSnippet(components, 'style={[styles.iconButton, active && styles.iconButtonActive]}', 'Icon active visuals must stay within the shared tactile boundary.');

const primaryButtonBody = components.slice(components.indexOf('export function PrimaryButton'), components.indexOf('export function SecondaryButton'));
requireSnippet(primaryButtonBody, 'loading = false', 'Primary actions must expose a loading-safe contract.');
requireSnippet(primaryButtonBody, 'disabled={inactive}', 'Primary loading state must disable interaction through TactileButton.');
requireSnippet(primaryButtonBody, 'haptic="medium"', 'Primary actions must retain medium foreground-only haptics.');

const secondaryButtonBody = components.slice(components.indexOf('export function SecondaryButton'), components.indexOf('export function IconButton'));
requireSnippet(secondaryButtonBody, '<TactileButton', 'Secondary controls must reuse the shared tactile boundary.');
requireSnippet(secondaryButtonBody, 'loading = false', 'Secondary actions must expose a loading-safe contract.');
requireSnippet(secondaryButtonBody, 'disabled={inactive}', 'Secondary loading state must disable interaction through TactileButton.');
requireSnippet(secondaryButtonBody, 'haptic="light"', 'Secondary actions must keep light foreground-only haptic feedback.');

const iconButtonBody = components.slice(components.indexOf('export function IconButton'), components.indexOf('export function Pill'));
requireSnippet(iconButtonBody, '<TactileButton', 'Icon controls must reuse the shared tactile motion boundary instead of a separate Pressable implementation.');
requireSnippet(iconButtonBody, 'loading = false', 'Icon controls must expose a loading-safe contract.');
requireSnippet(iconButtonBody, 'disabled={inactive}', 'Icon loading state must disable interaction through the shared tactile boundary.');
requireSnippet(iconButtonBody, 'haptic="light"', 'Icon controls must keep light foreground-only haptic feedback through the shared tactile boundary.');
if (iconButtonBody.includes('useMotionPreferences()') || iconButtonBody.includes('<Pressable')) {
  throw new Error('IconButton must not duplicate motion lifecycle or Pressable behavior outside TactileButton.');
}
if (components.includes('iconPressed:') || components.includes('iconPressedReducedMotion:')) {
  throw new Error('Legacy icon-only pressed styles must stay removed now that IconButton uses shared tactile motion.');
}

const sectionHeaderBody = components.slice(components.indexOf('export function SectionHeader'), components.indexOf('export function EmptyState'));
requireSnippet(sectionHeaderBody, 'actionLoading = false', 'Section header actions must expose a shared loading state.');
requireSnippet(sectionHeaderBody, 'const inactive = actionDisabled || actionLoading;', 'Section header loading must share the same inactive boundary as disabled actions.');
requireSnippet(sectionHeaderBody, '<TactileButton', 'Interactive section header actions must reuse the shared tactile boundary.');
requireSnippet(sectionHeaderBody, 'accessibilityBusy={actionLoading}', 'Section header loading must remain visible to assistive technologies.');
requireSnippet(sectionHeaderBody, 'disabled={inactive}', 'Section header loading must disable interaction through the shared tactile boundary.');
requireSnippet(sectionHeaderBody, 'actionLoading ? <ActivityIndicator', 'Section header loading must expose native progress feedback.');

if (/#[0-9A-Fa-f]{3,8}|rgba?\(/.test(components)) {
  throw new Error('Shared component semantic colors must come from theme tokens, not local color literals.');
}

const readNumericToken = (token) => {
  const match = theme.match(new RegExp(`${token}:\\s*(-?\\d+(?:\\.\\d+)?)`));
  if (!match) throw new Error(`Expected numeric design-system token theme.motion.${token}.`);
  return Number(match[1]);
};

const pressedScale = readNumericToken('pressedScale');
const pressedDepth = readNumericToken('pressedDepth');
const springSpeed = readNumericToken('springSpeed');
const springBounciness = readNumericToken('springBounciness');
if (pressedScale < 0.975 || pressedScale > 0.99) throw new Error(`Shared tactile pressedScale must stay subtle (found ${pressedScale}).`);
if (pressedDepth < 1 || pressedDepth > 3) throw new Error(`Shared tactile pressedDepth must stay shallow (found ${pressedDepth}).`);
if (springSpeed < 28 || springSpeed > 36) throw new Error(`Shared tactile springSpeed must stay responsive (found ${springSpeed}).`);
if (springBounciness < 0 || springBounciness > 5) throw new Error(`Shared tactile springBounciness must stay controlled (found ${springBounciness}).`);

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

console.log(`Design system components audit OK: semantic colors, shared motion lifecycle, premium tactile bounds (${pressedScale}/${pressedDepth}px, speed ${springSpeed}, bounce ${springBounciness}), foreground-only resilient haptics, unified loading/disable-safe primary/secondary/icon/section controls, expanded shared hit targets, tokenized touch targets, and muted-text AA contrast (${minimumMutedContrast.toFixed(2)}:1 minimum) are centralized.`);