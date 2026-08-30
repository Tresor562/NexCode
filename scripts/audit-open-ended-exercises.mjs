import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/learning/exerciseEngine.ts', import.meta.url), 'utf8');

const expectations = [
  ['meaningful word counter', 'function meaningfulWordCount(source: string)'],
  ['unicode-aware word normalization', ".normalize('NFKC')"],
  ['explain semantic minimum', 'answerText.length >= 16 && meaningfulWordCount(answerText) >= 3'],
  ['code comment stripping', 'function stripCodeComments(source: string)'],
  ['block comment stripping', ".replace(/\\/\\*[\\s\\S]*?\\*\\//g, ' ')"],
  ['line comment stripping', ".replace(/(^|\\s)\\/\\/.*$/gm, '$1')"],
  ['hash comment stripping', ".replace(/(^|\\s)#.*$/gm, '$1')"],
  ['code executable signal', 'const executableSignal = stripCodeComments(answerText).trim();'],
  ['code alphanumeric signal', '/[\\p{L}\\p{N}_]/u.test(executableSignal)'],
  ['substantive gate', 'const hasSubstantiveAnswer = hasSubstantiveOpenEndedAnswer(exercise, answerText);'],
  ['open-ended pass gate', 'const passed = hasAutomaticGate ? directPassed && testPassed : hasSubstantiveAnswer;'],
  ['open-ended score gate', 'const score = !hasAutomaticGate ? (hasSubstantiveAnswer ? 100 : 0)'],
  ['reasoning feedback', 'La longueur seule ne démontre pas encore ton raisonnement.'],
  ['comment-only feedback', 'Des commentaires, espaces ou symboles seuls ne comptent pas comme une solution.'],
  ['finite attempt guard', 'if (!Number.isFinite(attempts)) return 0;'],
  ['integer attempt normalization', 'return Math.max(0, Math.floor(attempts));'],
  ['finite hint threshold guard', 'if (value === undefined || !Number.isFinite(value)) return 1;'],
  ['positive hint threshold', 'return Math.max(1, Math.floor(value));'],
  ['safe hint attempts', 'const safeAttempts = normalizeAttemptCount(attempts);'],
  ['safe scaffold attempts', 'const safeAttempts = normalizeAttemptCount(attempts);'],
];

const missing = expectations.filter(([, marker]) => !source.includes(marker));
if (missing.length) {
  console.error('Open-ended exercise audit failed:');
  for (const [label] of missing) console.error(`- missing ${label}`);
  process.exit(1);
}

const unsafePatterns = [
  ['raw scaffold max', 'const safeAttempts = Math.max(0, attempts);'],
  ['raw hint threshold', 'Math.max(1, exercise.maxAttemptsBeforeHint ?? 1)'],
];

const unsafe = unsafePatterns.filter(([, marker]) => source.includes(marker));
if (unsafe.length) {
  console.error('Open-ended exercise audit failed:');
  for (const [label] of unsafe) console.error(`- unsafe ${label}`);
  process.exit(1);
}

console.log('Open-ended exercise audit passed.');
