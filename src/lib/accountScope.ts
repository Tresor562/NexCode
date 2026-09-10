import { File, Paths } from 'expo-file-system';
import { sanitizeLocalState, type LocalState } from './localState';

const ownerFile = new File(Paths.document, 'nexcode-local-owner.txt');
const ownerBoundMarker = new File(Paths.document, 'nexcode-local-owner-bound-v1');
const SUPABASE_USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

function normalizeAccountId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  // Supabase Auth user ids are canonical UUIDs. Treat owner metadata as a strict
  // identity boundary rather than a generic string: accepting arbitrary ids here
  // makes corrupted disk/session data capable of claiming another learner's local
  // XP, projects, drafts and mastery. Canonical lowercase also avoids accidental
  // case-only mismatches after a restore. The nil UUID is a sentinel, never a
  // learner identity, so it must fail closed instead of becoming a shared owner.
  if (!SUPABASE_USER_ID_PATTERN.test(normalized) || normalized.toLowerCase() === NIL_UUID) return null;
  return normalized.toLowerCase();
}

function readOwnerId(): string | null {
  try {
    if (!ownerFile.exists) return null;
    return normalizeAccountId(ownerFile.textSync());
  } catch {
    return null;
  }
}

function ownerMetadataExists(): boolean {
  try {
    return ownerFile.exists;
  } catch {
    // An unreadable owner file is still evidence that this install may already
    // have been account-bound. Never reinterpret that uncertainty as a pristine
    // legacy install whose progression can be adopted by the next account.
    return true;
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
    // Persist the fail-closed marker before the identity itself. A crash or storage
    // failure between these two writes must never make a partially initialized
    // modern install look like a pre-account-scope legacy install, otherwise the
    // next authenticated learner could inherit unproven XP, drafts or mastery.
    if (!ownerBoundMarker.exists) ownerBoundMarker.create();
    ownerBoundMarker.write('1');

    if (!ownerFile.exists) ownerFile.create();
    ownerFile.write(normalized);
  } catch {
    // Cloud hydration can still continue. Because the initialized marker is written
    // first, a missing/corrupt owner file fails closed on the next scope decision.
  }
}

function freshState(): LocalState {
  // Account isolation must evolve with the canonical local-state schema. Building
  // the empty account through the same sanitizer/default boundary used at startup
  // prevents newly introduced progression fields from being forgotten here and
  // accidentally surviving an account switch or becoming undefined after one.
  return sanitizeLocalState({});
}

export function scopeLocalStateForUser(local: LocalState, userId: string): LocalState {
  const normalized = normalizeAccountId(userId);
  if (!normalized) return freshState();

  // Re-enter the canonical state boundary at the ownership handoff too. Startup
  // normally provides an already-sanitized snapshot, but account switching and
  // cloud hydration are security/reliability boundaries: a malformed in-memory or
  // restored payload must not bypass the same XP, streak, draft and mastery guards
  // merely because its owner id is valid.
  const safeLocal = sanitizeLocalState(local);
  const ownerId = readOwnerId();

  // Existing installs predate owner binding. They may adopt their snapshot once
  // only when there is genuinely no owner metadata and no evidence account scoping
  // was ever initialized. A present-but-corrupt owner file is not a legacy state:
  // its previous owner cannot be proven, so fail closed instead of leaking XP,
  // NexCoins, projects or mastery into the next authenticated account.
  if (!ownerId) {
    const ownershipEvidenceExists = ownerMetadataExists() || ownerBindingWasInitialized();
    return ownershipEvidenceExists ? freshState() : safeLocal;
  }

  // Once an owner is known, never merge that learner's local XP, projects,
  // drafts or mastery into another authenticated account.
  return ownerId === normalized ? safeLocal : freshState();
}
