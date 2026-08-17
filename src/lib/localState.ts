import { File, Paths } from 'expo-file-system';

export type LocalState = {
  xp: number;
  streak: number;
  dailyGoal: number;
  downloadedCourses: string[];
  completedLessons: string[];
};

const initialState: LocalState = {
  xp: 120,
  streak: 3,
  dailyGoal: 40,
  downloadedCourses: ['html-foundations'],
  completedLessons: [],
};

const stateFile = new File(Paths.document, 'nexcode-v15-state.json');

export function loadLocalState(): LocalState {
  try {
    if (!stateFile.exists) {
      stateFile.create();
      stateFile.write(JSON.stringify(initialState));
      return initialState;
    }

    const raw = stateFile.textSync();
    if (!raw.trim()) return initialState;
    return { ...initialState, ...JSON.parse(raw) } as LocalState;
  } catch {
    return initialState;
  }
}

export function saveLocalState(state: LocalState): void {
  if (!stateFile.exists) stateFile.create();
  stateFile.write(JSON.stringify(state));
}
