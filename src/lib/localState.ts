import { File, Paths } from 'expo-file-system';

export type LocalState = {
  xp: number;
  streak: number;
  dailyGoal: number;
  dailyCompleted: number;
  downloadedCourses: string[];
  completedLessons: string[];
  projectProgress: Record<string, number>;
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
  completedLessons: ['html-structure'],
  projectProgress: {
    portfolio: 35,
    todo: 0,
    'python-quiz': 0,
    'sql-library': 0,
  },
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
    completedLessons: Array.isArray(value.completedLessons)
      ? value.completedLessons
      : initialState.completedLessons,
    projectProgress: {
      ...initialState.projectProgress,
      ...(value.projectProgress ?? {}),
    },
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
