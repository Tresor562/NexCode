import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const source = fs.readFileSync('src/learning/offlineEngine.ts', 'utf8');

const required = [
  'export function offlinePackIntegrityIssue',
  'function isOfflinePackKind(value: unknown)',
  'if (!isOfflinePackKind(kind)) return undefined',
  'if (!isOfflinePackKind(pack.kind))',
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

const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
  fileName: 'offlineEngine.ts',
}).outputText;

const exports = {};
const module = { exports };
new Function('require', 'exports', 'module', compiled)(() => ({}), exports, module);
const { buildChapterOfflinePack, buildStageOfflinePack, offlinePackIntegrityIssue } = module.exports;

const course = {
  id: 'web',
  title: 'Web',
  curriculumVersion: 3,
  offlineSizeMb: 120,
  starterLessons: [{ id: 'l1' }, { id: 'l2' }],
  chapters: [
    { id: 'basics', lessonIds: ['l1'] },
    { id: 'layout', lessonIds: ['l2'] },
  ],
  stages: [{ id: 'foundation', chapterIds: ['basics', 'layout'] }],
};

for (const kind of ['lite', 'standard', 'full']) {
  const pack = buildChapterOfflinePack(course, 'basics', kind);
  assert.ok(pack, `${kind} must remain a valid chapter pack variant`);
  assert.equal(pack.kind, kind);
  assert.equal(offlinePackIntegrityIssue(pack), undefined);
}

assert.equal(
  buildChapterOfflinePack(course, 'basics', 'light'),
  undefined,
  'legacy/unknown runtime variants must fail closed instead of becoming a full pack',
);
assert.equal(
  buildStageOfflinePack(course, 'foundation', 'surprise'),
  undefined,
  'stage builders must reject malformed runtime variants before constructing child packs',
);

console.log('Offline pack integrity audit passed: runtime variant boundaries, restored-pack integrity and storage accounting are protected.');
