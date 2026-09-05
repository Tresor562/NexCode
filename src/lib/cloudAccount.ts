import { File, Paths } from 'expo-file-system';
import { sanitizeLocalState, type LocalState } from './localState';

type Env = Record<string, string | undefined>;

type SupabaseConfig = {
  url: string;
  anonKey: string;
};

export type CloudUser = {
  id: string;
  email?: string;
};

export type CloudSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: CloudUser;
};

export type AuthResult =
  | { kind: 'session'; session: CloudSession }
  | { kind: 'confirm-email'; email: string };

const sessionFile = new File(Paths.document, 'nexcode-cloud-session.json');
const NEXCODE_SUPABASE_URL = 'https://ojbyvjqurlamplmujmyu.supabase.co';
const NEXCODE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_EnV_q5ePfEOB1NxN3-gtpA_HdwjtPyu';
const SESSION_REFRESH_WINDOW_MS = 120_000;

type RefreshFlight = {
  refreshToken: string;
  promise: Promise<CloudSession>;
};

let refreshFlight: RefreshFlight | null = null;

function env(): Env {
  return ((globalThis as typeof globalThis & { process?: { env?: Env } }).process?.env ?? {}) as Env;
}

export function cloudConfig(): SupabaseConfig | null {
  const values = env();
  const url = values.EXPO_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, '') || NEXCODE_SUPABASE_URL;
  const anonKey = values.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || NEXCODE_SUPABASE_PUBLISHABLE_KEY;
  return url && anonKey ? { url, anonKey } : null;
}

export function isCloudConfigured(): boolean {
  return cloudConfig() !== null;
}

function authHeaders(config: SupabaseConfig): Record<string, string> {
  return {
    apikey: config.anonKey,
    'Content-Type': 'application/json',
  };
}

