import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../src/ui/LaunchScreen.tsx', import.meta.url), 'utf8');

assert.match(source, /useMotionPreferences\(\)/, 'Launch screen must share the app motion preference store');
assert.match(source, /if \(!appActive\)/, 'Launch animation must pause while the app is not active');
assert.match(source, /if \(reduceMotion\)/, 'Launch screen must provide a reduced-motion path');
assert.match(source, /completionTimer\.current = setTimeout\(finish, 180\)/, 'Reduced-motion launch must remain brief without an animated sequence');
assert.match(source, /completed\.current/, 'Launch completion must be guarded against duplicate callbacks');
assert.match(source, /onDoneRef\.current\(\)/, 'Launch completion must use the latest callback without restarting the sequence');

for (const value of ['nX', 'restOpacity', 'restX', 'robotScale', 'glow']) {
  assert.match(source, new RegExp(`${value}\\.stopAnimation\\(\\)`), `Launch cleanup must stop ${value}`);
}

assert.match(source, /backgroundColor:\s*theme\.colors\.background/, 'Launch surface must use the central background token');
assert.match(source, /backgroundColor:\s*theme\.colors\.primary/, 'Launch accent must use the central primary token');
assert.match(source, /color:\s*theme\.colors\.text/, 'Launch wordmark must use the central text token');
assert.match(source, /accessibilityRole="header"/, 'Launch wordmark must expose a single accessible heading');
assert.match(source, /importantForAccessibility="no-hide-descendants"/, 'Decorative robot internals must stay hidden from screen readers');
assert.match(source, /pointerEvents="none"/, 'Decorative launch glow must never intercept interaction');

console.log('Launch screen audit OK: shared motion lifecycle, reduced-motion completion, design tokens and accessibility are protected.');
