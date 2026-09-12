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

const makeLesson = (id, activityKind, skillIds) => ({ id, title: id, activityKind, skillIds });
const chapters = Array.from({ length: 10 }, (_, chapterIndex) => {
  const chapterId = `chapter-${chapterIndex + 1}`;
  return {
    id: chapterId,
    title: chapterId,
    skillIds: ['shared-skill'],
    estimatedMinutes: 60,
    lessonIds: [`${chapterId}-intro`, `${chapterId}-checkpoint`],
  };
});
const starterLessons = chapters.flatMap((chapter) => [
  makeLesson(chapter.lessonIds[0], 'learn', ['shared-skill']),
  makeLesson(chapter.lessonIds[1], 'checkpoint', ['shared-skill']),
]);
const course = {
  id: 'chapter-balanced-course',
  estimatedHours: 10,
  skillIds: ['shared-skill'],
  chapters,
  starterLessons,
};
const exam = courseExam(course);
assert.equal(exam.lessonIds.length, 20, 'a 20-lesson course may use the full focused exam budget');
for (const chapter of chapters) {
  assert.ok(
    chapter.lessonIds.some((lessonId) => exam.lessonIds.includes(lessonId)),
    `final exam must represent ${chapter.id} instead of over-sampling early chapters`,
  );
  assert.ok(
    exam.lessonIds.includes(chapter.lessonIds[1]),
    `equal-skill chapter representative should prefer checkpoint evidence for ${chapter.id}`,
  );
}

const manyChapters = Array.from({ length: 25 }, (_, index) => ({
  id: `wide-${index + 1}`,
  title: `wide-${index + 1}`,
  skillIds: ['shared-skill'],
  estimatedMinutes: 30,
  lessonIds: [`wide-${index + 1}-lesson`],
}));
const wideCourse = {
  id: 'wide-course',
  estimatedHours: 12,
  skillIds: ['shared-skill'],
  chapters: manyChapters,
  starterLessons: manyChapters.map((chapter) => makeLesson(chapter.lessonIds[0], 'learn', ['shared-skill'])),
};
const wideExam = courseExam(wideCourse);
assert.equal(wideExam.lessonIds.length, 20, 'chapter balancing must never exceed the 20-item final exam cap');
assert.ok(wideExam.lessonIds.includes('wide-1-lesson'), 'bounded chapter sampling must retain the beginning of a long course');
assert.ok(wideExam.lessonIds.includes('wide-25-lesson'), 'bounded chapter sampling must retain the end of a long course');
const positions = wideExam.lessonIds.map((id) => wideCourse.starterLessons.findIndex((lesson) => lesson.id === id));
assert.deepEqual(positions, [...positions].sort((a, b) => a - b), 'chapter balancing must preserve original pedagogical order');

console.log('Course exam chapter balance audit OK: final exams represent the full learning journey, prefer evidence on equal coverage, remain ordered, and stay capped at 20 activities.');
