import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const sourceUrl = new URL('../src/lib/localState.ts', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
  fileName: 'localState.ts',
}).outputText;

const fakeFile = {
  exists: true,
  create() {},
  write() {},
  textSync() { return ''; },
};
const exports = {};
const module = { exports };
const requireStub = (id) => {
  if (id === 'expo-file-system') {
    return {
      File: class { constructor() { return fakeFile; } },
      Paths: { document: '/tmp' },
    };
  }
  if (id.endsWith('/skillGraph') || id === '../learning/skillGraph') {
    return { masteryBand: () => 'practicing' };
  }
  if (id === './cloudSync') return { scheduleCloudStatePush() {} };
  return {};
};

new Function('require', 'exports', 'module', compiled)(requireStub, exports, module);
const { sanitizeLocalState } = module.exports;
assert.equal(typeof sanitizeLocalState, 'function', 'sanitizeLocalState must stay exported');

const sanitized = sanitizeLocalState({
  projectProgress: {
    healthy: 67,
    oversized: 180,
    negative: -30,
    broken: Number.NaN,
  },
  installedOfflinePacks: [
    {
      id: 'html:chapter-1:standard:v3',
      courseId: 'html',
      kind: 'standard',
      chapterIds: ['intro', 'intro', 'layout'],
      estimatedMb: 12.8,
      includes: ['content', 'examples', 'content', 'unknown-capability'],
      curriculumVersion: 3,
    },
    {
      id: 'html:chapter-1:standard:v3',
      courseId: 'other',
      kind: 'full',
      chapterIds: ['ignored-duplicate'],
      estimatedMb: 999,
      includes: ['media'],
      curriculumVersion: 9,
    },
    {
      id: 'bad-kind',
      courseId: 'html',
      kind: 'ultra',
      chapterIds: ['intro'],
      estimatedMb: 5,
      includes: ['content'],
      curriculumVersion: 3,
    },
  ],
  portfolioProofs: [
    {
      projectId: ' portfolio-card ',
      title: ' Carte accessible\u0000 ',
      completedAt: '2026-08-27T03:00:00Z',
      score: 140,
      skillIds: ['html', 'html', ' css '],
      rubricIds: ['structure', 'structure'],
      evidenceSummary: '  Projet validé\u0007  ',
    },
    {
      projectId: 'missing-date',
      title: 'Invalide',
      completedAt: 'not-a-date',
      score: 90,
      skillIds: [],
      rubricIds: [],
      evidenceSummary: 'invalid',
    },
  ],
});

assert.deepEqual(sanitized.projectProgress, {
  healthy: 67,
  oversized: 100,
  negative: 0,
}, 'project progress must stay finite and bounded to 0..100');

assert.equal(sanitized.installedOfflinePacks.length, 1, 'invalid and duplicate offline packs must be dropped');
assert.deepEqual(sanitized.installedOfflinePacks[0], {
  id: 'html:chapter-1:standard:v3',
  courseId: 'html',
  kind: 'standard',
  chapterIds: ['intro', 'layout'],
  estimatedMb: 12,
  includes: ['content', 'examples'],
  curriculumVersion: 3,
});

assert.equal(sanitized.portfolioProofs.length, 1, 'portfolio proofs with invalid identity/date must be dropped');
assert.deepEqual(sanitized.portfolioProofs[0], {
  projectId: 'portfolio-card',
  title: 'Carte accessible',
  completedAt: '2026-08-27T03:00:00.000Z',
  score: 100,
  skillIds: ['html', 'css'],
  rubricIds: ['structure'],
  evidenceSummary: 'Projet validé',
});

const polluted = Object.create({ projectProgress: { bypass: 100 } });
assert.deepEqual(sanitizeLocalState(polluted).projectProgress, {}, 'prototype-inherited persisted state must fail closed');

console.log('Local state sanitization audit OK: project progress, offline packs and portfolio proofs are bounded, canonical and fail-closed.');
