import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const sourceUrl = new URL('../src/learning/assessmentEngine.ts', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
  fileName: 'assessmentEngine.ts',
}).outputText;

const exports = {};
const module = { exports };
const requireStub = (id) => {
  if (id === './masteryEngine') {
    return {
      evaluateSkillGate: () => ({
        passed: true,
        missingSkills: [],
        weakSkills: [],
        lowConfidenceSkills: [],
        missingIndependentEvidence: [],
      }),
    };
  }
  return {};
};
new Function('require', 'exports', 'module', compiled)(requireStub, exports, module);
const { courseExam } = module.exports;
assert.equal(typeof courseExam, 'function', 'courseExam must stay exported');

const makeLesson = (id, activityKind, skillIds) => ({
  id,
  title: id,
  activityKind,
  skillIds,
});

const orderedCourse = {
  id: 'ordered-course',
  estimatedHours: 4,
  skillIds: ['html', 'css', 'js'],
  chapters: [],
  starterLessons: [
    makeLesson('html-intro', 'learn', ['html']),
    makeLesson('html-checkpoint', 'checkpoint', ['html']),
    makeLesson('css-intro', 'learn', ['css']),
    makeLesson('js-lab', 'lab', ['js']),
  ],
};

assert.deepEqual(
  courseExam(orderedCourse).lessonIds,
  ['html-intro', 'html-checkpoint', 'css-intro', 'js-lab'],
  'course exams must preserve the pedagogical order of the course even when evidence activities are preferred',
);

const crowdedLessons = Array.from({ length: 22 }, (_, index) =>
  makeLesson(`lesson-${index + 1}`, index === 18 ? 'checkpoint' : 'learn', index === 18 ? ['critical-skill'] : ['shared-skill']),
);
const crowdedCourse = {
  id: 'crowded-course',
  estimatedHours: 10,
  skillIds: ['shared-skill', 'critical-skill'],
  chapters: [],
  starterLessons: crowdedLessons,
};
const crowdedExam = courseExam(crowdedCourse);
assert.equal(crowdedExam.lessonIds.length, 20, 'course exams must remain bounded to 20 activities');
assert.ok(crowdedExam.lessonIds.includes('lesson-19'), 'strong evidence must win an equal-coverage tie for a required skill');
const positions = crowdedExam.lessonIds.map((id) => crowdedLessons.findIndex((lesson) => lesson.id === id));
assert.deepEqual(
  positions,
  [...positions].sort((a, b) => a - b),
  'selected exam activities must remain in original course order',
);

console.log('Assessment sampling audit OK: final exams stay bounded, evidence-aware, skill-covering and course-ordered.');
