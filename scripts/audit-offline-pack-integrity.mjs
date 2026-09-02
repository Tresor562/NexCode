import fs from 'node:fs';

const source = fs.readFileSync('src/learning/offlineEngine.ts', 'utf8');

const required = [
  'export function offlinePackIntegrityIssue',
  "VALID_PACK_KINDS.includes(pack.kind)",
  'Number.isFinite(pack.estimatedMb)',
  'new Set(pack.chapterIds).size !== pack.chapterIds.length',
  'VALID_INCLUDES.has(entry)',
  'const integrityIssue = offlinePackIntegrityIssue(pack)',
  'if (offlinePackIntegrityIssue(pack)) return sum',
];

for (const marker of required) {
  if (!source.includes(marker)) {
    throw new Error(`Missing offline integrity guard: ${marker}`);
  }
}

if (/return sum \+ pack\.estimatedMb/.test(source) && !source.includes('if (offlinePackIntegrityIssue(pack)) return sum')) {
  throw new Error('Malformed offline packs can still affect storage estimates.');
}

console.log('Offline pack integrity audit passed.');
