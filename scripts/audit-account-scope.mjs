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
  /function ownerBindingWasInitialized\(\): boolean \{[\s\S]*return ownerBoundMarker\.exists;[\s\S]*catch \{[\s\S]*return true;/,
  'Owner-binding metadata lookup must fail closed when the filesystem cannot prove account ownership state.',
);
requirePattern(
  /export function bindLocalStateOwner\(userId: string\): void \{[\s\S]*ownerFile\.write\(normalized\);[\s\S]*ownerBoundMarker\.write\('1'\);/,
  'Binding an authenticated learner must persist both the owner identity and the initialized marker.',
);
requirePattern(
  /if \(!normalized\) return freshState\(\);/,
  'An empty authenticated user id must never inherit existing local learning state.',
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

console.log('Account scope audit OK: legacy migration stays one-time, lost ownership metadata fails closed, and cross-account learning state remains isolated.');
