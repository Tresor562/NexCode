import { File, Paths } from 'expo-file-system';
import type { LocalState } from './localState';

const ownerFile = new File(Paths.document, 'nexcode-local-owner.txt');
const ownerBoundMarker = new File(Paths.document, 'nexcode-local-owner-bound-v1');
const MAX_ACCOUNT_ID_CHARS = 160;

function normalizeAccountId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_ACCOUNT_ID_CHARS) return null;
  if (/[\u0000-\u001f\u007f]/.test(normalized)) return null;
  return normalized;
}

function readOwnerId(): string | null {
  try {
    if (!ownerFile.exists) return null;
    return normalizeAccountId(ownerFile.textSync());
  } catch {
    return null;
  }
}

function ownerBindingWasInitialized(): boolean {
  try {
    return ownerBoundMarker.exists;
  } catch {
    // If the filesystem cannot answer reliably, prefer account isolation over
    // reusing progression whose owner cannot be proven.
    return true;
  }
}

export function bindLocalStateOwner(userId: string): void {
  const normalized = normalizeAccountId(userId);
  if (!normalized) return;
  try {
    if (!ownerFile.exists) ownerFile.create();
    ownerFile.write(normalized);

    // This marker distinguishes a genuinely old pre-account-scope install from
    // a modern install whose owner metadata was later deleted or corrupted.
    // Once account scoping has been initialized, losing owner metadata must not
    // make another authenticated account inherit the previous learner's state.
    if (!ownerBoundMarker.exists) ownerBoundMarker.create();
    ownerBoundMarker.write('1');
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
  const normalized = normalizeAccountId(userId);
  if (!normalized) return freshState();
  const ownerId = readOwnerId();

  // Existing installs predate owner binding. They may adopt their snapshot once
  // only when there is no evidence account scoping was ever initialized.
  if (!ownerId) {
    return ownerBindingWasInitialized() ? freshState() : local;
  }

  // Once an owner is known, never merge that learner's local XP, projects,
  // drafts or mastery into another authenticated account.
  return ownerId === normalized ? local : freshState();
}
