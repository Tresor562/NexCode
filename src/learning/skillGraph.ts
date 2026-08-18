import { Course, Lesson, MasteryBand } from '../data/curriculumCore';

export type SkillNode = {
  id: string;
  title: string;
  courseIds: string[];
  prerequisiteIds: string[];
  lessonIds: string[];
  evidenceLessonIds: string[];
};

export type AttemptEvidence = {
  lessonId: string;
  activityKind: string;
  correct: boolean;
  scoreDelta: number;
  at: string;
  errorTag?: string;
};

export type SkillMastery = {
  skillId: string;
  score: number;
  confidence: number;
  band: MasteryBand;
  attempts: number;
  correctAttempts: number;
  consecutiveCorrect: number;
  lastPracticedAt?: string;
  nextReviewAt?: string;
  errorTags: string[];
  evidence: AttemptEvidence[];
};

export type MasteryMap = Record<string, SkillMastery>;

export function masteryBand(score: number): MasteryBand {
  if (score >= 85) return 'mastered';
  if (score >= 55) return 'practicing';
  if (score > 0) return 'learning';
  return 'new';
}

export function buildSkillGraph(courses: Course[]): SkillNode[] {
  const nodes = new Map<string, SkillNode>();
  for (const course of courses) {
    for (const lesson of course.starterLessons) {
      for (const skillId of lesson.skillIds ?? []) {
        const current = nodes.get(skillId);
        const prerequisiteIds = lesson.prerequisiteSkillIds ?? [];
        const isEvidence = ['lab', 'checkpoint', 'boss', 'project'].includes(lesson.activityKind ?? 'learn');
        if (current) {
          current.lessonIds = [...new Set([...current.lessonIds, lesson.id])];
          current.courseIds = [...new Set([...current.courseIds, course.id])];
          current.prerequisiteIds = [...new Set([...current.prerequisiteIds, ...prerequisiteIds])];
          if (isEvidence) current.evidenceLessonIds = [...new Set([...current.evidenceLessonIds, lesson.id])];
        } else {
          nodes.set(skillId, {
            id: skillId,
            title: lesson.module,
            courseIds: [course.id],
            prerequisiteIds,
            lessonIds: [lesson.id],
            evidenceLessonIds: isEvidence ? [lesson.id] : [],
          });
        }
      }
    }
  }
  return [...nodes.values()];
}

function qualityWeight(lesson: Lesson, correct: boolean) {
  if (!correct) return -18;
  const kind = lesson.activityKind ?? 'learn';
  if (kind === 'boss') return 28;
  if (kind === 'checkpoint') return 24;
  if (kind === 'lab') return 20;
  if (kind === 'review') return 18;
  if (kind === 'practice') return 14;
  return 10;
}

function nextReviewDays(score: number, consecutiveCorrect: number, correct: boolean) {
  if (!correct) return 1;
  if (score >= 90 && consecutiveCorrect >= 3) return 21;
  if (score >= 85) return 14;
  if (score >= 70) return 7;
  if (score >= 55) return 3;
  return 1;
}

export function recordSkillAttempt(
  map: MasteryMap,
  lesson: Lesson,
  correct: boolean,
  now = new Date(),
  errorTag?: string,
): MasteryMap {
  const next = { ...map };
  for (const skillId of lesson.skillIds ?? []) {
    const previous = next[skillId] ?? {
      skillId,
      score: 0,
      confidence: 0,
      band: 'new' as const,
      attempts: 0,
      correctAttempts: 0,
      consecutiveCorrect: 0,
      errorTags: [],
      evidence: [],
    };
    const attempts = previous.attempts + 1;
    const correctAttempts = previous.correctAttempts + (correct ? 1 : 0);
    const consecutiveCorrect = correct ? previous.consecutiveCorrect + 1 : 0;
    const delta = qualityWeight(lesson, correct);
    const score = Math.max(0, Math.min(100, previous.score + delta));
    const confidence = Math.max(0, Math.min(100, Math.round((correctAttempts / attempts) * 70 + Math.min(attempts, 10) * 3)));
    const reviewDays = nextReviewDays(score, consecutiveCorrect, correct);
    const nextReview = new Date(now);
    nextReview.setDate(nextReview.getDate() + reviewDays);
    const evidence: AttemptEvidence = {
      lessonId: lesson.id,
      activityKind: lesson.activityKind ?? 'learn',
      correct,
      scoreDelta: delta,
      at: now.toISOString(),
      errorTag: !correct ? errorTag : undefined,
    };
    next[skillId] = {
      ...previous,
      score,
      confidence,
      band: masteryBand(score),
      attempts,
      correctAttempts,
      consecutiveCorrect,
      lastPracticedAt: now.toISOString(),
      nextReviewAt: nextReview.toISOString(),
      errorTags: errorTag && !correct ? [...new Set([...previous.errorTags, errorTag])].slice(-8) : previous.errorTags,
      evidence: [...previous.evidence, evidence].slice(-20),
    };
  }
  return next;
}

export function prerequisitesReady(node: SkillNode, mastery: MasteryMap, gate = 55) {
  return node.prerequisiteIds.every((id) => (mastery[id]?.score ?? 0) >= gate);
}

export function skillNeedsEvidence(node: SkillNode, mastery: MasteryMap) {
  const state = mastery[node.id];
  if (!state || state.score < 55) return true;
  return !state.evidence.some((item) => item.correct && ['lab', 'checkpoint', 'boss', 'project'].includes(item.activityKind));
}

export function courseMastery(course: Course, mastery: MasteryMap): number {
  if (course.skillIds.length === 0) return 0;
  const total = course.skillIds.reduce((sum, id) => sum + (mastery[id]?.score ?? 0), 0);
  return Math.round(total / course.skillIds.length);
}

export function weakSkillIds(course: Course, mastery: MasteryMap, threshold = 55) {
  return course.skillIds.filter((id) => (mastery[id]?.score ?? 0) < threshold);
}
