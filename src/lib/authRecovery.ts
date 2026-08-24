import { cloudConfig } from './cloudAccount';

type Env = Record<string, string | undefined>;

function env(): Env {
  return ((globalThis as typeof globalThis & { process?: { env?: Env } }).process?.env ?? {}) as Env;
}

function recoveryRedirectUrl(): string | undefined {
  const value = env().EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL?.trim();
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'nexcode:') return undefined;
    return parsed.toString();
  } catch {
    return undefined;
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

  const redirectTo = recoveryRedirectUrl();
  const body: Record<string, string> = { email: normalizedEmail };
  if (redirectTo) body.redirect_to = redirectTo;

  const response = await fetch(`${config.url}/auth/v1/recover`, {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw await recoveryError(response);
}
