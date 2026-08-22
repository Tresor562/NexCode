import { File, Paths } from 'expo-file-system';
import type { LocalState } from './localState';

const ownerFile = new File(Paths.document, 'nexcode-local-owner.txt');

function readOwnerId(): string | null {
  try {
    if (!ownerFile.exists) return null;
    const value = ownerFile.textSync().trim();
    return value || null;
  } catch {
    return null;
  }
}

export function bindLocalStateOwner(userId: string): void {
  const normalized = userId.trim();
  if (!normalized) return;
  try {
    if (!ownerFile.exists) ownerFile.create();
    ownerFile.write(normalized);
  } catch {
    // Cloud hydration can still continue; the next launch will fail safe again.
  }
}

function freshState(): LocalState {
  return {
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
}

export function scopeLocalStateForUser(local: LocalState, userId: string): LocalState {
  const normalized = userId.trim();
  if (!normalized) return freshState();
  const ownerId = readOwnerId();

  // Existing installs predate owner binding. Treat that snapshot as belonging to
  // the currently authenticated account once, then all future account changes
  // are isolated. When an owner is known and differs, never merge that learner's
  // local XP, projects or mastery into another account.
  if (!ownerId || ownerId === normalized) return local;
  return freshState();
}
