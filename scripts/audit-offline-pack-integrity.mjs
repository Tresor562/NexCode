import fs from 'node:fs';

const source = fs.readFileSync('src/learning/offlineEngine.ts', 'utf8');

const required = [
  'export function offlinePackIntegrityIssue',
  "VALID_PACK_KINDS.includes(pack.kind)",
  'Number.isFinite(pack.estimatedMb)',
  'pack.estimatedMb > MAX_ESTIMATED_MB',
  'pack.chapterIds.length > MAX_PACK_CHAPTERS',
  'chapterId.trim() !== chapterId',
  'chapterId.length > MAX_CHAPTER_ID_CHARS',
  'new Set(pack.chapterIds).size !== pack.chapterIds.length',
  'VALID_INCLUDES.has(entry)',
  'includeSet.size !== pack.includes.length',
  'const expectedIncludes = packIncludes(pack.kind)',
  'expectedIncludes.some((entry) => !includeSet.has(entry))',
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

if (!source.includes("return 'Contenu du pack incompatible avec sa variante.'")) {
  throw new Error('Lite/standard/full packs are no longer semantically bound to their expected resources.');
}

console.log('Offline pack integrity audit passed.');
