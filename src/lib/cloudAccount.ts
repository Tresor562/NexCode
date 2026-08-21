import { File, Paths } from 'expo-file-system';
import type { LocalState } from './localState';

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

function env(): Env {
  return ((globalThis as typeof globalThis & { process?: { env?: Env } }).process?.env ?? {}) as Env;
}

export function cloudConfig(): SupabaseConfig | null {
  const values = env();
  const url = values.EXPO_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, '');
  const anonKey = values.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
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

export async function refreshCloudSession(session: CloudSession): Promise<CloudSession> {
  if (session.expiresAt - Date.now() > 120_000) return session;
  const config = cloudConfig();
  if (!config) return session;
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: authHeaders(config),
    body: JSON.stringify({ refresh_token: session.refreshToken }),
  });
  if (!response.ok) {
    saveCloudSession(null);
    throw await parseError(response);
  }
  const refreshed = toSession(await response.json());
  saveCloudSession(refreshed);
  return refreshed;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function mergeRemoteState(local: LocalState, profile: Record<string, unknown> | undefined, progress: Record<string, unknown> | undefined): LocalState {
  if (!progress && !profile) return local;
  const remoteLessons = Array.isArray(progress?.completed_lessons) ? progress?.completed_lessons.filter((value): value is string => typeof value === 'string') : [];
  return {
    ...local,
    name: typeof profile?.display_name === 'string' && profile.display_name.trim() ? profile.display_name : local.name,
    learningGoal: typeof profile?.learning_goal === 'string' && profile.learning_goal.trim() ? profile.learning_goal : local.learningGoal,
    xp: Math.max(local.xp, typeof progress?.xp === 'number' ? progress.xp : 0),
    nexCoins: Math.max(local.nexCoins, typeof progress?.nexcoins === 'number' ? progress.nexcoins : 0),
    streak: Math.max(local.streak, typeof progress?.streak === 'number' ? progress.streak : 0),
    dailyGoal: Math.max(5, typeof progress?.daily_goal === 'number' ? progress.daily_goal : local.dailyGoal),
    dailyCompleted: Math.max(local.dailyCompleted, typeof progress?.daily_completed === 'number' ? progress.daily_completed : 0),
    lastActiveDate: typeof progress?.last_active_date === 'string' ? progress.last_active_date : local.lastActiveDate,
    recentCourseId: typeof progress?.recent_course_id === 'string' ? progress.recent_course_id : local.recentCourseId,
    completedLessons: unique([...local.completedLessons, ...remoteLessons]),
    mastery: progress?.mastery && typeof progress.mastery === 'object' ? { ...progress.mastery as LocalState['mastery'], ...local.mastery } : local.mastery,
    lessonAttempts: progress?.lesson_attempts && typeof progress.lesson_attempts === 'object' ? { ...progress.lesson_attempts as LocalState['lessonAttempts'], ...local.lessonAttempts } : local.lessonAttempts,
    lessonErrorTags: progress?.lesson_error_tags && typeof progress.lesson_error_tags === 'object' ? { ...progress.lesson_error_tags as LocalState['lessonErrorTags'], ...local.lessonErrorTags } : local.lessonErrorTags,
    projectProgress: progress?.project_progress && typeof progress.project_progress === 'object' ? { ...progress.project_progress as LocalState['projectProgress'], ...local.projectProgress } : local.projectProgress,
    portfolioProofs: Array.isArray(progress?.portfolio_proofs) && progress.portfolio_proofs.length > local.portfolioProofs.length ? progress.portfolio_proofs as LocalState['portfolioProofs'] : local.portfolioProofs,
    onboardingComplete: local.onboardingComplete || Boolean(profile?.display_name),
  };
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
        settings: { onboardingComplete: state.onboardingComplete },
        updated_at: updatedAt,
      }),
    }),
  ]);
  if (!profileResponse.ok) throw await parseError(profileResponse);
  if (!progressResponse.ok) throw await parseError(progressResponse);
  return current;
}