function restHeaders(config: SupabaseConfig, session: CloudSession): Record<string, string> {
  return {
    apikey: config.anonKey,
    Authorization: `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  };
}

async function parseError(response: Response): Promise<Error> {
  try {
    const payload = (await response.json()) as { msg?: string; message?: string; error_description?: string; error?: string };
    return new Error(payload.msg ?? payload.message ?? payload.error_description ?? payload.error ?? `Erreur réseau (${response.status})`);
  } catch {
    return new Error(`Erreur réseau (${response.status})`);
  }
}

function toSession(payload: {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  user: { id: string; email?: string };
}): CloudSession {
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + Math.max(30, payload.expires_in ?? 3600) * 1000,
    user: { id: payload.user.id, email: payload.user.email },
  };
}

export function loadCloudSession(): CloudSession | null {
  try {
    if (!sessionFile.exists) return null;
    const raw = sessionFile.textSync();
    if (!raw.trim()) return null;
    const parsed = JSON.parse(raw) as Partial<CloudSession>;
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.user?.id || !parsed.expiresAt) return null;
    return parsed as CloudSession;
  } catch {
    return null;
  }
}

export function saveCloudSession(session: CloudSession | null): void {
  try {
    if (!session) {
      if (sessionFile.exists) sessionFile.delete();
      return;
    }
    if (!sessionFile.exists) sessionFile.create();
    sessionFile.write(JSON.stringify(session));
  } catch {
    // Local learning remains usable when session persistence temporarily fails.
  }
}

function sessionIsStillCurrent(session: CloudSession): boolean {
  const persisted = loadCloudSession();
  return Boolean(
    persisted
      && persisted.user.id === session.user.id
      && persisted.refreshToken === session.refreshToken,
  );
}

export async function signInWithPassword(email: string, password: string): Promise<CloudSession> {
  const config = cloudConfig();
  if (!config) throw new Error('Supabase n’est pas encore configuré pour ce build.');
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: authHeaders(config),
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw await parseError(response);
  const session = toSession(await response.json());
  saveCloudSession(session);
  return session;
}

export async function signUpWithPassword(email: string, password: string, displayName: string): Promise<AuthResult> {
  const config = cloudConfig();
  if (!config) throw new Error('Supabase n’est pas encore configuré pour ce build.');
  const response = await fetch(`${config.url}/auth/v1/signup`, {
    method: 'POST',
    headers: authHeaders(config),
    body: JSON.stringify({ email, password, data: { display_name: displayName } }),
  });
  if (!response.ok) throw await parseError(response);
  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    user?: { id: string; email?: string };
  };
  if (!payload.access_token || !payload.refresh_token || !payload.user) return { kind: 'confirm-email', email };
  const session = toSession(payload as Required<Pick<typeof payload, 'access_token' | 'refresh_token' | 'user'>> & { expires_in?: number });
  saveCloudSession(session);
  return { kind: 'session', session };
}

function shouldDiscardSessionAfterRefreshFailure(status: number): boolean {
  // A rejected refresh token is terminal. Throttling and server/network failures
  // are transient and must not log the learner out or destroy offline continuity.
  return status === 400 || status === 401 || status === 403;
}

async function performCloudSessionRefresh(session: CloudSession): Promise<CloudSession> {
  const config = cloudConfig();
  if (!config) return session;
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: authHeaders(config),
    body: JSON.stringify({ refresh_token: session.refreshToken }),
  });
  if (!response.ok) {
    // A refresh can finish after the learner has already switched accounts. Never
    // let a stale request sign the newly active learner out.
    if (shouldDiscardSessionAfterRefreshFailure(response.status) && sessionIsStillCurrent(session)) {
      saveCloudSession(null);
    }
    throw await parseError(response);
  }
  const refreshed = toSession(await response.json());

  // Supabase refresh tokens rotate, but an old account refresh may resolve after
  // another account has signed in. Persist only when the same session is still
  // active so an in-flight request cannot resurrect the previous account.
  if (sessionIsStillCurrent(session)) saveCloudSession(refreshed);
  return refreshed;
}

export async function refreshCloudSession(session: CloudSession): Promise<CloudSession> {
  if (session.expiresAt - Date.now() > SESSION_REFRESH_WINDOW_MS) return session;

  // Supabase refresh tokens rotate. Two concurrent refresh calls using the same
  // token can invalidate one another and produce random sign-outs. Share one
  // request per refresh token and let all callers reuse the resulting session.
  if (refreshFlight?.refreshToken === session.refreshToken) return refreshFlight.promise;

  const promise = performCloudSessionRefresh(session);
  const flight: RefreshFlight = { refreshToken: session.refreshToken, promise };
  refreshFlight = flight;
  try {
    return await promise;
  } finally {
    if (refreshFlight === flight) refreshFlight = null;
  }
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function mergeMaxNumberRecord(remote: unknown, local: Record<string, number>, ceiling = Number.MAX_SAFE_INTEGER): Record<string, number> {
  const merged: Record<string, number> = { ...local };
  if (!remote || typeof remote !== 'object' || Array.isArray(remote)) return merged;
  for (const [key, raw] of Object.entries(remote as Record<string, unknown>)) {
    if (!key.trim() || typeof raw !== 'number' || !Number.isFinite(raw)) continue;
    const value = Math.max(0, Math.min(ceiling, raw));
    merged[key] = Math.max(merged[key] ?? 0, value);
  }
  return merged;
}

function mergeErrorTagRecord(remote: unknown, local: LocalState['lessonErrorTags']): LocalState['lessonErrorTags'] {
  const merged: LocalState['lessonErrorTags'] = { ...local };
  if (!remote || typeof remote !== 'object' || Array.isArray(remote)) return merged;
  for (const [key, raw] of Object.entries(remote as Record<string, unknown>)) {
    if (!key.trim() || !Array.isArray(raw)) continue;
    const remoteTags = raw.filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean);
    merged[key] = unique([...(merged[key] ?? []), ...remoteTags]).slice(-12);
  }
  return merged;
}

function finiteCloudNumber(value: unknown, fallback = 0, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(minimum, Math.min(maximum, value));
}

function validIsoTimestamp(value: unknown): number {
  if (typeof value !== 'string' || !value.trim()) return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

function mergeMastery(remote: unknown, local: LocalState['mastery']): LocalState['mastery'] {
  const merged: LocalState['mastery'] = { ...local };
  if (!remote || typeof remote !== 'object' || Array.isArray(remote)) return merged;

  for (const [skillId, raw] of Object.entries(remote as Record<string, unknown>)) {
    if (!skillId.trim() || !raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const remoteSkill = raw as Partial<LocalState['mastery'][string]>;
    const localSkill = local[skillId];
    if (!localSkill) {
      merged[skillId] = { ...remoteSkill, skillId } as LocalState['mastery'][string];
      continue;
    }

    const remoteAt = validIsoTimestamp(remoteSkill.lastPracticedAt);
    const localAt = validIsoTimestamp(localSkill.lastPracticedAt);
    const preferred = remoteAt > localAt ? remoteSkill : localSkill;
    const remoteEvidence = Array.isArray(remoteSkill.evidence) ? remoteSkill.evidence : [];
    const localEvidence = Array.isArray(localSkill.evidence) ? localSkill.evidence : [];
    const evidenceByKey = new Map<string, LocalState['mastery'][string]['evidence'][number]>();

    for (const evidence of [...remoteEvidence, ...localEvidence]) {
      if (!evidence || typeof evidence !== 'object') continue;
      const candidate = evidence as LocalState['mastery'][string]['evidence'][number];
      const key = [candidate.lessonId, candidate.activityKind, candidate.correct, candidate.scoreDelta, candidate.at, candidate.errorTag ?? ''].join('\u0000');
      evidenceByKey.set(key, candidate);
    }

    const evidence = [...evidenceByKey.values()]
      .sort((left, right) => validIsoTimestamp(left.at) - validIsoTimestamp(right.at))
      .slice(-20);
    let consecutiveCorrect = 0;
    for (let index = evidence.length - 1; index >= 0; index -= 1) {
      if (!evidence[index]?.correct) break;
      consecutiveCorrect += 1;
    }

    merged[skillId] = {
      ...localSkill,
      ...preferred,
      skillId,
      attempts: Math.max(localSkill.attempts, finiteCloudNumber(remoteSkill.attempts)),
      correctAttempts: Math.max(localSkill.correctAttempts, finiteCloudNumber(remoteSkill.correctAttempts)),
      consecutiveCorrect,
      lastPracticedAt: remoteAt > localAt ? remoteSkill.lastPracticedAt : localSkill.lastPracticedAt,
      nextReviewAt: remoteAt > localAt ? remoteSkill.nextReviewAt : localSkill.nextReviewAt,
      errorTags: unique([...(localSkill.errorTags ?? []), ...(Array.isArray(remoteSkill.errorTags) ? remoteSkill.errorTags.filter((tag): tag is string => typeof tag === 'string') : [])]).slice(-8),
      evidence,
    };
  }

  return merged;
}

function mergePortfolioProofs(remote: unknown, local: LocalState['portfolioProofs']): LocalState['portfolioProofs'] {
  const byProject = new Map(local.map((proof) => [proof.projectId, proof]));
  if (!Array.isArray(remote)) return [...byProject.values()];
  for (const raw of remote) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const proof = raw as Partial<LocalState['portfolioProofs'][number]>;
    if (typeof proof.projectId !== 'string' || !proof.projectId.trim()) continue;
    const current = byProject.get(proof.projectId);
    if (!current) {
      byProject.set(proof.projectId, proof as LocalState['portfolioProofs'][number]);
      continue;
    }
    const remoteAt = validIsoTimestamp(proof.completedAt);
    const currentAt = validIsoTimestamp(current.completedAt);

    // Portfolio proof identity is versioned by completion time everywhere else
    // in the product. Keep the same monotonic rule at the Supabase boundary: a
    // delayed device must not resurrect an older proof merely because that old
    // rubric happened to score higher. Equal versions keep the local snapshot to
    // avoid needless cross-device churn; an invalid local clock can still recover
    // from a valid remote proof.
    if (remoteAt > currentAt) {
      byProject.set(proof.projectId, proof as LocalState['portfolioProofs'][number]);
    }
  }
  return [...byProject.values()];
}

function dateKey(value: unknown): string | undefined {
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

function laterDateKey(left: string | undefined, right: string | undefined): string | undefined {
  if (!left) return right;
  if (!right) return left;
  return left >= right ? left : right;
}

function mergeDailyProgress(local: LocalState, progress: Record<string, unknown> | undefined) {
  const localDate = dateKey(local.lastActiveDate);
  const remoteDate = dateKey(progress?.last_active_date);
  const remoteCompleted = finiteCloudNumber(progress?.daily_completed, 0, 0, 240);
  const remoteStreak = finiteCloudNumber(progress?.streak, 0, 0, 100_000);
  const lastActiveDate = laterDateKey(localDate, remoteDate);

  // Daily counters and the current streak describe a specific activity day. A
  // stale cloud snapshot must never revive yesterday's completed goal or streak
  // after this device has already moved to a newer local day.
  if (localDate && (!remoteDate || localDate > remoteDate)) {
    return { lastActiveDate: localDate, dailyCompleted: local.dailyCompleted, streak: local.streak };
  }
  if (remoteDate && (!localDate || remoteDate > localDate)) {
    return { lastActiveDate: remoteDate, dailyCompleted: remoteCompleted, streak: remoteStreak };
  }
  return {
    lastActiveDate,
    dailyCompleted: Math.max(local.dailyCompleted, remoteCompleted),
    streak: Math.max(local.streak, remoteStreak),
  };
}

function mergeRemoteState(local: LocalState, profile: Record<string, unknown> | undefined, progress: Record<string, unknown> | undefined): LocalState {
  if (!progress && !profile) return local;
  const remoteLessons = Array.isArray(progress?.completed_lessons) ? progress?.completed_lessons.filter((value): value is string => typeof value === 'string') : [];
  const settings = progress?.settings && typeof progress.settings === 'object' ? progress.settings as Record<string, unknown> : {};
  const daily = mergeDailyProgress(local, progress);
  const remoteRewardDate = dateKey(settings.dailyGoalRewardDate);
  const localRewardDate = dateKey(local.dailyGoalRewardDate);
  const merged: LocalState = {
    ...local,
    name: typeof profile?.display_name === 'string' && profile.display_name.trim() ? profile.display_name : local.name,
    learningGoal: typeof profile?.learning_goal === 'string' && profile.learning_goal.trim() ? profile.learning_goal : local.learningGoal,
    xp: Math.max(local.xp, finiteCloudNumber(progress?.xp)),
    nexCoins: Math.max(local.nexCoins, finiteCloudNumber(progress?.nexcoins)),
    streak: daily.streak,
    bestStreak: Math.max(local.bestStreak, daily.streak, finiteCloudNumber(settings.bestStreak, 0, 0, 100_000)),
    dailyGoal: finiteCloudNumber(progress?.daily_goal, local.dailyGoal, 5, 240),
    dailyCompleted: daily.dailyCompleted,
    dailyGoalRewardDate: laterDateKey(localRewardDate, remoteRewardDate),
    totalLearningMinutes: Math.max(local.totalLearningMinutes, finiteCloudNumber(settings.totalLearningMinutes)),
    lastActiveDate: daily.lastActiveDate,
    recentCourseId: typeof progress?.recent_course_id === 'string' ? progress.recent_course_id : local.recentCourseId,
    completedLessons: unique([...local.completedLessons, ...remoteLessons]),
    mastery: mergeMastery(progress?.mastery, local.mastery),
    lessonAttempts: mergeMaxNumberRecord(progress?.lesson_attempts, local.lessonAttempts),
    lessonErrorTags: mergeErrorTagRecord(progress?.lesson_error_tags, local.lessonErrorTags),
    projectProgress: mergeMaxNumberRecord(progress?.project_progress, local.projectProgress, 100),
    portfolioProofs: mergePortfolioProofs(progress?.portfolio_proofs, local.portfolioProofs),
    onboardingComplete: local.onboardingComplete || Boolean(profile?.display_name),
  };

  // Supabase JSON is an external persistence boundary. Run the merged snapshot
  // through the same fail-safe normalizer used for local disk restores before it
  // can reach mastery, streak, projects or UI state. This prevents malformed or
  // stale cloud JSON from reintroducing NaN, impossible dates or invalid evidence
  // that local storage already knows how to reject.
  return sanitizeLocalState(merged);
}

export async function pullCloudState(session: CloudSession, local: LocalState): Promise<{ session: CloudSession; state: LocalState }> {
  const config = cloudConfig();
  if (!config) return { session, state: local };
  const current = await refreshCloudSession(session);
  const headers = restHeaders(config, current);
  const [profileResponse, progressResponse] = await Promise.all([
    fetch(`${config.url}/rest/v1/profiles?id=eq.${encodeURIComponent(current.user.id)}&select=display_name,learning_goal`, { headers }),
    fetch(`${config.url}/rest/v1/user_progress?user_id=eq.${encodeURIComponent(current.user.id)}&select=*`, { headers }),
  ]);
  if (!profileResponse.ok) throw await parseError(profileResponse);
  if (!progressResponse.ok) throw await parseError(progressResponse);
  const profiles = await profileResponse.json() as Array<Record<string, unknown>>;
  const progresses = await progressResponse.json() as Array<Record<string, unknown>>;
  return { session: current, state: mergeRemoteState(local, profiles[0], progresses[0]) };
}

export async function pushCloudState(session: CloudSession, state: LocalState): Promise<CloudSession> {
  const config = cloudConfig();
  if (!config) return session;
  const current = await refreshCloudSession(session);
  const headers = { ...restHeaders(config, current), Prefer: 'resolution=merge-duplicates,return=minimal' };
  const updatedAt = new Date().toISOString();
  const [profileResponse, progressResponse] = await Promise.all([
    fetch(`${config.url}/rest/v1/profiles?on_conflict=id`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: current.user.id, display_name: state.name, learning_goal: state.learningGoal, updated_at: updatedAt }),
    }),
    fetch(`${config.url}/rest/v1/user_progress?on_conflict=user_id`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: current.user.id,
        xp: state.xp,
        nexcoins: state.nexCoins,
        streak: state.streak,
        last_active_date: state.lastActiveDate ?? null,
        daily_goal: state.dailyGoal,
        daily_completed: state.dailyCompleted,
        recent_course_id: state.recentCourseId,
        completed_lessons: state.completedLessons,
        mastery: state.mastery,
        lesson_attempts: state.lessonAttempts,
        lesson_error_tags: state.lessonErrorTags,
        project_progress: state.projectProgress,
        portfolio_proofs: state.portfolioProofs,
        settings: {
          onboardingComplete: state.onboardingComplete,
          bestStreak: state.bestStreak,
          totalLearningMinutes: state.totalLearningMinutes,
          dailyGoalRewardDate: state.dailyGoalRewardDate ?? null,
        },
        updated_at: updatedAt,
      }),
    }),
  ]);
  if (!profileResponse.ok) throw await parseError(profileResponse);
  if (!progressResponse.ok) throw await parseError(progressResponse);
  return current;
}