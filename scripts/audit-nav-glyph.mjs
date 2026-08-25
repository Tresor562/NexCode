import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../src/ui/NavGlyph.tsx', import.meta.url), 'utf8');

assert.match(source, /useMotionPreferences\(\)/, 'Bottom nav glyphs must share the app motion preference store');
assert.match(source, /reduceMotion \|\| !appActive/, 'Bottom nav motion must stop for reduced motion or background state');
assert.match(source, /emphasis\.stopAnimation\(\)/, 'Bottom nav animations must stop before state changes and cleanup');
assert.match(source, /useNativeDriver:\s*true/, 'Bottom nav emphasis should remain native-driver friendly');

assert.match(source, /accessible=\{false\}/, 'Decorative nav glyphs must stay hidden from accessibility focus');
assert.match(source, /accessibilityElementsHidden/, 'Decorative nav glyph descendants must stay hidden from screen readers');
assert.match(source, /importantForAccessibility="no-hide-descendants"/, 'Android accessibility must ignore decorative glyph descendants');
assert.match(source, /pointerEvents="none"/, 'Decorative glyph layers must never intercept navigation taps');

assert.match(source, /styles\.activeHalo/, 'Active bottom nav state must retain the premium halo affordance');
assert.match(source, /theme\.colors\.primaryGlass/, 'Active halo must use the shared primary glass design token');
assert.match(source, /theme\.colors\.borderGlass/, 'Active halo border must use the shared glass border token');
assert.match(source, /opacity:\s*emphasis\.interpolate/, 'Active halo visibility must track the shared emphasis animation');
assert.match(source, /scale:\s*emphasis\.interpolate/, 'Active halo scale must track the shared emphasis animation');

for (const glyph of ['home', 'learn', 'lab', 'projects']) {
  assert.match(source, new RegExp(`name === '${glyph}'`), `Bottom nav glyph ${glyph} must remain implemented`);
}
assert.match(source, /styles\.head/, 'Profile glyph must remain implemented');

console.log('Bottom nav glyph audit OK: premium active halo, shared motion lifecycle, native animation and decorative accessibility are protected.');
