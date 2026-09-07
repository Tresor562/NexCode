import { File, Paths } from 'expo-file-system';
import { AttemptEvidence, MasteryMap, SkillMastery, masteryBand } from '../learning/skillGraph';
import type { OfflinePack, OfflinePackKind } from '../learning/offlineEngine';
import type { PortfolioProof } from '../learning/projectPortfolioEngine';
import { scheduleCloudStatePush } from './cloudSync';

export type LabDraft = {
  missionId?: string;
  language: string;
  files: Record<string, string>;
  activeFile: string;
  updatedAt: string;
  lastValidatedAt?: string;
  passedCriteria?: string[];
};

export type LocalState = {
  xp: number;
  nexCoins: number;
  streak: number;
  bestStreak: number;
  lastActiveDate?: string;
  dailyGoal: number;
  dailyCompleted: number;
  dailyGoalRewardDate?: string;
  totalLearningMinutes: number;
  downloadedCourses: string[];
  downloadedChapters: string[];
  installedOfflinePacks: OfflinePack[];
  completedLessons: string[];
  projectProgress: Record<string, number>;
  projectDrafts: Record<string, LabDraft>;
  portfolioProofs: PortfolioProof[];
  mastery: MasteryMap;
  lessonAttempts: Record<string, number>;
  lessonErrorTags: Record<string, string[]>;
  labDrafts: Record<string, LabDraft>;
  onboardingComplete: boolean;
  name: string;
  learningGoal: string;
  recentCourseId: string;
};

const initialState: LocalState = {
  xp: 0,
  nexCoins: 0,
  streak: 0,
  bestStreak: 0,
  dailyGoal: 20,
  dailyCompleted: 0,
  totalLearningMinutes: 0,
  downloadedCourses: [],
  downloadedChapters: [],
  installedOfflinePacks: [],
  completedLessons: [],
  projectProgress: {},
  projectDrafts: {},
  portfolioProofs: [],
  mastery: {},
  lessonAttempts: {},
  lessonErrorTags: {},
  labDrafts: {},
  onboardingComplete: false,
  name: '',
  learningGoal: 'Créer des sites Web',
  recentCourseId: 'html-foundations',
};

const stateFile = new File(Paths.document, 'nexcode-v15-state.json');
const MAX_PROGRESS_CLOCK_SKEW_MS = 5 * 60 * 1000;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function trustedProgressDate(value?: Date, reference = new Date()): Date {
  const safeReference = reference instanceof Date && Number.isFinite(reference.getTime()) ? reference : new Date();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) return safeReference;
  const clockSkewMs = value.getTime() - safeReference.getTime();
  return Math.abs(clockSkewMs) <= MAX_PROGRESS_CLOCK_SKEW_MS ? value : safeReference;
}

function previousLocalDateKey(date = new Date()): string {
  const previous = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1, 12, 0, 0, 0);
  return localDateKey(previous);
}

export function touchDailyActivity(state: LocalState, now = new Date()): LocalState {
  const trustedNow = trustedProgressDate(now);
  const today = localDateKey(trustedNow);
  if (state.lastActiveDate === today) return state;
  const streak = state.lastActiveDate === previousLocalDateKey(trustedNow) ? state.streak + 1 : 1;
  return {
    ...state,
    streak,
    bestStreak: Math.max(state.bestStreak, streak),
    lastActiveDate: today,
    dailyCompleted: 0,
  };
}

export type ProgressReward = {
  xp?: number;
  nexCoins?: number;
  minutes?: number;
  now?: Date;
};

function finiteNumber(value: unknown, fallback: number, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(minimum, Math.min(maximum, value));
}

