import { File, Paths } from 'expo-file-system';
import { MasteryMap, SkillMastery, masteryBand } from '../learning/skillGraph';
import type { OfflinePack } from '../learning/offlineEngine';
import type { PortfolioProof } from '../learning/projectPortfolioEngine';

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
  streak: number;
  dailyGoal: number;
  dailyCompleted: number;
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
  xp: 120,
  streak: 3,
  dailyGoal: 30,
  dailyCompleted: 12,
  downloadedCourses: ['html-foundations'],
  downloadedChapters: [],
  installedOfflinePacks: [],
  completedLessons: ['html-structure'],
  projectProgress: {
    portfolio: 35,
    todo: 0,
    'python-quiz': 0,
    'sql-library': 0,
  },
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

function normalizeMastery(value: unknown): MasteryMap {
  if (!value || typeof value !== 'object') return {};
  const normalized: MasteryMap = {};
  for (const [skillId, raw] of Object.entries(value as Record<string, Partial<SkillMastery>>)) {
    const attempts = Math.max(0, raw.attempts ?? 0);
    const correctAttempts = Math.max(0, Math.min(attempts, raw.correctAttempts ?? 0));
    const score = Math.max(0, Math.min(100, raw.score ?? 0));
    normalized[skillId] = {
      skillId,
      score,
      confidence: Math.max(0, Math.min(100, raw.confidence ?? (attempts ? Math.round((correctAttempts / attempts) * 70) : 0))),
      band: masteryBand(score),
      attempts,
      correctAttempts,
      consecutiveCorrect: Math.max(0, raw.consecutiveCorrect ?? 0),
      lastPracticedAt: raw.lastPracticedAt,
      nextReviewAt: raw.nextReviewAt,
      errorTags: Array.isArray(raw.errorTags) ? raw.errorTags.slice(-8) : [],
      evidence: Array.isArray(raw.evidence) ? raw.evidence.slice(-20) : [],
    };
  }
  return normalized;
}

function normalizeState(value: Partial<LocalState>): LocalState {
  return {
    ...initialState,
    ...value,
    downloadedCourses: Array.isArray(value.downloadedCourses) ? value.downloadedCourses : initialState.downloadedCourses,
    downloadedChapters: Array.isArray(value.downloadedChapters) ? value.downloadedChapters : initialState.downloadedChapters,
    installedOfflinePacks: Array.isArray(value.installedOfflinePacks) ? value.installedOfflinePacks : initialState.installedOfflinePacks,
    completedLessons: Array.isArray(value.completedLessons) ? value.completedLessons : initialState.completedLessons,
    projectProgress: { ...initialState.projectProgress, ...(value.projectProgress ?? {}) },
    projectDrafts: value.projectDrafts ?? initialState.projectDrafts,
    portfolioProofs: Array.isArray(value.portfolioProofs) ? value.portfolioProofs : initialState.portfolioProofs,
    mastery: normalizeMastery(value.mastery),
    lessonAttempts: value.lessonAttempts ?? initialState.lessonAttempts,
    lessonErrorTags: value.lessonErrorTags ?? initialState.lessonErrorTags,
    labDrafts: value.labDrafts ?? initialState.labDrafts,
  };
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
    return normalizeState(JSON.parse(raw) as Partial<LocalState>);
  } catch {
    return initialState;
  }
}

export function saveLocalState(state: LocalState): void {
  try {
    if (!stateFile.exists) stateFile.create();
    stateFile.write(JSON.stringify(state));
  } catch {
    // Learning must keep working even if a local write fails temporarily.
  }
}
