import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../src/ui/LabWorkspaceScreen.tsx', import.meta.url), 'utf8');

assert.match(source, /import\s+\{\s*webPreviewDocument\s*\}\s+from\s+['"]\.\.\/learning\/labSession['"]/, 'Lab UI must use the canonical hardened preview document builder.');
assert.match(source, /webPreviewDocument\(draft\)/, 'Lab preview must render the current workspace through the canonical preview builder.');
assert.doesNotMatch(source, /function\s+buildPreview\s*\(/, 'Lab UI must not keep a second preview implementation that can drift from the audited engine.');
assert.match(source, /originWhitelist=\{\['about:blank'\]\}/, 'Lab WebView must not allow arbitrary navigation origins.');
assert.match(source, /baseUrl:\s*['"]about:blank['"]/, 'Lab HTML preview must run from an inert local base URL.');
assert.match(source, /domStorageEnabled=\{false\}/, 'Lab preview must keep DOM storage disabled.');
assert.match(source, /setSupportMultipleWindows=\{false\}/, 'Lab preview must prevent popup windows.');
assert.match(source, /onShouldStartLoadWithRequest=\{\(request\)\s*=>\s*request\.url\s*===\s*['"]about:blank['"]\s*\|\|\s*request\.url\.startsWith\(['"]data:['"]\)\}/, 'Lab preview navigation must stay inside about:blank/data resources.');

console.log('Lab preview UI audit OK: canonical preview engine and local WebView sandbox remain wired together.');
