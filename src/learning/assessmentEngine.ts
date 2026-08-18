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

export function chapterAssessment(course: Course, chapter: Chapter): AssessmentPlan {
  const explicit = chapter.lessonIds
    .map((id) => course.starterLessons.find((lesson) => lesson.id === id))
    .filter((lesson): lesson is Lesson => Boolean(lesson))
    .filter((lesson) => ['checkpoint', 'boss', 'project'].includes(lesson.activityKind ?? 'learn'));
  const lessonIds = explicit.length ? explicit.map((lesson) => lesson.id) : chapter.lessonIds.slice(-Math.min(3, chapter.lessonIds.length));
  const hasBoss = explicit.some((lesson) => lesson.activityKind === 'boss');
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
  return {
    id: `${course.id}.course-exam`,
    kind: 'course-exam',
    courseId: course.id,
    lessonIds: evidenceLessons.slice(-Math.max(8, Math.min(20, evidenceLessons.length))).map((lesson) => lesson.id),
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
