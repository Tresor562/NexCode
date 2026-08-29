import fs from 'node:fs';
import assert from 'node:assert/strict';

const importSource = fs.readFileSync(new URL('../src/lib/workspaceImport.ts', import.meta.url), 'utf8');
const safetySource = fs.readFileSync(new URL('../src/lib/workspaceSafety.ts', import.meta.url), 'utf8');

assert.match(
  importSource,
  /import\s+\{[^}]*canonicalWorkspacePath[^}]*isSensitiveWorkspaceFilename[^}]*workspaceCollisionKey[^}]*\}\s+from\s+['"]\.\/workspaceSafety['"]/,
  'Phone imports must consume the shared workspace path and sensitive-file policy',
);
assert.match(
  importSource,
  /!isSensitiveWorkspaceFilename\(file\.name\)/,
  'Every picked text file must pass the same sensitive filename guard as restored workspaces',
);
assert.doesNotMatch(
  importSource,
  /const\s+SENSITIVE_BASENAMES\s*=|function\s+isSensitiveName\s*\(/,
  'Workspace imports must not reintroduce a duplicate sensitive-file policy that can drift from restore/export safety',
);
assert.match(
  safetySource,
  /basename\s*===\s*['"]\.env\.example['"]\)\s*return\s+false/,
  'The shared safety boundary must preserve the explicit safe .env.example teaching case',
);
assert.match(
  safetySource,
  /basename\.startsWith\(['"]\.env\.['"]\)/,
  'The shared safety boundary must continue blocking environment variants such as .env.local and .env.production',
);
assert.match(
  safetySource,
  /\.(?:pem\|key\|p12\|pfx\|jks\|keystore)/,
  'The shared safety boundary must continue rejecting common private-key and keystore formats',
);

console.log('Workspace policy unification audit OK: imports and restored Lab workspaces share one sensitive-file boundary with no duplicate policy.');
