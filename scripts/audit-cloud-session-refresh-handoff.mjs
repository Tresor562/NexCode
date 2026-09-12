import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const source = fs.readFileSync(path.join(process.cwd(), 'src/lib/cloudSync.ts'), 'utf8');

function requirePattern(pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}

requirePattern(
  /import \{[^}]*refreshCloudSession[^}]*\} from '\.\/cloudAccount';/,
  'Cloud sync must have direct access to session refresh so it can verify the write generation before pushing progress.',
);

requirePattern(
  /const currentBeforePush = loadCloudSession\(\);[\s\S]*currentBeforePush\.user\.id !== snapshot\.userId[\s\S]*const verifiedWriteSession = await refreshCloudSession\(currentBeforePush\);/,
  'Cloud sync must verify learner identity before entering the asynchronous token-refresh boundary.',
);

requirePattern(
  /const verifiedWriteSession = await refreshCloudSession\(currentBeforePush\);[\s\S]*const currentAfterRefresh = loadCloudSession\(\);[\s\S]*currentAfterRefresh\.user\.id !== snapshot\.userId[\s\S]*currentAfterRefresh\.refreshToken !== verifiedWriteSession\.refreshToken/,
  'After token refresh, cloud sync must re-check both learner identity and refresh-token generation before any write starts.',
);

requirePattern(
  /throw new Error\('Cloud account changed during session refresh\.'\);[\s\S]*await pushCloudState\(verifiedWriteSession, safeReconciledState\);/,
  'A stale refreshed session must fail closed and only the re-verified session may be passed to pushCloudState.',
);

const refreshIndex = source.indexOf('const verifiedWriteSession = await refreshCloudSession(currentBeforePush);');
const persistedIndex = source.indexOf('const currentAfterRefresh = loadCloudSession();');
const pushIndex = source.indexOf('await pushCloudState(verifiedWriteSession, safeReconciledState);');
if (refreshIndex < 0 || persistedIndex <= refreshIndex || pushIndex <= persistedIndex) {
  throw new Error('Cloud write handoff ordering regressed: refresh, persisted-session verification, then push is required.');
}

if (/await pushCloudState\(currentBeforePush,\s*safeReconciledState\)/.test(source)) {
  throw new Error('Cloud sync must never write with the pre-refresh session after crossing an asynchronous refresh boundary.');
}

console.log('Cloud session refresh handoff audit OK: account changes during token refresh fail closed before XP, NexCoins, drafts or progress can be written.');
