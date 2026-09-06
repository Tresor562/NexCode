import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/learning/exerciseEngine.ts', import.meta.url), 'utf8');

const expectations = [
  ['diagnostic nudge helper', 'function diagnosticNudge(evaluation?: ExerciseEvaluation)'],
  ['edge-case diagnosis', "if (hasTag('edge-case'))"],
  ['structure diagnosis', "if (hasPrefix('structure:'))"],
  ['removal diagnosis', "if (hasPrefix('remove:'))"],
  ['syntax diagnosis', "if (hasPrefix('syntax:'))"],
  ['precision diagnosis', "if (hasPrefix('precision:'))"],
  ['expected behavior diagnosis', "if (hasTag('expected-behavior'))"],
  ['concept diagnosis', "if (hasPrefix('concept:'))"],
  ['scaffold consumes diagnostic nudge', 'const nudge = diagnosticNudge(evaluation);'],
  ['first retry uses diagnostic nudge', "message: nudge ?? 'Relis l’objectif"],
  ['hint fallback uses diagnostic nudge', "message: hint ?? nudge ?? 'Teste une hypothèse"],
  ['hidden test ids are not surfaced in nudge copy', "const hasPrefix = (prefix: string) => tags.some((tag) => tag.startsWith(prefix));"],
];

const missing = expectations.filter(([, marker]) => !source.includes(marker));
if (missing.length) {
  console.error('Diagnostic scaffolding audit failed:');
  for (const [label] of missing) console.error(`- missing ${label}`);
  process.exit(1);
}

const unsafePatterns = [
  ['raw misconception tag echoed to learners', 'message: evaluation?.misconceptionTags'],
  ['raw hidden test id interpolated into nudge', '${tag}'],
  ['solution revealed during first retry', "level: 'nudge',\n      title: 'Tu es en train d’apprendre',\n      message: nudge ?? 'Relis l’objectif et modifie seulement la partie qui semble responsable du résultat.',\n      shouldRevealExplanation: true"],
];

const unsafe = unsafePatterns.filter(([, marker]) => source.includes(marker));
if (unsafe.length) {
  console.error('Diagnostic scaffolding audit failed:');
  for (const [label] of unsafe) console.error(`- unsafe ${label}`);
  process.exit(1);
}

console.log('Diagnostic scaffolding audit passed: retries use misconception-aware nudges without exposing hidden test identifiers or revealing solutions too early.');
