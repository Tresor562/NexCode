import { Course, Lesson, MasteryBand } from '../data/curriculumCore';
import { MasteryMap, SkillMastery, masteryBand } from './skillGraph';

export type MasteryEvidenceKind = 'lesson' | 'practice' | 'review' | 'lab' | 'checkpoint' | 'boss' | 'project';

export type MasterySnapshot = {
  skillId: string;
  rawScore: number;
  effectiveScore: number;
  confidence: number;
  band: MasteryBand;
  evidenceKinds: MasteryEvidenceKind[];
  recurringErrors: string[];
  needsReview: boolean;
  independentEvidence: boolean;
};

export type GateResult = {
  passed: boolean;
  score: number;
  required: number;
  missingSkills: string[];
  weakSkills: string[];
  missingIndependentEvidence: string[];
};

function ageDays(iso: string | undefined, now: Date) {
  if (!iso) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now.getTime() - new Date(iso).getTime()) / 86_400_000);
}

function retentionFactor(state: SkillMastery, now: Date) {
  const days = ageDays(state.lastPracticedAt, now);
  if (!Number.isFinite(days)) return 0;
  if (days <= 3) return 1;
  if (days <= 7) return 0.98;
  if (days <= 14) return 0.94;
  if (days <= 30) return 0.88;
  if (days <= 60) return 0.8;
  return 0.7;
}

function recurringErrorTags(state: SkillMastery) {
  const counts = new Map<string, number>();
  for (const attempt of state.evidence.slice(-12)) {
    if (attempt.correct || !attempt.errorTag) continue;
    counts.set(attempt.errorTag, (counts.get(attempt.errorTag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
}

function reviewIsDue(nextReviewAt: string | undefined, now: Date) {
  if (!nextReviewAt) return true;
  const timestamp = new Date(nextReviewAt).getTime();
  return !Number.isFinite(timestamp) || timestamp <= now.getTime();
}

function snapshotIsMastered(snapshot: MasterySnapshot) {
  return snapshot.effectiveScore >= 85 && snapshot.confidence >= 70 && snapshot.independentEvidence;
}

export function masterySnapshot(skillId: string, mastery: MasteryMap, now = new Date()): MasterySnapshot {
  const state = mastery[skillId];
  if (!state) {
    return {
      skillId,
      rawScore: 0,
      effectiveScore: 0,
      confidence: 0,
      band: 'new',
      evidenceKinds: [],
      recurringErrors: [],
      needsReview: true,
      independentEvidence: false,
    };
  }
  const effectiveScore = Math.round(state.score * retentionFactor(state, now));
  const evidenceKinds = [...new Set(state.evidence.filter((item) => item.correct).map((item) => item.activityKind as MasteryEvidenceKind))];
  const recurringErrors = recurringErrorTags(state);
  const independentEvidence = evidenceKinds.some((kind) => ['lab', 'checkpoint', 'boss', 'project'].includes(kind));
  const due = reviewIsDue(state.nextReviewAt, now);
  return {
    skillId,
    rawScore: state.score,
    effectiveScore,
    confidence: state.confidence,
    band: masteryBand(effectiveScore),
    evidenceKinds,
    recurringErrors,
    needsReview: due || effectiveScore < state.score - 5,
    independentEvidence,
  };
}

export function evidenceStrength(snapshot: MasterySnapshot) {
  let strength = 0;
  if (snapshot.evidenceKinds.includes('practice')) strength += 10;
  if (snapshot.evidenceKinds.includes('review')) strength += 12;
  if (snapshot.evidenceKinds.includes('lab')) strength += 24;
  if (snapshot.evidenceKinds.includes('checkpoint')) strength += 22;
  if (snapshot.evidenceKinds.includes('boss')) strength += 28;
  if (snapshot.evidenceKinds.includes('project')) strength += 30;
  return Math.min(100, strength);
}

export function skillIsMastered(skillId: string, mastery: MasteryMap, now = new Date()) {
  return snapshotIsMastered(masterySnapshot(skillId, mastery, now));
}

export function evaluateSkillGate(skillIds: string[], mastery: MasteryMap, required = 70, now = new Date()): GateResult {
  const snapshots = skillIds.map((id) => masterySnapshot(id, mastery, now));
  const missingSkills = snapshots.filter((item) => item.rawScore === 0).map((item) => item.skillId);
  const weakSkills = snapshots.filter((item) => item.rawScore > 0 && item.effectiveScore < required).map((item) => item.skillId);
  const missingIndependentEvidence = snapshots
    .filter((item) => item.effectiveScore >= required && !item.independentEvidence)
    .map((item) => item.skillId);
  const score = snapshots.length
    ? Math.round(snapshots.reduce((sum, item) => sum + item.effectiveScore, 0) / snapshots.length)
    : 0;
  return {
    passed: missingSkills.length === 0 && weakSkills.length === 0 && missingIndependentEvidence.length === 0,
    score,
    required,
    missingSkills,
    weakSkills,
    missingIndependentEvidence,
  };
}

export function courseMasterySnapshot(course: Course, mastery: MasteryMap, now = new Date()) {
  const snapshots = course.skillIds.map((id) => masterySnapshot(id, mastery, now));
  const score = snapshots.length ? Math.round(snapshots.reduce((sum, item) => sum + item.effectiveScore, 0) / snapshots.length) : 0;
  const mastered = snapshots.filter(snapshotIsMastered).length;
  const dueForReview = snapshots.filter((item) => item.needsReview).length;
  return { score, mastered, total: snapshots.length, dueForReview, snapshots };
}

export function lessonMasteryGate(lesson: Lesson, mastery: MasteryMap, now = new Date()) {
  const required = lesson.activityKind === 'boss' ? 80 : lesson.activityKind === 'checkpoint' ? 70 : 55;
  return evaluateSkillGate(lesson.prerequisiteSkillIds ?? [], mastery, required, now);
}

export function remediationTargets(mastery: MasteryMap, now = new Date()) {
  return Object.keys(mastery)
    .map((skillId) => masterySnapshot(skillId, mastery, now))
    .filter((snapshot) => snapshot.recurringErrors.length > 0 || snapshot.effectiveScore < 55 || snapshot.needsReview)
    .sort((a, b) => {
      const aPenalty = a.recurringErrors.length * 20 + (a.needsReview ? 10 : 0) + (55 - Math.min(55, a.effectiveScore));
      const bPenalty = b.recurringErrors.length * 20 + (b.needsReview ? 10 : 0) + (55 - Math.min(55, b.effectiveScore));
      return bPenalty - aPenalty;
    });
}
