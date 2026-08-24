import { CloudSession, cloudConfig, saveCloudSession } from './cloudAccount';

type Env = Record<string, string | undefined>;

type RecoveryPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: string;
  expires_at?: string;
  type?: string;
  error?: string;
  error_code?: string;
  error_description?: string;
};

const DEFAULT_PASSWORD_RESET_REDIRECT_URL = 'nexcode://auth/reset';

function env(): Env {
  return ((globalThis as typeof globalThis & { process?: { env?: Env } }).process?.env ?? {}) as Env;
}

function canonicalRecoveryTarget(value: string): string | undefined {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'nexcode:') return undefined;
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export function recoveryRedirectUrl(): string {
  const configured = env().EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL?.trim();
  return (configured && canonicalRecoveryTarget(configured)) || DEFAULT_PASSWORD_RESET_REDIRECT_URL;
}

function recoveryTargetMatches(url: URL): boolean {
  const expectedValue = canonicalRecoveryTarget(recoveryRedirectUrl());
  if (!expectedValue) return false;
  const candidate = new URL(url.toString());
  candidate.search = '';
  candidate.hash = '';
  return candidate.toString() === expectedValue;
}

function recoveryParams(url: URL): RecoveryPayload {
  const values = new URLSearchParams(url.search);
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  const hashValues = new URLSearchParams(hash);
  for (const [key, value] of hashValues.entries()) values.set(key, value);
  return Object.fromEntries(values.entries()) as RecoveryPayload;
}

async function recoveryError(response: Response): Promise<Error> {
  try {
    const payload = (await response.json()) as { msg?: string; message?: string; error_description?: string; error?: string };
    return new Error(payload.msg ?? payload.message ?? payload.error_description ?? payload.error ?? `Erreur réseau (${response.status})`);
  } catch {
    return new Error(`Erreur réseau (${response.status})`);
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  const config = cloudConfig();
  if (!config) throw new Error('Supabase n’est pas encore configuré pour ce build.');

  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('Entre une adresse email valide.');
  }

  const response = await fetch(`${config.url}/auth/v1/recover`, {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: normalizedEmail, redirect_to: recoveryRedirectUrl() }),
  });

  if (!response.ok) throw await recoveryError(response);
}

export async function consumePasswordRecoveryUrl(value: string): Promise<CloudSession | null> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (!recoveryTargetMatches(url)) return null;

  const payload = recoveryParams(url);
  if (payload.error || payload.error_code || payload.error_description) {
    throw new Error(payload.error_description ?? 'Ce lien de réinitialisation est invalide ou a expiré.');
  }
  if (payload.type && payload.type !== 'recovery') return null;
  if (!payload.access_token || !payload.refresh_token) {
    throw new Error('Ce lien de réinitialisation ne contient plus de session valide. Demande un nouveau lien.');
  }

  const config = cloudConfig();
  if (!config) throw new Error('Supabase n’est pas encore configuré pour ce build.');
  const userResponse = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${payload.access_token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!userResponse.ok) throw await recoveryError(userResponse);
  const user = (await userResponse.json()) as { id?: string; email?: string };
  if (!user.id) throw new Error('Impossible de vérifier ce lien de réinitialisation. Demande un nouveau lien.');

  const expiresAtSeconds = Number(payload.expires_at);
  const expiresInSeconds = Number(payload.expires_in);
  const expiresAt = Number.isFinite(expiresAtSeconds) && expiresAtSeconds > 0
    ? expiresAtSeconds * 1000
    : Date.now() + (Number.isFinite(expiresInSeconds) && expiresInSeconds > 0 ? expiresInSeconds : 3600) * 1000;

  const session: CloudSession = {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt,
    user: { id: user.id, email: user.email },
  };
  saveCloudSession(session);
  return session;
}

export async function updatePasswordFromRecoverySession(session: CloudSession, password: string): Promise<CloudSession> {
  const config = cloudConfig();
  if (!config) throw new Error('Supabase n’est pas encore configuré pour ce build.');
  if (password.length < 6) throw new Error('Ton nouveau mot de passe doit contenir au moins 6 caractères.');

  const response = await fetch(`${config.url}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  });
  if (!response.ok) throw await recoveryError(response);
  const user = (await response.json()) as { id?: string; email?: string };
  if (user.id && user.id !== session.user.id) {
    throw new Error('La session de récupération ne correspond plus à ce compte. Demande un nouveau lien.');
  }

  const updated: CloudSession = {
    ...session,
    user: { id: session.user.id, email: user.email ?? session.user.email },
  };
  saveCloudSession(updated);
  return updated;
}
