import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const source = fs.readFileSync('src/learning/offlineEngine.ts', 'utf8');

const required = [
  'export function offlinePackIntegrityIssue',
  'function isOfflinePackKind(value: unknown)',
  'function packIdentityScope(pack: OfflinePack)',
  'function packIdentityMatchesMetadata(pack: OfflinePack)',
  'function packIdentityMatchesCourseStructure(pack: OfflinePack, course: Course)',
  'const prefix = `${pack.courseId}:`',
  'const suffix = `:${pack.kind}:v${pack.curriculumVersion}`',
  'if (!packIdentityMatchesMetadata(pack))',
  'if (!packIdentityMatchesCourseStructure(pack, course))',
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
const {
  buildChapterOfflinePack,
  buildStageOfflinePack,
  estimateOfflineStorage,
  offlinePackIntegrityIssue,
  offlineUpdatePlan,
} = module.exports;

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
  assert.equal(offlineUpdatePlan([pack], [course])[0]?.action, 'keep', `${kind} chapter packs must remain structurally recognized`);
}

const stagePack = buildStageOfflinePack(course, 'foundation', 'standard');
assert.ok(stagePack, 'valid stage packs must remain accepted by the stronger identity contract');
assert.equal(offlinePackIntegrityIssue(stagePack), undefined);
assert.equal(offlineUpdatePlan([stagePack], [course])[0]?.action, 'keep', 'valid stage identities must remain bound to their chapter set');

const canonical = buildChapterOfflinePack(course, 'basics', 'standard');
assert.ok(canonical);
const forgedCourseId = { ...canonical, courseId: 'javascript' };
const forgedKindId = { ...canonical, kind: 'lite', includes: ['content', 'examples'] };
const forgedVersionId = { ...canonical, curriculumVersion: canonical.curriculumVersion + 1 };

for (const forged of [forgedCourseId, forgedKindId, forgedVersionId]) {
  assert.equal(
    offlinePackIntegrityIssue(forged),
    'Identité du pack incohérente avec ses métadonnées.',
    'restored metadata must not be allowed to reuse an id minted for another course/kind/version',
  );
  assert.equal(estimateOfflineStorage([forged]), 0, 'forged pack identities must never affect storage accounting');
  assert.equal(offlineUpdatePlan([forged], [course])[0]?.action, 'remove', 'forged pack identities must be removed before update planning');
}

const forgedScope = {
  ...canonical,
  id: `web:invented-scope:standard:v${course.curriculumVersion}`,
};
assert.equal(
  offlinePackIntegrityIssue(forgedScope),
  undefined,
  'generic restored-pack integrity can only validate self-consistent metadata before a curriculum is available',
);
assert.equal(
  offlineUpdatePlan([forgedScope], [course])[0]?.action,
  'remove',
  'a self-consistent id with a scope that was never minted by the course must not survive update planning',
);

const forgedChapterBinding = {
  ...canonical,
  id: `web:layout:standard:v${course.curriculumVersion}`,
  chapterIds: ['basics'],
};
assert.equal(
  offlineUpdatePlan([forgedChapterBinding], [course])[0]?.action,
  'remove',
  'chapter-scoped ids must describe exactly the chapter encoded in their identity',
);

const forgedStageBinding = {
  ...stagePack,
  chapterIds: ['basics'],
};
assert.equal(
  offlineUpdatePlan([forgedStageBinding], [course])[0]?.action,
  'remove',
  'stage-scoped ids must preserve the complete chapter set defined by the current course structure',
);

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

console.log('Offline pack integrity audit passed: runtime variants, metadata-bound identities, course-structure scope, restored-pack integrity and storage accounting are protected.');
