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
  ['structured evaluation gate set', 'const AUTOMATIC_GATE_REQUIRED_KINDS = new Set<ExerciseKind>(['],
  ['mcq requires automatic gate', "'mcq',"],
  ['predict output requires automatic gate', "'predict-output',"],
  ['fill code requires automatic gate', "'fill-code',"],
  ['order steps requires automatic gate', "'order-steps',"],
  ['debug requires automatic gate', "'debug',"],
  ['write code requires automatic gate', "'write-code',"],
  ['refactor requires automatic gate', "'refactor',"],
  ['substantive gate', 'const hasSubstantiveAnswer = hasSubstantiveOpenEndedAnswer(exercise, answerText);'],
  ['evaluation readiness', 'const evaluable = hasAutomaticGate || !requiresAutomaticGate;'],
  ['gated pass boundary', 'const passed = evaluable && (hasAutomaticGate ? directPassed && testPassed : hasSubstantiveAnswer);'],
  ['missing gate feedback', 'Cet exercice n’a pas encore de clé de correction fiable.'],
  ['missing gate tag', "misconceptionTags.push('evaluation-gate-missing');"],
  ['ungated structured score zero', 'const score = !evaluable'],
  ['reasoning feedback', 'La longueur seule ne démontre pas encore ton raisonnement.'],
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
  ['ungated structured auto-pass', 'const passed = hasAutomaticGate ? directPassed && testPassed : hasSubstantiveAnswer;'],
  ['ungated structured 100 score', 'const score = !hasAutomaticGate ? (hasSubstantiveAnswer ? 100 : 0)'],
];

const unsafe = unsafePatterns.filter(([, marker]) => source.includes(marker));
if (unsafe.length) {
  console.error('Open-ended exercise audit failed:');
  for (const [label] of unsafe) console.error(`- unsafe ${label}`);
  process.exit(1);
}

console.log('Open-ended exercise audit passed: structured activities need a real correction gate, while genuine explanation prompts keep substantive-answer validation.');