function finiteInteger(value: unknown, fallback: number, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number {
  return Math.floor(finiteNumber(value, fallback, minimum, maximum));
}

function safeProgressTotal(current: unknown, increment: number): number {
  const normalizedCurrent = finiteInteger(current, 0, 0, Number.MAX_SAFE_INTEGER);
  const normalizedIncrement = finiteInteger(increment, 0, 0, Number.MAX_SAFE_INTEGER);
  return Math.min(Number.MAX_SAFE_INTEGER, normalizedCurrent + normalizedIncrement);
}

export function rewardProgress(state: LocalState, reward: ProgressReward): LocalState {
  const now = trustedProgressDate(reward.now);
  const active = touchDailyActivity(state, now);
  const minutes = finiteNumber(reward.minutes, 0, 0, 240);
  const xp = finiteInteger(reward.xp, 0, 0, 1_000_000);
  const nexCoins = finiteInteger(reward.nexCoins, 0, 0, 1_000_000);
  const dailyGoal = finiteInteger(active.dailyGoal, initialState.dailyGoal, 5, 240);
  const currentDailyCompleted = finiteNumber(active.dailyCompleted, 0, 0, dailyGoal);
  const dailyCompleted = Math.min(dailyGoal, currentDailyCompleted + minutes);
  const today = localDateKey(now);
  const shouldGrantGoalBonus = dailyCompleted >= dailyGoal && active.dailyGoalRewardDate !== today;
  const xpAward = xp + (shouldGrantGoalBonus ? 40 : 0);
  const nexCoinAward = nexCoins + (shouldGrantGoalBonus ? 20 : 0);

  return {
    ...active,
    dailyGoal,
    xp: safeProgressTotal(active.xp, xpAward),
    nexCoins: safeProgressTotal(active.nexCoins, nexCoinAward),
    dailyCompleted,
    dailyGoalRewardDate: shouldGrantGoalBonus ? today : active.dailyGoalRewardDate,
    totalLearningMinutes: safeProgressTotal(active.totalLearningMinutes, minutes),
  };
}

function cleanString(value: unknown, fallback: string, maxLength = 240): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  return normalized ? normalized.slice(0, maxLength) : fallback;
}

function optionalDateKey(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day) return undefined;
  return trimmed;
}

function optionalIsoDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || !Number.isFinite(Date.parse(trimmed))) return undefined;
  return new Date(trimmed).toISOString();
}

function stringList(value: unknown, limit = 2_000): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean))].slice(0, limit);
}

function plainRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return {};
  return value as Record<string, unknown>;
}

function normalizeNumberRecord(value: unknown): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, raw] of Object.entries(plainRecord(value))) {
    if (!key.trim() || typeof raw !== 'number' || !Number.isFinite(raw)) continue;
    result[key] = Math.max(0, raw);
  }
  return result;
}

function normalizePercentRecord(value: unknown): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, raw] of Object.entries(plainRecord(value))) {
    if (!key.trim() || typeof raw !== 'number' || !Number.isFinite(raw)) continue;
    result[key] = Math.max(0, Math.min(100, raw));
  }
  return result;
}

function normalizeErrorTags(value: unknown): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [key, raw] of Object.entries(plainRecord(value))) {
    if (!key.trim()) continue;
    result[key] = stringList(raw, 12).slice(-12);
  }
  return result;
}

const OFFLINE_PACK_KINDS = new Set<OfflinePackKind>(['lite', 'standard', 'full']);
const OFFLINE_PACK_INCLUDES = new Set<OfflinePack['includes'][number]>(['content', 'examples', 'exercise-assets', 'lab-starters', 'media']);

