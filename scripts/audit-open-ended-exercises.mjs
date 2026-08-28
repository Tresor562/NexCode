import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/learning/exerciseEngine.ts', import.meta.url), 'utf8');

const expectations = [
  ["explain minimum", "if (exercise.kind === 'explain') return 16;"],
  ["code minimum", "exercise.kind === 'write-code' || exercise.kind === 'debug' || exercise.kind === 'refactor'"],
  ["substantive gate", "const hasSubstantiveAnswer = answerText.length >= minimumAnswerLength;"],
  ["open-ended pass gate", "const passed = hasAutomaticGate ? directPassed && testPassed : hasSubstantiveAnswer;"],
  ["open-ended score gate", "const score = !hasAutomaticGate ? (hasSubstantiveAnswer ? 100 : 0)"],
  ["reasoning feedback", "Un mot isolé ne démontre pas encore ton raisonnement."],
];

const missing = expectations.filter(([, marker]) => !source.includes(marker));
if (missing.length) {
  console.error('Open-ended exercise audit failed:');
  for (const [label] of missing) console.error(`- missing ${label}`);
  process.exit(1);
}

console.log('Open-ended exercise audit passed.');
