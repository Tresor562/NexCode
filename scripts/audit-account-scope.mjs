import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const sourcePath = path.join(root, 'src/lib/accountScope.ts');
const source = fs.readFileSync(sourcePath, 'utf8');

function requirePattern(pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}

requirePattern(
  /const ownerFile = new File\(Paths\.document, 'nexcode-local-owner\.txt'\);/,
  'Account scope must keep a dedicated local owner identity file.',
);
requirePattern(
  /const ownerBoundMarker = new File\(Paths\.document, 'nexcode-local-owner-bound-v1'\);/,
  'Account scope must persist a durable marker once local ownership has been initialized.',
);
requirePattern(
  /const MAX_ACCOUNT_ID_CHARS = 160;/,
  'Authenticated account identifiers must have a bounded persisted representation.',
);
requirePattern(
  /function normalizeAccountId\(value: unknown\): string \| null \{[\s\S]*typeof value !== 'string'[\s\S]*normalized\.length > MAX_ACCOUNT_ID_CHARS[\s\S]*\\u0000-\\u001f\\u007f[\s\S]*return normalized;/,
  'Account identifiers must reject empty, oversized, and control-character-corrupted values before ownership decisions.',
);
requirePattern(
  /return normalizeAccountId\(ownerFile\.textSync\(\)\);/,
  'Persisted owner metadata must pass through the same account-id validation as the authenticated session.',
);
requirePattern(
  /function ownerBindingWasInitialized\(\): boolean \{[\s\S]*return ownerBoundMarker\.exists;[\s\S]*catch \{[\s\S]*return true;/,
  'Owner-binding metadata lookup must fail closed when the filesystem cannot prove account ownership state.',
);
requirePattern(
  /export function bindLocalStateOwner\(userId: string\): void \{[\s\S]*const normalized = normalizeAccountId\(userId\);[\s\S]*if \(!normalized\) return;[\s\S]*ownerFile\.write\(normalized\);[\s\S]*ownerBoundMarker\.write\('1'\);/,
  'Binding an authenticated learner must validate and persist both the owner identity and the initialized marker.',
);
requirePattern(
  /export function scopeLocalStateForUser\(local: LocalState, userId: string\): LocalState \{[\s\S]*const normalized = normalizeAccountId\(userId\);[\s\S]*if \(!normalized\) return freshState\(\);/,
  'A malformed authenticated user id must never inherit existing local learning state.',
);
requirePattern(
  /if \(!ownerId\) \{[\s\S]*return ownerBindingWasInitialized\(\) \? freshState\(\) : local;[\s\S]*\}/,
  'Missing owner metadata may migrate a legacy snapshot only before account scoping has ever been initialized.',
);
requirePattern(
  /return ownerId === normalized \? local : freshState\(\);/,
  'A known local snapshot must be reused only by its exact authenticated owner.',
);
requirePattern(
  /xp: 0,[\s\S]*nexCoins: 0,[\s\S]*projectProgress: \{\},[\s\S]*projectDrafts: \{\},[\s\S]*mastery: \{\},[\s\S]*labDrafts: \{\}/,
  'Fresh account state must clear progression, currency, projects, mastery, and Lab drafts together.',
);

console.log('Account scope audit OK: account ids are bounded and validated, legacy migration stays one-time, lost ownership metadata fails closed, and cross-account learning state remains isolated.');
