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

const BASE_CHAPTER_ASSESSMENT_ITEMS = 3;
const BASE_EVIDENCE_CHAPTER_ASSESSMENT_ITEMS = 5;
const MAX_CHAPTER_ASSESSMENT_ITEMS = 8;
const MAX_COURSE_EXAM_ITEMS = 20;
const ASSESSMENT_MINUTES_PER_ITEM = 3;
const MIN_CHAPTER_ASSESSMENT_MINUTES = 8;
const MAX_CHAPTER_ASSESSMENT_MINUTES = 24;
const MIN_COURSE_EXAM_MINUTES = 20;
const MAX_COURSE_EXAM_MINUTES = 60;
const EVIDENCE_ACTIVITY_KINDS = new Set(['checkpoint', 'boss', 'project', 'lab']);

function uniqueSkillIds(skillIds: string[]): string[] {
  return [...new Set(skillIds.map((skillId) => skillId.trim()).filter(Boolean))];
}

function evenlySample<T>(items: T[], maxItems: number): T[] {
  if (items.length <= maxItems) return items;
  if (maxItems <= 1) return items.slice(0, Math.max(0, maxItems));

  const lastIndex = items.length - 1;
  return Array.from({ length: maxItems }, (_, index) => {
    const sourceIndex = Math.round((index * lastIndex) / (maxItems - 1));
    return items[sourceIndex]!;
  });
}

function coverageSampleLessons(
  lessons: Lesson[],
  targetSkillIds: string[],
  maxItems: number,
  preferredLessonIds = new Set<string>(),
  requiredLessonIds = new Set<string>(),
) {
  if (maxItems <= 0 || lessons.length === 0) return [];
  if (lessons.length <= maxItems) return lessons;

  const selected = new Set<string>();
  const uncovered = new Set(uniqueSkillIds(targetSkillIds));

  for (const lesson of lessons) {
    if (selected.size >= maxItems) break;
    if (!requiredLessonIds.has(lesson.id)) continue;
    selected.add(lesson.id);
    for (const skillId of uniqueSkillIds(lesson.skillIds ?? [])) uncovered.delete(skillId);
  }

  while (selected.size < maxItems && uncovered.size > 0) {
    let best: Lesson | undefined;
    let bestCoverage = 0;
    let bestPreferred = false;

    for (const lesson of lessons) {
      if (selected.has(lesson.id)) continue;
      const coverage = uniqueSkillIds(lesson.skillIds ?? []).reduce(
        (count, skillId) => count + (uncovered.has(skillId) ? 1 : 0),
        0,
      );
      const preferred = preferredLessonIds.has(lesson.id);
      if (coverage > bestCoverage || (coverage === bestCoverage && coverage > 0 && preferred && !bestPreferred)) {
        best = lesson;
        bestCoverage = coverage;
        bestPreferred = preferred;
      }
    }

    if (!best || bestCoverage === 0) break;
    selected.add(best.id);
    for (const skillId of uniqueSkillIds(best.skillIds ?? [])) uncovered.delete(skillId);
  }

  const remainingSlots = maxItems - selected.size;
  if (remainingSlots > 0) {
    const remaining = lessons.filter((lesson) => !selected.has(lesson.id));
    const preferredRemaining = remaining.filter((lesson) => preferredLessonIds.has(lesson.id));
    const preferredSample = evenlySample(preferredRemaining, Math.min(remainingSlots, preferredRemaining.length));
    for (const lesson of preferredSample) selected.add(lesson.id);

    const fallbackSlots = maxItems - selected.size;
    if (fallbackSlots > 0) {
      const fallbackRemaining = lessons.filter((lesson) => !selected.has(lesson.id));
      for (const lesson of evenlySample(fallbackRemaining, fallbackSlots)) selected.add(lesson.id);
    }
  }

  return lessons.filter((lesson) => selected.has(lesson.id));
}

function courseChapterRepresentativeIds(course: Course, maxItems: number) {
  if (maxItems <= 0 || course.chapters.length === 0) return new Set<string>();

  const lessonById = new Map(course.starterLessons.map((lesson) => [lesson.id, lesson]));
  const populatedChapters = course.chapters
    .map((chapter) => ({
      chapter,
      lessons: chapter.lessonIds
        .map((lessonId) => lessonById.get(lessonId))
        .filter((lesson): lesson is Lesson => Boolean(lesson)),
    }))
    .filter(({ lessons }) => lessons.length > 0);

  const selectedChapters = evenlySample(populatedChapters, Math.min(maxItems, populatedChapters.length));
  const required = new Set<string>();

  for (const { lessons } of selectedChapters) {
    let representative = lessons[0]!;
    let bestSkillCoverage = -1;
    let bestEvidence = false;

    for (const lesson of lessons) {
      const skillCoverage = uniqueSkillIds(lesson.skillIds ?? []).length;
      const evidence = EVIDENCE_ACTIVITY_KINDS.has(lesson.activityKind ?? 'learn');
      if (skillCoverage > bestSkillCoverage || (skillCoverage === bestSkillCoverage && evidence && !bestEvidence)) {
        representative = lesson;
        bestSkillCoverage = skillCoverage;
        bestEvidence = evidence;
      }
    }
    required.add(representative.id);
  }

  return required;
}

