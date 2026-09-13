import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../src/ui/LaunchScreen.tsx', import.meta.url), 'utf8');

assert.match(source, /useMotionPreferences\(\)/, 'Launch screen must share the app motion preference store');
assert.match(source, /if \(!appActive\)/, 'Launch animation must pause while the app is not active');
assert.match(source, /if \(reduceMotion\)/, 'Launch screen must provide a reduced-motion path');
assert.match(source, /completionTimer\.current = setTimeout\(finish, 180\)/, 'Reduced-motion launch must remain brief without an animated sequence');
assert.match(source, /completed\.current/, 'Launch completion must be guarded against duplicate callbacks');
assert.match(source, /onDoneRef\.current\(\)/, 'Launch completion must use the latest callback without restarting the sequence');

for (const value of ['nX', 'restOpacity', 'restX', 'robotScale', 'robotBlink', 'glow']) {
  assert.match(source, new RegExp(`${value}\\.stopAnimation\\(\\)`), `Launch cleanup must stop ${value}`);
}

assert.match(source, /robotBlink\.setValue\(1\)/, 'Mentor eyes must reset to a stable visible state before each launch path');
assert.match(source, /const blinkSequence = Animated\.sequence\(\[/, 'Launch mentor blink must be an explicit bounded sequence');
assert.match(source, /Animated\.delay\(90\)/, 'Mentor blink must begin only after the mentor reveal starts');
assert.equal((source.match(/Animated\.timing\(robotBlink/g) ?? []).length, 4, 'Launch mentor blink must stay bounded to two close-open cycles');
assert.doesNotMatch(source, /Animated\.loop\([^)]*robotBlink/s, 'Launch mentor blink must never become an unbounded loop');
assert.match(source, /opacity:\s*robotBlink/, 'Mentor blink value must drive only the decorative eye row');

assert.match(source, /useWindowDimensions\(\)/, 'Launch wordmark must react to the current viewport width');
assert.match(
  source,
  /wordmarkScale\s*=\s*Math\.min\(1,\s*Math\.max\(0\.78,\s*\(width\s*-\s*theme\.space\.xxl\)\s*\/\s*330\)\)/,
  'Launch wordmark must keep a bounded responsive scale on narrow phones',
);
assert.match(source, /scale:\s*wordmarkScale/, 'Responsive wordmark scale must be applied to the visual wordmark');
assert.match(source, /wordmarkRow:\s*\{[^}]*width:\s*330/, 'Launch wordmark must have a stable design width before responsive scaling');
assert.doesNotMatch(source, /wordmarkRow:\s*\{[^}]*minWidth:\s*330/, 'Launch wordmark must not force a minimum width that can clip narrow screens');

assert.match(source, /backgroundColor:\s*theme\.colors\.background/, 'Launch surface must use the central background token');
assert.match(source, /backgroundColor:\s*theme\.colors\.primary/, 'Launch accent must use the central primary token');
assert.match(source, /color:\s*theme\.colors\.text/, 'Launch wordmark must use the central text token');
assert.match(source, /accessibilityRole="header"/, 'Launch wordmark must expose a single accessible heading');
assert.match(source, /importantForAccessibility="no-hide-descendants"/, 'Decorative robot internals must stay hidden from screen readers');
assert.match(source, /pointerEvents="none"/, 'Decorative launch glow must never intercept interaction');

console.log('Launch screen audit OK: shared motion lifecycle, responsive wordmark, bounded mentor blink, reduced-motion completion, design tokens and accessibility are protected.');