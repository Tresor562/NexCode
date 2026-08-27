import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('src/ui/LearningPathNode.tsx');
const source = fs.readFileSync(file, 'utf8');

const requireSnippet = (snippet, message) => {
  if (!source.includes(snippet)) throw new Error(message);
};

const forbidPattern = (pattern, message) => {
  if (pattern.test(source)) throw new Error(message);
};

requireSnippet("import { useMotionPreferences } from './motionPreferences';", 'Learning path nodes must use the shared motion lifecycle.');
requireSnippet("import { theme } from './theme';", 'Learning path nodes must use shared design tokens.');
requireSnippet('const AMBIENT_PULSE_ITERATIONS = 3;', 'Recommended-node pulse must stay bounded.');
requireSnippet('const AMBIENT_SHIMMER_ITERATIONS = 2;', 'Recommended-node shimmer must stay bounded.');
requireSnippet('const COMPLETION_TRAIL_DURATION_MS = 420;', 'Completion trail must stay short and bounded.');
requireSnippet('const COMPLETION_HALO_IN_MS = 160;', 'Completion halo entrance must stay short and bounded.');
requireSnippet('const COMPLETION_HALO_OUT_MS = 260;', 'Completion halo exit must stay short and bounded.');
requireSnippet('if (!isCurrent || reduceMotion || !appActive)', 'Ambient motion must stop for reduced motion and background state.');
requireSnippet("const becameDone = previous !== 'done' && state === 'done';", 'Completion motion must only run on a real state transition.');
requireSnippet("completionTrail.setValue(state === 'done' ? 1 : 0);", 'Reduced-motion/background completion must resolve immediately to a stable trail state.');
requireSnippet('completionHalo.setValue(0);', 'Reduced-motion/background completion must keep the halo neutral.');
requireSnippet('const haloAnimation = Animated.sequence([', 'Completion halo must remain a short bounded sequence.');
requireSnippet('Animated.parallel([popAnimation, trailAnimation, haloAnimation]).start();', 'Completion check, connector trail, and halo must remain synchronized.');
requireSnippet('haloAnimation.stop();', 'Completion halo animation must be stopped during cleanup.');
requireSnippet('opacity: completionTrail, transform: [{ translateY: completionTrailY }]', 'Completed connectors must render the bounded progress trail.');
requireSnippet('styles.completionHalo,', 'Completed nodes must render the bounded success halo.');
requireSnippet('{ opacity: completionHalo, transform: [{ scale: completionHaloScale }] }', 'Completion halo must remain driven only by bounded opacity/scale motion.');
requireSnippet("if (!appActive) return;", 'Haptic feedback must not fire while the app is inactive.');
requireSnippet('accessibilityState={{ disabled, selected: isCurrent }}', 'Learning path node state must remain exposed to assistive technology.');
requireSnippet('const accessibilityHint = disabled', 'Learning path nodes must keep a state-aware accessibility hint.');
requireSnippet("'Termine les étapes précédentes pour débloquer cette activité.'", 'Locked nodes must retain a useful accessibility hint.');
requireSnippet('accessibilityHint={accessibilityHint}', 'The computed accessibility hint must remain wired to the node button.');
requireSnippet('hitSlop={8}', 'Learning path touch targets must retain their expanded hit area.');

const tokenUsages = [
  'theme.colors.primary',
  'theme.colors.primaryBright',
  'theme.colors.primarySoft',
  'theme.colors.primaryGlass',
  'theme.colors.surfaceRaised',
  'theme.colors.surfaceGlass',
  'theme.colors.surfaceGlassStrong',
  'theme.colors.surfaceShimmer',
  'theme.colors.borderStrong',
  'theme.colors.borderGlass',
  'theme.colors.success',
  'theme.colors.successSoft',
  'theme.colors.text',
  'theme.colors.textSecondary',
  'theme.colors.textMuted',
];
for (const token of tokenUsages) requireSnippet(token, `Learning path states must keep using shared token ${token}.`);

forbidPattern(/#[0-9A-Fa-f]{3,8}/, 'Learning path state colors must come from the design system, not hard-coded hex values.');
forbidPattern(/rgba?\s*\(/, 'Learning path visuals must use shared design tokens, not local rgb/rgba literals.');
forbidPattern(/Animated\.loop\([^]*completionHalo/, 'Completion halo must never become an ambient looping animation.');

console.log('Learning path node audit OK: bounded ambient/completion trail+halo motion, shared lifecycle, accessibility, haptics, and fully tokenized visual states.');
