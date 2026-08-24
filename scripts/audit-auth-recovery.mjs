import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const recovery = fs.readFileSync(path.join(root, 'src/lib/authRecovery.ts'), 'utf8');
const rootApp = fs.readFileSync(path.join(root, 'src/ui/RootApp.tsx'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(`Auth recovery audit failed: ${message}`);
}

assert(recovery.includes("const DEFAULT_PASSWORD_RESET_REDIRECT_URL = 'nexcode://auth/reset'"), 'native recovery target must stay explicit');
assert(recovery.includes("payload.type !== 'recovery'"), 'non-recovery callbacks must be rejected');
assert(recovery.includes('/auth/v1/user'), 'recovery token must be verified with Supabase before reset UI');
assert(!recovery.includes('saveCloudSession('), 'recovery helper must never persist short-lived recovery credentials');
assert(recovery.includes('user.id !== session.user.id'), 'password update must remain bound to the verified user');

const recoveryEffectStart = rootApp.indexOf('useEffect(() => {');
const hydrationEffectStart = rootApp.indexOf('useEffect(() => {', recoveryEffectStart + 1);
assert(recoveryEffectStart >= 0 && hydrationEffectStart > recoveryEffectStart, 'recovery deep-link effect must exist before hydration');
const recoveryEffect = rootApp.slice(recoveryEffectStart, hydrationEffectStart);
assert(recoveryEffect.includes('let recoveryRequestGeneration = 0;'), 'deep-link recovery must track request generations');
assert(recoveryEffect.includes('const generation = ++recoveryRequestGeneration;'), 'each recovery link must become the latest generation');
assert(recoveryEffect.includes('generation !== recoveryRequestGeneration'), 'stale recovery responses must be ignored');
assert(recoveryEffect.includes('recoveryRequestGeneration += 1;'), 'unmount must invalidate in-flight recovery work');

const completeStart = rootApp.indexOf('async function completePasswordReset');
const cancelStart = rootApp.indexOf('function cancelPasswordReset');
assert(completeStart >= 0 && cancelStart > completeStart, 'reset completion and cancellation handlers must exist');
const completion = rootApp.slice(completeStart, cancelStart);
const cancellation = rootApp.slice(cancelStart, rootApp.indexOf("if (!launched)", cancelStart));

assert(completion.includes('saveCloudSession(updated);'), 'only a successful password reset may promote recovery credentials');
assert(completion.indexOf('saveCloudSession(updated);') < completion.indexOf('setSession(updated);'), 'persist verified session before normal app hydration resumes');
assert(cancellation.includes('const restored = loadCloudSession();'), 'cancel must restore the prior durable session');
assert(!cancellation.includes('saveCloudSession(null)'), 'cancel must not erase a pre-existing durable session');

console.log('Auth recovery audit OK: recovery credentials stay ephemeral and only the latest deep link may take over the reset flow.');
