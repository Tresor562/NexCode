import fs from 'node:fs';

const root = fs.readFileSync(new URL('../src/ui/RootApp.tsx', import.meta.url), 'utf8');
const account = fs.readFileSync(new URL('../src/lib/cloudAccount.ts', import.meta.url), 'utf8');

function requireSource(source, fragment, message) {
  if (!source.includes(fragment)) throw new Error(message);
}

requireSource(
  account,
  "return status === 400 || status === 401 || status === 403;",
  'Terminal refresh failures must remain limited to invalid/unauthorized refresh tokens.',
);
requireSource(
  account,
  'saveCloudSession(null);',
  'Terminal refresh rejection must clear the persisted cloud session.',
);

const pullCatchStart = root.indexOf('.catch(() => {', root.indexOf('pullCloudState(session, scopedLocal)'));
const pullFinallyStart = root.indexOf('.finally(() => {', pullCatchStart);
if (pullCatchStart < 0 || pullFinallyStart < 0) {
  throw new Error('Could not isolate the initial cloud hydration failure handler.');
}
const pullCatch = root.slice(pullCatchStart, pullFinallyStart);

requireSource(
  pullCatch,
  'const persistedSession = loadCloudSession();',
  'Hydration failures must re-check the persisted auth boundary.',
);
requireSource(
  pullCatch,
  'if (!persistedSession || persistedSession.user.id !== session.user.id)',
  'Hydration must detect a cleared or account-switched persisted session.',
);
requireSource(
  pullCatch,
  'setSession(persistedSession);',
  'A terminal refresh failure must update the in-memory React session.',
);
requireSource(
  pullCatch,
  'setSyncNotice(null);',
  'A terminal auth failure must not masquerade as an offline sync fallback.',
);
requireSource(
  pullCatch,
  'bindLocalStateOwner(session.user.id);',
  'Transient failures must still preserve the signed-in learner local fallback.',
);
requireSource(
  pullCatch,
  "kind: 'offline-fallback'",
  'Transient cloud failures must still expose the safe offline fallback notice.',
);

const terminalGuard = pullCatch.indexOf('if (!persistedSession || persistedSession.user.id !== session.user.id)');
const fallbackBind = pullCatch.indexOf('bindLocalStateOwner(session.user.id);');
if (terminalGuard < 0 || fallbackBind < 0 || terminalGuard > fallbackBind) {
  throw new Error('Terminal auth handling must run before the transient offline fallback.');
}

console.log('Terminal cloud session handoff audit passed.');
