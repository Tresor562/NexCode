import { Chapter, Course, Lesson } from '../data/curriculumCore';
import { MasteryMap } from './skillGraph';
import { evaluateSkillGate } from './masteryEngine';

export type AssessmentKind = 'unit-check' | 'chapter-checkpoint' | 'boss' | 'mini-project' | 'course-exam';

export type AssessmentPlan = {
  id: string;
  kind: AssessmentKind;
  courseId: string;
  chapterId?: string;
  lessonIds: string[];
  skillIds: string[];
  requiredScore: number;
  requiresIndependentEvidence: boolean;
  recommendedMinutes: number;
};

function evenlySampleLessons(lessons: Lesson[], maxItems: number) {
  if (lessons.length <= maxItems) return lessons;
  if (maxItems <= 1) return lessons.slice(0, Math.max(0, maxItems));

  const lastIndex = lessons.length - 1;
  return Array.from({ length: maxItems }, (_, index) => {
    const sourceIndex = Math.round((index * lastIndex) / (maxItems - 1));
    return lessons[sourceIndex]!;
  });
}

function coverageSampleLessons(lessons: Lesson[], targetSkillIds: string[], maxItems: number) {
  if (maxItems <= 0 || lessons.length === 0) return [];
  if (lessons.length <= maxItems) return lessons;

  const selected = new Set<string>();
  const uncovered = new Set(targetSkillIds);

  while (selected.size < maxItems && uncovered.size > 0) {
    let best: Lesson | undefined;
    let bestCoverage = 0;

    for (const lesson of lessons) {
      if (selected.has(lesson.id)) continue;
      const coverage = (lesson.skillIds ?? []).reduce((count, skillId) => count + (uncovered.has(skillId) ? 1 : 0), 0);
      if (coverage > bestCoverage) {
        best = lesson;
        bestCoverage = coverage;
      }
    }

    if (!best || bestCoverage === 0) break;
    selected.add(best.id);
    for (const skillId of best.skillIds ?? []) uncovered.delete(skillId);
  }

  const remainingSlots = maxItems - selected.size;
  if (remainingSlots > 0) {
    const remaining = lessons.filter((lesson) => !selected.has(lesson.id));
    for (const lesson of evenlySampleLessons(remaining, remainingSlots)) selected.add(lesson.id);
  }

  return lessons.filter((lesson) => selected.has(lesson.id));
}

export function chapterAssessment(course: Course, chapter: Chapter): AssessmentPlan {
  const chapterLessons = chapter.lessonIds
    .map((id) => course.starterLessons.find((lesson) => lesson.id === id))
    .filter((lesson): lesson is Lesson => Boolean(lesson));
  const explicit = chapterLessons.filter((lesson) => ['checkpoint', 'boss', 'project'].includes(lesson.activityKind ?? 'learn'));
  const selectedLessons = explicit.length
    ? coverageSampleLessons(explicit, chapter.skillIds, Math.min(5, explicit.length))
    : coverageSampleLessons(chapterLessons, chapter.skillIds, Math.min(3, chapterLessons.length));
  const lessonIds = selectedLessons.map((lesson) => lesson.id);
  const hasBoss = selectedLessons.some((lesson) => lesson.activityKind === 'boss');
  return {
    id: `${chapter.id}.assessment`,
    kind: hasBoss ? 'boss' : 'chapter-checkpoint',
    courseId: course.id,
    chapterId: chapter.id,
    lessonIds,
    skillIds: chapter.skillIds,
    requiredScore: hasBoss ? 80 : 70,
    requiresIndependentEvidence: true,
    recommendedMinutes: Math.max(10, Math.round(chapter.estimatedMinutes * 0.2)),
  };
}

export function courseExam(course: Course): AssessmentPlan {
  const evidenceLessons = course.starterLessons.filter((lesson) => ['checkpoint', 'boss', 'project', 'lab'].includes(lesson.activityKind ?? 'learn'));
  const evidenceIds = new Set(evidenceLessons.map((lesson) => lesson.id));
  const candidates = [
    ...evidenceLessons,
    ...course.starterLessons.filter((lesson) => !evidenceIds.has(lesson.id)),
  ];
  const selectedLessons = coverageSampleLessons(candidates, course.skillIds, 20);
  return {
    id: `${course.id}.course-exam`,
    kind: 'course-exam',
    courseId: course.id,
    lessonIds: selectedLessons.map((lesson) => lesson.id),
    skillIds: course.skillIds,
    requiredScore: 80,
    requiresIndependentEvidence: true,
    recommendedMinutes: Math.min(120, Math.max(30, Math.round(course.estimatedHours * 5))),
  };
}

export function assessmentGate(plan: AssessmentPlan, mastery: MasteryMap, now = new Date()) {
  const result = evaluateSkillGate(plan.skillIds, mastery, plan.requiredScore, now);
  return {
    ...result,
    passed: result.passed && (!plan.requiresIndependentEvidence || result.missingIndependentEvidence.length === 0),
  };
}

export function assessmentReadiness(course: Course, mastery: MasteryMap, now = new Date()) {
  const chapters = course.chapters.map((chapter) => {
    const plan = chapterAssessment(course, chapter);
    const gate = assessmentGate(plan, mastery, now);
    return { chapterId: chapter.id, plan, gate };
  });
  const exam = courseExam(course);
  return { chapters, finalExam: { plan: exam, gate: assessmentGate(exam, mastery, now) } };
}
