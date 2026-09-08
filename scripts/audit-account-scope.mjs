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
  /const SUPABASE_USER_ID_PATTERN = \/\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}\$\/i;/,
  'Authenticated Supabase account identifiers must remain canonical UUIDs.',
);
requirePattern(
  /function normalizeAccountId\(value: unknown\): string \| null \{[\s\S]*typeof value !== 'string'[\s\S]*SUPABASE_USER_ID_PATTERN\.test\(normalized\)[\s\S]*return normalized\.toLowerCase\(\);/,
  'Account identifiers must reject malformed persisted/session ids and canonicalize UUID casing before ownership decisions.',
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
  /export function bindLocalStateOwner\(userId: string\): void \{[\s\S]*const normalized = normalizeAccountId\(userId\);[\s\S]*if \(!normalized\) return;[\s\S]*ownerBoundMarker\.write\('1'\);[\s\S]*ownerFile\.write\(normalized\);/,
  'Binding must persist the fail-closed initialized marker before owner identity so interrupted writes cannot reopen legacy state adoption.',
);
const markerWriteIndex = source.indexOf("ownerBoundMarker.write('1')");
const ownerWriteIndex = source.indexOf('ownerFile.write(normalized)');
if (markerWriteIndex < 0 || ownerWriteIndex < 0 || markerWriteIndex >= ownerWriteIndex) {
  throw new Error('Owner binding must commit the initialized marker before writing owner identity.');
}
requirePattern(
  /import \{ sanitizeLocalState, type LocalState \} from '\.\/localState';/,
  'Fresh account state must come from the canonical local-state sanitizer/default boundary.',
);
requirePattern(
  /function freshState\(\): LocalState \{[\s\S]*return sanitizeLocalState\(\{\}\);[\s\S]*\}/,
  'Cross-account resets must derive every current and future progression field from canonical defaults instead of duplicating the schema.',
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
if (/function freshState\(\)[\s\S]*xp: 0,[\s\S]*nexCoins: 0,[\s\S]*projectDrafts: \{\}/.test(source)) {
  throw new Error('Fresh account state must not duplicate progression defaults locally; schema drift would weaken future account isolation.');
}

console.log('Account scope audit OK: ownership initialization is fail-closed, Supabase UUIDs are canonicalized, legacy migration stays one-time, cross-account resets share canonical local defaults, and learner progression remains isolated as the state schema evolves.');
