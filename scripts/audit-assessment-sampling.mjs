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
const { chapterAssessment, courseExam } = module.exports;
assert.equal(typeof chapterAssessment, 'function', 'chapterAssessment must stay exported');
assert.equal(typeof courseExam, 'function', 'courseExam must stay exported');

const makeLesson = (id, activityKind, skillIds) => ({
  id,
  title: id,
  activityKind,
  skillIds,
});

const chapterLessons = [
  makeLesson('html-checkpoint', 'checkpoint', ['html']),
  makeLesson('css-practice', 'learn', ['css']),
  makeLesson('js-project', 'project', ['js']),
  makeLesson('review', 'learn', ['html']),
];
const mixedChapter = {
  id: 'mixed-chapter',
  title: 'mixed-chapter',
  lessonIds: chapterLessons.map((lesson) => lesson.id),
  skillIds: ['html', 'css', 'js'],
  estimatedMinutes: 90,
};
const mixedCourse = {
  id: 'mixed-course',
  estimatedHours: 4,
  skillIds: mixedChapter.skillIds,
  chapters: [mixedChapter],
  starterLessons: chapterLessons,
};
const mixedPlan = chapterAssessment(mixedCourse, mixedChapter);
assert.deepEqual(
  mixedPlan.lessonIds,
  ['html-checkpoint', 'css-practice', 'js-project', 'review'],
  'chapter assessments must preserve chapter order while filling skills not covered by explicit evidence activities',
);
assert.ok(mixedPlan.lessonIds.includes('css-practice'), 'normal lessons must fill uncovered chapter skills instead of being dropped when explicit evidence exists');

const broadSkills = Array.from({ length: 7 }, (_, index) => `skill-${index + 1}`);
const broadLessons = broadSkills.map((skillId, index) =>
  makeLesson(`broad-${index + 1}`, index === 0 ? 'checkpoint' : 'learn', [skillId]),
);
const broadChapter = {
  id: 'broad-chapter',
  title: 'broad-chapter',
  lessonIds: broadLessons.map((lesson) => lesson.id),
  skillIds: broadSkills,
  estimatedMinutes: 140,
};
const broadCourse = {
  id: 'broad-course',
  estimatedHours: 6,
  skillIds: broadSkills,
  chapters: [broadChapter],
  starterLessons: broadLessons,
};
const broadPlan = chapterAssessment(broadCourse, broadChapter);
assert.equal(broadPlan.lessonIds.length, 7, 'chapter assessments must grow beyond the five-item baseline when more slots are needed to represent required skills');
assert.deepEqual(broadPlan.lessonIds, broadLessons.map((lesson) => lesson.id), 'a seven-skill chapter with one lesson per skill must keep complete skill coverage');

const oversizedSkills = Array.from({ length: 12 }, (_, index) => `oversized-skill-${index + 1}`);
const oversizedLessons = oversizedSkills.map((skillId, index) => makeLesson(`oversized-${index + 1}`, 'learn', [skillId]));
const oversizedChapter = {
  id: 'oversized-chapter',
  title: 'oversized-chapter',
  lessonIds: oversizedLessons.map((lesson) => lesson.id),
  skillIds: oversizedSkills,
  estimatedMinutes: 240,
};
const oversizedCourse = {
  id: 'oversized-course',
  estimatedHours: 8,
  skillIds: oversizedSkills,
  chapters: [oversizedChapter],
  starterLessons: oversizedLessons,
};
assert.equal(
  chapterAssessment(oversizedCourse, oversizedChapter).lessonIds.length,
  8,
  'chapter assessments must remain premium and focused instead of expanding beyond eight activities',
);

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

console.log('Assessment sampling audit OK: chapter and final assessments stay evidence-aware, skill-covering, adaptively bounded and course-ordered.');
