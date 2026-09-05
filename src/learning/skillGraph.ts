import { Course, Lesson, MasteryBand } from '../data/curriculumCore';
import { prerequisiteRuleMap } from './skillPrerequisites';

export type SkillNode = {
  id: string;
  title: string;
  courseIds: string[];
  prerequisiteIds: string[];
  prerequisiteGate: number;
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
  const policy = prerequisiteRuleMap();
  for (const course of courses) {
    for (const lesson of course.starterLessons) {
      for (const skillId of lesson.skillIds ?? []) {
        const current = nodes.get(skillId);
        const policyRule = policy.get(skillId);
        const prerequisiteIds = [...new Set([...(lesson.prerequisiteSkillIds ?? []), ...(policyRule?.requires ?? [])])];
        const isEvidence = ['lab', 'checkpoint', 'boss', 'project'].includes(lesson.activityKind ?? 'learn');
        if (current) {
          current.lessonIds = [...new Set([...current.lessonIds, lesson.id])];
          current.courseIds = [...new Set([...current.courseIds, course.id])];
          current.prerequisiteIds = [...new Set([...current.prerequisiteIds, ...prerequisiteIds])];
          current.prerequisiteGate = Math.max(current.prerequisiteGate, policyRule?.minimumScore ?? 55);
          if (isEvidence) current.evidenceLessonIds = [...new Set([...current.evidenceLessonIds, lesson.id])];
        } else {
          nodes.set(skillId, {
            id: skillId,
            title: lesson.module,
            courseIds: [course.id],
            prerequisiteIds,
            prerequisiteGate: policyRule?.minimumScore ?? 55,
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

function boundedCount(value: unknown, maximum = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(maximum, Math.floor(value)));
}

function boundedScore(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : 0;
}

function usableAttemptTime(now: Date) {
  return Number.isFinite(now.getTime()) ? now : new Date();
}

function latestPracticedTime(map: MasteryMap, skillIds: string[]) {
  let latest = Number.NEGATIVE_INFINITY;
  for (const skillId of skillIds) {
    const timestamp = new Date(map[skillId]?.lastPracticedAt ?? '').getTime();
    if (Number.isFinite(timestamp)) latest = Math.max(latest, timestamp);
  }
  return latest;
}

function monotonicAttemptTime(map: MasteryMap, lesson: Lesson, candidate: Date) {
  const candidateMs = candidate.getTime();
  const latestMs = latestPracticedTime(map, lesson.skillIds ?? []);
  if (!Number.isFinite(latestMs) || candidateMs > latestMs) return candidate;
  return new Date(latestMs + 1);
}

export function masteryConfidence(attempts: number, correctAttempts: number) {
  if (!Number.isFinite(attempts) || !Number.isFinite(correctAttempts) || attempts <= 0 || correctAttempts <= 0) return 0;
  const boundedAttempts = Math.max(0, Math.floor(attempts));
  const boundedCorrect = Math.max(0, Math.min(boundedAttempts, Math.floor(correctAttempts)));
  if (boundedAttempts === 0 || boundedCorrect === 0) return 0;

  // Confidence should represent repeated evidence, not a single lucky answer.
  // The previous formula produced 73% confidence after one correct attempt,
  // which was enough to satisfy the mastery confidence gate immediately.
  // Evidence depth now ramps over the first four attempts and observed
  // accuracy scales the whole confidence budget. A learner therefore needs
  // several consistent attempts before confidence can cross the 70% gate.
  const accuracy = boundedCorrect / boundedAttempts;
  const evidenceDepth = Math.min(1, boundedAttempts / 4);
  const depthBudget = 70 * evidenceDepth;
  const repetitionBudget = Math.min(boundedAttempts, 10) * 3;
  return Math.max(0, Math.min(100, Math.round(accuracy * (depthBudget + repetitionBudget))));
}

export function recordSkillAttempt(
  map: MasteryMap,
  lesson: Lesson,
  correct: boolean,
  now = new Date(),
  errorTag?: string,
): MasteryMap {
  const next = { ...map };
  const attemptTime = monotonicAttemptTime(map, lesson, usableAttemptTime(now));
  const attemptIso = attemptTime.toISOString();
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
    const previousAttempts = boundedCount(previous.attempts);
    const previousCorrectAttempts = boundedCount(previous.correctAttempts, previousAttempts);
    const previousConsecutiveCorrect = boundedCount(previous.consecutiveCorrect, previousAttempts);
    const previousScore = boundedScore(previous.score);
    const previousErrorTags = Array.isArray(previous.errorTags) ? previous.errorTags.filter((tag) => typeof tag === 'string') : [];
    const previousEvidence = Array.isArray(previous.evidence) ? previous.evidence : [];
    const attempts = previousAttempts + 1;
    const correctAttempts = Math.min(attempts, previousCorrectAttempts + (correct ? 1 : 0));
    const consecutiveCorrect = correct ? Math.min(attempts, previousConsecutiveCorrect + 1) : 0;
    const delta = qualityWeight(lesson, correct);
    const score = Math.max(0, Math.min(100, previousScore + delta));
    const confidence = masteryConfidence(attempts, correctAttempts);
    const reviewDays = nextReviewDays(score, consecutiveCorrect, correct);
    const nextReview = new Date(attemptTime);
    nextReview.setDate(nextReview.getDate() + reviewDays);
    const evidence: AttemptEvidence = {
      lessonId: lesson.id,
      activityKind: lesson.activityKind ?? 'learn',
      correct,
      scoreDelta: delta,
      at: attemptIso,
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
      lastPracticedAt: attemptIso,
      nextReviewAt: nextReview.toISOString(),
      errorTags: errorTag && !correct ? [...new Set([...previousErrorTags, errorTag])].slice(-8) : previousErrorTags,
      evidence: [...previousEvidence, evidence].slice(-20),
    };
  }
  return next;
}

export function prerequisitesReady(node: SkillNode, mastery: MasteryMap, gate?: number) {
  const requiredScore = gate ?? node.prerequisiteGate;
  return node.prerequisiteIds.every((id) => (mastery[id]?.score ?? 0) >= requiredScore);
}

export function missingPrerequisites(node: SkillNode, mastery: MasteryMap) {
  return node.prerequisiteIds.filter((id) => (mastery[id]?.score ?? 0) < node.prerequisiteGate);
}

export function skillNeedsEvidence(node: SkillNode, mastery: MasteryMap) {
  const state = mastery[node.id];
  if (!state || state.score < 55) return true;
  const contexts = new Set(
    state.evidence
      .filter((item) => item.correct && ['lab', 'checkpoint', 'boss', 'project'].includes(item.activityKind))
      .map((item) => `${item.activityKind}:${item.lessonId}`),
  );
  return contexts.size < 2;
}

export function courseMastery(course: Course, mastery: MasteryMap): number {
  if (course.skillIds.length === 0) return 0;
  const total = course.skillIds.reduce((sum, id) => sum + (mastery[id]?.score ?? 0), 0);
  return Math.round(total / course.skillIds.length);
}

export function weakSkillIds(course: Course, mastery: MasteryMap, threshold = 55) {
  return course.skillIds.filter((id) => (mastery[id]?.score ?? 0) < threshold);
}
