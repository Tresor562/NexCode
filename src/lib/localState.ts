import { File, Paths } from 'expo-file-system';
import { MasteryMap } from '../learning/skillGraph';

export type LabDraft = {
  missionId?: string;
  language: string;
  files: Record<string, string>;
  activeFile: string;
  updatedAt: string;
};

export type LocalState = {
  xp: number;
  streak: number;
  dailyGoal: number;
  dailyCompleted: number;
  downloadedCourses: string[];
  downloadedChapters: string[];
  completedLessons: string[];
  projectProgress: Record<string, number>;
  mastery: MasteryMap;
  lessonAttempts: Record<string, number>;
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
  completedLessons: ['html-structure'],
  projectProgress: {
    portfolio: 35,
    todo: 0,
    'python-quiz': 0,
    'sql-library': 0,
  },
  mastery: {},
  lessonAttempts: {},
  labDrafts: {},
  onboardingComplete: false,
  name: '',
  learningGoal: 'Créer des sites Web',
  recentCourseId: 'html-foundations',
};

const stateFile = new File(Paths.document, 'nexcode-v15-state.json');

function normalizeState(value: Partial<LocalState>): LocalState {
  return {
    ...initialState,
    ...value,
    downloadedCourses: Array.isArray(value.downloadedCourses)
      ? value.downloadedCourses
      : initialState.downloadedCourses,
    downloadedChapters: Array.isArray(value.downloadedChapters)
      ? value.downloadedChapters
      : initialState.downloadedChapters,
    completedLessons: Array.isArray(value.completedLessons)
      ? value.completedLessons
      : initialState.completedLessons,
    projectProgress: {
      ...initialState.projectProgress,
      ...(value.projectProgress ?? {}),
    },
    mastery: value.mastery ?? initialState.mastery,
    lessonAttempts: value.lessonAttempts ?? initialState.lessonAttempts,
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
