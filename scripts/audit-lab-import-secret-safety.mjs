import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/lib/workspaceImport.ts', import.meta.url), 'utf8');

const requiredMarkers = [
  'IMPORT_SECRET_PATTERNS',
  'containsLikelySecret',
  'containsLikelySecret(text)',
  '-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
  'gh[pousr]_',
  'sk_live|rk_live',
  'xox[baprs]-',
  'AKIA|ASIA',
  'AIza',
];

for (const marker of requiredMarkers) {
  if (!source.includes(marker)) {
    throw new Error(`Lab import secret safety regression: missing ${marker}`);
  }
}

if (!/async function readTextFile[\s\S]*containsLikelySecret\(text\)[\s\S]*return null/.test(source)) {
  throw new Error('Lab imports must reject likely secrets before files enter the workspace.');
}

if (!/importFilesFromPhone[\s\S]*readTextFile\(file\)/.test(source)) {
  throw new Error('Multi-file phone imports must pass through the secret-safe text reader.');
}

if (!/importFolderFromPhone[\s\S]*readTextFile\(entry\)/.test(source)) {
  throw new Error('Folder imports must pass through the secret-safe text reader.');
}

console.log('✓ Lab imports reject obvious secrets before workspace persistence/sync');