function normalizeOfflinePacks(value: unknown): OfflinePack[] {
  if (!Array.isArray(value)) return [];
  const normalized: OfflinePack[] = [];
  const seenIds = new Set<string>();

  for (const rawValue of value.slice(0, 500)) {
    const raw = plainRecord(rawValue);
    const id = cleanString(raw.id, '', 240);
    const courseId = cleanString(raw.courseId, '', 160);
    const kind = typeof raw.kind === 'string' && OFFLINE_PACK_KINDS.has(raw.kind as OfflinePackKind)
      ? raw.kind as OfflinePackKind
      : undefined;
    const chapterIds = stringList(raw.chapterIds, 200);
    const includes = stringList(raw.includes, 20)
      .filter((item): item is OfflinePack['includes'][number] => OFFLINE_PACK_INCLUDES.has(item as OfflinePack['includes'][number]));

    if (!id || !courseId || !kind || !chapterIds.length || seenIds.has(id)) continue;
    seenIds.add(id);
    normalized.push({
      id,
      courseId,
      kind,
      chapterIds,
      estimatedMb: finiteInteger(raw.estimatedMb, 0, 0, 100_000),
      includes: [...new Set(includes)],
      curriculumVersion: finiteInteger(raw.curriculumVersion, 0, 0, 1_000_000),
    });
  }

  return normalized;
}

function normalizePortfolioProofs(value: unknown): PortfolioProof[] {
  if (!Array.isArray(value)) return [];
  const normalized: PortfolioProof[] = [];

  for (const rawValue of value.slice(-2_000)) {
    const raw = plainRecord(rawValue);
    const projectId = cleanString(raw.projectId, '', 160);
    const title = cleanString(raw.title, '', 240);
    const completedAt = optionalIsoDate(raw.completedAt);
    if (!projectId || !title || !completedAt) continue;

    normalized.push({
      projectId,
      title,
      completedAt,
      score: finiteInteger(raw.score, 0, 0, 100),
      skillIds: stringList(raw.skillIds, 200),
      rubricIds: stringList(raw.rubricIds, 100),
      evidenceSummary: cleanString(raw.evidenceSummary, `${title} • preuve restaurée`, 1_000),
    });
  }

  return normalized;
}

function normalizeLabDrafts(value: unknown): Record<string, LabDraft> {
  const result: Record<string, LabDraft> = {};
  for (const [key, raw] of Object.entries(plainRecord(value))) {
    const draft = plainRecord(raw);
    const filesRaw = plainRecord(draft.files);
    const files: Record<string, string> = {};
    for (const [path, content] of Object.entries(filesRaw)) {
      if (!path.trim() || typeof content !== 'string') continue;
      files[path] = content;
    }
    const activeFile = typeof draft.activeFile === 'string' && draft.activeFile in files
      ? draft.activeFile
      : Object.keys(files)[0];
    if (!activeFile) continue;
    result[key] = {
      missionId: typeof draft.missionId === 'string' ? draft.missionId : undefined,
      language: cleanString(draft.language, 'text', 40),
      files,
      activeFile,
      updatedAt: optionalIsoDate(draft.updatedAt) ?? new Date(0).toISOString(),
      lastValidatedAt: optionalIsoDate(draft.lastValidatedAt),
      passedCriteria: stringList(draft.passedCriteria, 100),
    };
  }
  return result;
}

function normalizeEvidence(value: unknown): AttemptEvidence[] {
  if (!Array.isArray(value)) return [];
  const normalized: AttemptEvidence[] = [];
  for (const rawValue of value.slice(-20)) {
    const raw = plainRecord(rawValue);
    const lessonId = cleanString(raw.lessonId, '', 160);
    const activityKind = cleanString(raw.activityKind, '', 40);
    const at = optionalIsoDate(raw.at);
    if (!lessonId || !activityKind || !at || typeof raw.correct !== 'boolean') continue;
    const errorTag = raw.correct ? undefined : cleanString(raw.errorTag, '', 120) || undefined;
    normalized.push({
      lessonId,
      activityKind,
      correct: raw.correct,
      scoreDelta: finiteNumber(raw.scoreDelta, 0, -100, 100),
      at,
      errorTag,
    });
  }
  return normalized;
}

