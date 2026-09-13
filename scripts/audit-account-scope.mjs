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
  /const NIL_UUID = '00000000-0000-0000-0000-000000000000';/,
  'Account scope must identify the nil UUID sentinel explicitly.',
);
requirePattern(
  /function normalizeAccountId\(value: unknown\): string \| null \{[\s\S]*typeof value !== 'string'[\s\S]*SUPABASE_USER_ID_PATTERN\.test\(normalized\)[\s\S]*normalized\.toLowerCase\(\) === NIL_UUID[\s\S]*return normalized\.toLowerCase\(\);/,
  'Account identifiers must reject malformed and nil UUID identities while canonicalizing valid Supabase UUID casing.',
);
requirePattern(
  /return normalizeAccountId\(ownerFile\.textSync\(\)\);/,
  'Persisted owner metadata must pass through the same account-id validation as the authenticated session.',
);
requirePattern(
  /function ownerMetadataExists\(\): boolean \{[\s\S]*return ownerFile\.exists;[\s\S]*catch \{[\s\S]*return true;/,
  'Owner metadata presence checks must fail closed when the filesystem cannot prove the owner file is absent.',
);
requirePattern(
  /function ownerBindingWasInitialized\(\): boolean \{[\s\S]*return ownerBoundMarker\.exists;[\s\S]*catch \{[\s\S]*return true;/,
  'Owner-binding metadata lookup must fail closed when the filesystem cannot prove account ownership state.',
);
requirePattern(
  /export function bindLocalStateOwner\(userId: string\): boolean \{[\s\S]*const normalized = normalizeAccountId\(userId\);[\s\S]*if \(!normalized\) return false;[\s\S]*ownerBoundMarker\.write\('1'\);[\s\S]*ownerFile\.write\(normalized\);[\s\S]*return ownerBindingWasInitialized\(\) && readOwnerId\(\) === normalized;[\s\S]*catch \{[\s\S]*return false;/,
  'Binding must report verified durable ownership and fail closed when owner metadata cannot be committed or re-read.',
);
const markerWriteIndex = source.indexOf("ownerBoundMarker.write('1')");
const ownerWriteIndex = source.indexOf('ownerFile.write(normalized)');
const ownerVerificationIndex = source.indexOf('return ownerBindingWasInitialized() && readOwnerId() === normalized');
if (markerWriteIndex < 0 || ownerWriteIndex < 0 || ownerVerificationIndex < 0 || markerWriteIndex >= ownerWriteIndex || ownerWriteIndex >= ownerVerificationIndex) {
  throw new Error('Owner binding must commit the initialized marker, write owner identity, then verify both before reporting success.');
}
requirePattern(
  /import \{ sanitizeLocalState, type LocalState \} from '\.\/localState';/,
  'Account ownership decisions must use the canonical local-state sanitizer/default boundary.',
);
requirePattern(
  /function freshState\(\): LocalState \{[\s\S]*return sanitizeLocalState\(\{\}\);[\s\S]*\}/,
  'Cross-account resets must derive every current and future progression field from canonical defaults instead of duplicating the schema.',
);
requirePattern(
  /export function scopeLocalStateForUser\(local: LocalState, userId: string\): LocalState \{[\s\S]*const normalized = normalizeAccountId\(userId\);[\s\S]*if \(!normalized\) return freshState\(\);[\s\S]*const safeLocal = sanitizeLocalState\(local\);/,
  'Valid owner handoffs must re-sanitize retained local state so malformed restored XP, streak, Lab or mastery data cannot bypass startup guards.',
);
requirePattern(
  /if \(!ownerId\) \{[\s\S]*const ownershipEvidenceExists = ownerMetadataExists\(\) \|\| ownerBindingWasInitialized\(\);[\s\S]*if \(ownershipEvidenceExists\) return freshState\(\);[\s\S]*if \(!bindLocalStateOwner\(normalized\)\) return freshState\(\);[\s\S]*return safeLocal;[\s\S]*\}/,
  'Legacy migration must expose retained progression only after the authenticated owner binding has been durably verified.',
);
requirePattern(
  /return ownerId === normalized \? safeLocal : freshState\(\);/,
  'A known local snapshot must be reused only by its exact authenticated owner and only after canonical state sanitization.',
);
if (/function freshState\(\)[\s\S]*xp: 0,[\s\S]*nexCoins: 0,[\s\S]*projectDrafts: \{\}/.test(source)) {
  throw new Error('Fresh account state must not duplicate progression defaults locally; schema drift would weaken future account isolation.');
}
if (/ownerId === normalized \? local : freshState\(\)/.test(source) || /\? freshState\(\) : local/.test(source)) {
  throw new Error('Account scope must never return a retained snapshot without passing it through sanitizeLocalState first.');
}
if (/return ownershipEvidenceExists \? freshState\(\) : safeLocal;/.test(source)) {
  throw new Error('Legacy progression adoption must not remain unbound after the ownership scope decision.');
}
if (/bindLocalStateOwner\(normalized\);\s*return safeLocal;/.test(source)) {
  throw new Error('Legacy progression must not be returned after a fire-and-forget owner binding attempt.');
}

console.log('Account scope audit OK: ownership initialization and corrupt owner metadata fail closed, Supabase UUIDs are canonicalized, owner binding is verified before legacy progression is exposed, retained snapshots are re-sanitized at the ownership boundary, and cross-account resets share canonical local defaults.');
