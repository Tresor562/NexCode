import fs from 'node:fs';

const importSource = fs.readFileSync(new URL('../src/lib/workspaceImport.ts', import.meta.url), 'utf8');
const safetySource = fs.readFileSync(new URL('../src/lib/workspaceSafety.ts', import.meta.url), 'utf8');

const requiredMarkers = [
  'LIKELY_SECRET_PATTERNS',
  'containsLikelyWorkspaceSecret',
  '-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
  'gh[pousr]_',
  'sk_live|rk_live',
  'xox[baprs]-',
  'AKIA|ASIA',
  'AIza',
];

for (const marker of requiredMarkers) {
  if (!safetySource.includes(marker)) {
    throw new Error(`Lab import secret safety regression: shared guard missing ${marker}`);
  }
}

if (!importSource.includes('containsLikelyWorkspaceSecret(text)')) {
  throw new Error('Lab imports must use the shared workspace secret guard.');
}

if (!/async function readTextFile[\s\S]*containsLikelyWorkspaceSecret\(text\)[\s\S]*return null/.test(importSource)) {
  throw new Error('Lab imports must reject likely secrets before files enter the workspace.');
}

if (!/importFilesFromPhone[\s\S]*readTextFile\(file\)/.test(importSource)) {
  throw new Error('Multi-file phone imports must pass through the secret-safe text reader.');
}

if (!/importFolderFromPhone[\s\S]*readTextFile\(entry\)/.test(importSource)) {
  throw new Error('Folder imports must pass through the secret-safe text reader.');
}

console.log('✓ Lab imports reuse the shared secret guard before workspace persistence/sync');
