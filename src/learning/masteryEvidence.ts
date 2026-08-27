import { MasteryMap } from './skillGraph';
import { masterySnapshot } from './masteryEngine';

export type EvidenceQuality = {
  skillId: string;
  diversity: number;
  independence: number;
  recency: number;
  stability: number;
  transferable: boolean;
  reasons: string[];
};

const independentKinds = new Set(['lab', 'checkpoint', 'boss', 'project']);
const transferKinds = new Set(['boss', 'project']);
const MAX_FUTURE_EVIDENCE_SKEW_MS = 5 * 60 * 1000;

function finitePercent(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function finiteCount(value: unknown, maximum = 100): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(maximum, Math.floor(value)));
}

function validTimestamp(value: string, nowMs: number) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  if (!Number.isFinite(nowMs)) return null;
  if (time > nowMs + MAX_FUTURE_EVIDENCE_SKEW_MS) return null;
  return time;
}

export function evidenceQuality(skillId: string, mastery: MasteryMap, now = new Date()): EvidenceQuality {
  const state = mastery[skillId];
  const snapshot = masterySnapshot(skillId, mastery, now);
  if (!state) {
    return { skillId, diversity: 0, independence: 0, recency: 0, stability: 0, transferable: false, reasons: ['Aucune preuve enregistrée.'] };
  }

  const nowMs = now.getTime();
  const correct = state.evidence.filter((item) => item.correct);
  const kinds = [...new Set(correct.map((item) => item.activityKind))];
  const independentContexts = new Set(
    correct
      .filter((item) => independentKinds.has(item.activityKind))
      .map((item) => `${item.activityKind}:${item.lessonId}`),
  );
  const transferContexts = new Set(
    correct
      .filter((item) => transferKinds.has(item.activityKind))
      .map((item) => `${item.activityKind}:${item.lessonId}`),
  );
  const timestamps = correct
    .map((item) => validTimestamp(item.at, nowMs))
    .filter((value): value is number => value !== null);
  const latestAt = timestamps.length ? Math.max(...timestamps) : 0;
  const days = latestAt && Number.isFinite(nowMs)
    ? Math.max(0, (nowMs - latestAt) / 86_400_000)
    : Number.POSITIVE_INFINITY;
  const recency = !Number.isFinite(days) ? 0 : days <= 3 ? 100 : days <= 7 ? 90 : days <= 14 ? 75 : days <= 30 ? 55 : 30;
  const diversity = Math.min(100, kinds.length * 20);
  const independence = Math.min(100, independentContexts.size * 25);
  const transferable = transferContexts.size > 0;
  const effectiveScore = finitePercent(snapshot.effectiveScore);
  const confidence = finitePercent(state.confidence);
  const consecutiveCorrect = finiteCount(state.consecutiveCorrect, 5);
  const stability = Math.min(100, Math.round(effectiveScore * 0.6 + confidence * 0.25 + consecutiveCorrect * 3));
  const reasons: string[] = [];

  if (diversity < 60) reasons.push('Varier les formes de preuve : pratique, Lab, checkpoint et projet.');
  if (independence < 50) reasons.push('Produire au moins deux preuves indépendantes dans des contextes distincts.');
  if (recency < 60) reasons.push('Réaliser une récupération récente pour confirmer la rétention.');
  if (!transferable) reasons.push('Réutiliser la compétence dans un boss challenge ou un projet.');
  if (snapshot.recurringErrors.length) reasons.push('Corriger les erreurs récurrentes avant de considérer la compétence stable.');

  return { skillId, diversity, independence, recency, stability, transferable, reasons };
}

export function masteryIsDurable(skillId: string, mastery: MasteryMap, now = new Date()) {
  const snapshot = masterySnapshot(skillId, mastery, now);
  const quality = evidenceQuality(skillId, mastery, now);
  return snapshot.effectiveScore >= 85
    && snapshot.confidence >= 75
    && quality.diversity >= 60
    && quality.independence >= 50
    && quality.recency >= 55
    && quality.transferable
    && snapshot.recurringErrors.length === 0;
}

export function masteryEvidenceGaps(skillIds: string[], mastery: MasteryMap, now = new Date()) {
  return skillIds
    .map((skillId) => evidenceQuality(skillId, mastery, now))
    .filter((quality) => quality.reasons.length > 0)
    .sort((a, b) => a.stability - b.stability || a.skillId.localeCompare(b.skillId));
}