function chapterAssessmentItemBudget(chapter: Chapter, lessonCount: number, hasExplicitEvidence: boolean): number {
  if (lessonCount <= 0) return 0;
  const baseline = hasExplicitEvidence
    ? BASE_EVIDENCE_CHAPTER_ASSESSMENT_ITEMS
    : BASE_CHAPTER_ASSESSMENT_ITEMS;
  const uniqueSkillCount = uniqueSkillIds(chapter.skillIds).length;
  const skillCoverageBudget = Math.min(uniqueSkillCount, MAX_CHAPTER_ASSESSMENT_ITEMS);
  return Math.min(lessonCount, MAX_CHAPTER_ASSESSMENT_ITEMS, Math.max(baseline, skillCoverageBudget));
}

function assessmentMinutes(itemCount: number, minimum: number, maximum: number): number {
  if (itemCount <= 0) return minimum;
  return Math.min(maximum, Math.max(minimum, itemCount * ASSESSMENT_MINUTES_PER_ITEM));
}

export function chapterAssessment(course: Course, chapter: Chapter): AssessmentPlan {
  const chapterLessons = chapter.lessonIds
    .map((id) => course.starterLessons.find((lesson) => lesson.id === id))
    .filter((lesson): lesson is Lesson => Boolean(lesson));
  const skillIds = uniqueSkillIds(chapter.skillIds);
  const explicit = chapterLessons.filter((lesson) => EVIDENCE_ACTIVITY_KINDS.has(lesson.activityKind ?? 'learn'));
  const explicitIds = new Set(explicit.map((lesson) => lesson.id));
  const selectedLessons = coverageSampleLessons(
    chapterLessons,
    skillIds,
    chapterAssessmentItemBudget(chapter, chapterLessons.length, explicit.length > 0),
    explicitIds,
  );
  const lessonIds = selectedLessons.map((lesson) => lesson.id);
  const hasBoss = selectedLessons.some((lesson) => lesson.activityKind === 'boss');
  return {
    id: `${chapter.id}.assessment`,
    kind: hasBoss ? 'boss' : 'chapter-checkpoint',
    courseId: course.id,
    chapterId: chapter.id,
    lessonIds,
    skillIds,
    requiredScore: hasBoss ? 80 : 70,
    requiresIndependentEvidence: true,
    recommendedMinutes: assessmentMinutes(
      selectedLessons.length,
      MIN_CHAPTER_ASSESSMENT_MINUTES,
      MAX_CHAPTER_ASSESSMENT_MINUTES,
    ),
  };
}

export function courseExam(course: Course): AssessmentPlan {
  const skillIds = uniqueSkillIds(course.skillIds);
  const evidenceLessons = course.starterLessons.filter((lesson) => EVIDENCE_ACTIVITY_KINDS.has(lesson.activityKind ?? 'learn'));
  const evidenceIds = new Set(evidenceLessons.map((lesson) => lesson.id));
  const chapterRepresentativeIds = courseChapterRepresentativeIds(course, MAX_COURSE_EXAM_ITEMS);
  const selectedLessons = coverageSampleLessons(
    course.starterLessons,
    skillIds,
    MAX_COURSE_EXAM_ITEMS,
    evidenceIds,
    chapterRepresentativeIds,
  );
  return {
    id: `${course.id}.course-exam`,
    kind: 'course-exam',
    courseId: course.id,
    lessonIds: selectedLessons.map((lesson) => lesson.id),
    skillIds,
    requiredScore: 80,
    requiresIndependentEvidence: true,
    recommendedMinutes: assessmentMinutes(
      selectedLessons.length,
      MIN_COURSE_EXAM_MINUTES,
      MAX_COURSE_EXAM_MINUTES,
    ),
  };
}

export function assessmentGate(plan: AssessmentPlan, mastery: MasteryMap, now = new Date()) {
  const result = evaluateSkillGate(uniqueSkillIds(plan.skillIds), mastery, plan.requiredScore, now);
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