function normalizeMastery(value: unknown): MasteryMap {
  const normalized: MasteryMap = {};
  for (const [skillId, rawValue] of Object.entries(plainRecord(value))) {
    if (!skillId.trim()) continue;
    const raw = plainRecord(rawValue) as Partial<SkillMastery>;
    const attempts = finiteInteger(raw.attempts, 0);
    const correctAttempts = finiteInteger(raw.correctAttempts, 0, 0, attempts);
    const score = finiteNumber(raw.score, 0, 0, 100);
    normalized[skillId] = {
      skillId,
      score,
      confidence: finiteNumber(raw.confidence, attempts ? Math.round((correctAttempts / attempts) * 70) : 0, 0, 100),
      band: masteryBand(score),
      attempts,
      correctAttempts,
      consecutiveCorrect: finiteInteger(raw.consecutiveCorrect, 0, 0, attempts),
      lastPracticedAt: optionalIsoDate(raw.lastPracticedAt),
      nextReviewAt: optionalIsoDate(raw.nextReviewAt),
      errorTags: stringList(raw.errorTags, 8).slice(-8),
      evidence: normalizeEvidence(raw.evidence),
    };
  }
  return normalized;
}

function normalizeState(value: Partial<LocalState>): LocalState {
  const dailyGoal = finiteInteger(value.dailyGoal, initialState.dailyGoal, 5, 240);
  const streak = finiteInteger(value.streak, initialState.streak, 0, 100_000);
  return {
    ...initialState,
    xp: finiteInteger(value.xp, initialState.xp),
    nexCoins: finiteInteger(value.nexCoins, initialState.nexCoins),
    streak,
    bestStreak: Math.max(streak, finiteInteger(value.bestStreak, initialState.bestStreak, 0, 100_000)),
    lastActiveDate: optionalDateKey(value.lastActiveDate),
    dailyGoal,
    dailyCompleted: finiteInteger(value.dailyCompleted, initialState.dailyCompleted, 0, dailyGoal),
    dailyGoalRewardDate: optionalDateKey(value.dailyGoalRewardDate),
    totalLearningMinutes: finiteInteger(value.totalLearningMinutes, initialState.totalLearningMinutes),
    downloadedCourses: stringList(value.downloadedCourses),
    downloadedChapters: stringList(value.downloadedChapters),
    installedOfflinePacks: normalizeOfflinePacks(value.installedOfflinePacks),
    completedLessons: stringList(value.completedLessons, 20_000),
    projectProgress: normalizePercentRecord(value.projectProgress),
    projectDrafts: normalizeLabDrafts(value.projectDrafts),
    portfolioProofs: normalizePortfolioProofs(value.portfolioProofs),
    mastery: normalizeMastery(value.mastery),
    lessonAttempts: normalizeNumberRecord(value.lessonAttempts),
    lessonErrorTags: normalizeErrorTags(value.lessonErrorTags),
    labDrafts: normalizeLabDrafts(value.labDrafts),
    onboardingComplete: value.onboardingComplete === true,
    name: cleanString(value.name, initialState.name, 80),
    learningGoal: cleanString(value.learningGoal, initialState.learningGoal, 160),
    recentCourseId: cleanString(value.recentCourseId, initialState.recentCourseId, 120),
  };
}

export function sanitizeLocalState(value: unknown): LocalState {
  return normalizeState(plainRecord(value) as Partial<LocalState>);
}

export function loadLocalState(): LocalState {
  try {
    if (!stateFile.exists) {
      stateFile.create();
      stateFile.write(JSON.stringify(initialState));
      return initialState;
    }
    const raw = stateFile.textSync();
    if (!raw.trim()) return initialState;
    const parsed = JSON.parse(raw) as unknown;
    return sanitizeLocalState(parsed);
  } catch {
    return initialState;
  }
}

export function saveLocalState(state: LocalState): void {
  try {
    if (!stateFile.exists) stateFile.create();
    stateFile.write(JSON.stringify(state));
    scheduleCloudStatePush(state);
  } catch {
    // Learning must keep working even if a local write fails temporarily.
  }
}
