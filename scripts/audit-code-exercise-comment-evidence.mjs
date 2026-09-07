import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/learning/exerciseEngine.ts', import.meta.url), 'utf8');

const expectations = [
  ['code evidence kind set', 'const CODE_EVIDENCE_KINDS = new Set<ExerciseKind>(['],
  ['fill-code protected', "'fill-code',"],
  ['debug protected', "'debug',"],
  ['write-code protected', "'write-code',"],
  ['refactor protected', "'refactor',"],
  ['test source boundary', 'function sourceForExerciseTests(exercise: RichExercise, answerText: string)'],
  ['non-code answers preserved', 'if (!CODE_EVIDENCE_KINDS.has(exercise.kind)) return answerText;'],
  ['code comments removed before tests', 'return stripCodeComments(answerText);'],
  ['evaluation uses sanitized evidence', 'const evidenceSource = sourceForExerciseTests(exercise, answerText);'],
  ['tests consume sanitized evidence', 'passed: testSource(evidenceSource, test)'],
];

const missing = expectations.filter(([, marker]) => !source.includes(marker));
if (missing.length) {
  console.error('Code exercise comment-evidence audit failed:');
  for (const [label] of missing) console.error(`- missing ${label}`);
  process.exit(1);
}

const unsafe = [
  ['tests still consume raw answer text', 'passed: testSource(answerText, test)'],
].filter(([, marker]) => source.includes(marker));

if (unsafe.length) {
  console.error('Code exercise comment-evidence audit failed:');
  for (const [label] of unsafe) console.error(`- unsafe ${label}`);
  process.exit(1);
}

console.log('Code exercise comment-evidence audit passed: code-oriented tests require executable evidence rather than fragments hidden only in comments.');
