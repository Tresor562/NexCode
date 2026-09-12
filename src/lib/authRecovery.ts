import { CloudSession, cloudConfig } from './cloudAccount';

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
const MAX_RECOVERY_TOKEN_LENGTH = 8192;
const RECOVERY_FETCH_TIMEOUT_MS = 12_000;

function env(): Env {
  return ((globalThis as typeof globalThis & { process?: { env?: Env } }).process?.env ?? {}) as Env;
}

function canonicalRecoveryTarget(value: string): string | undefined {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'nexcode:') return undefined;
    if (parsed.username || parsed.password) return undefined;
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

function validRecoveryToken(value: unknown): value is string {
  return typeof value === 'string'
    && value.length >= 16
    && value.length <= MAX_RECOVERY_TOKEN_LENGTH
    && !/[\s\u0000-\u001f\u007f]/.test(value);
}

async function recoveryFetch(input: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RECOVERY_FETCH_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('Le service de compte met trop de temps à répondre. Réessaie dans quelques instants.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
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

  const response = await recoveryFetch(`${config.url}/auth/v1/recover`, {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: normalizedEmail, redirect_to: recoveryRedirectUrl() }),
  });

  // Never surface provider-specific recovery errors here. Different backend
  // responses must not become an account-enumeration oracle in the sign-in UI.
  if (!response.ok) throw new Error('Impossible d’envoyer le lien pour le moment. Réessaie dans quelques instants.');
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
  // A normal Supabase auth callback must never be promoted into the password
  // reset UI simply because it contains otherwise-valid session credentials.
  // Recovery is a privileged flow, so require the explicit recovery marker.
  if (payload.type !== 'recovery') return null;
  if (!validRecoveryToken(payload.access_token) || !validRecoveryToken(payload.refresh_token)) {
    throw new Error('Ce lien de réinitialisation ne contient plus de session valide. Demande un nouveau lien.');
  }

  const config = cloudConfig();
  if (!config) throw new Error('Supabase n’est pas encore configuré pour ce build.');
  const userResponse = await recoveryFetch(`${config.url}/auth/v1/user`, {
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

  // Recovery credentials are intentionally ephemeral. Persisting them here
  // would let a crash/restart promote a short-lived password-reset session to
  // the app's normal authenticated session before the password was changed.
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt,
    user: { id: user.id, email: user.email },
  };
}

export async function updatePasswordFromRecoverySession(session: CloudSession, password: string): Promise<CloudSession> {
  const config = cloudConfig();
  if (!config) throw new Error('Supabase n’est pas encore configuré pour ce build.');
  if (password.length < 6) throw new Error('Ton nouveau mot de passe doit contenir au moins 6 caractères.');

  const response = await recoveryFetch(`${config.url}/auth/v1/user`, {
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

  // The caller decides when this verified session becomes the normal app
  // session. Keeping persistence outside this recovery helper prevents a
  // half-finished reset from leaking credentials into startup hydration.
  return {
    ...session,
    user: { id: session.user.id, email: user.email ?? session.user.email },
  };
}
