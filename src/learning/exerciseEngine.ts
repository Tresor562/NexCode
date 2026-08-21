import { ExerciseKind, ExerciseSpec, Lesson } from '../data/curriculumCore';

export type ExerciseAnswer = string | string[] | number;

export type ExerciseTest = {
  id: string;
  description: string;
  hidden?: boolean;
  kind: 'contains' | 'not-contains' | 'equals' | 'regex' | 'ordered-fragments';
  expected: string | string[];
};

export type RichExercise = ExerciseSpec & {
  instructions?: string;
  starterCode?: string;
  expectedAnswer?: ExerciseAnswer;
  acceptedAnswers?: ExerciseAnswer[];
  tests?: ExerciseTest[];
  explanation?: string;
  maxAttemptsBeforeHint?: number;
};

export type ExerciseEvaluation = {
  passed: boolean;
  score: number;
  visibleResults: Array<{ id: string; passed: boolean; description: string }>;
  hiddenPassed: number;
  hiddenTotal: number;
  feedback: string[];
  misconceptionTags: string[];
};

export type ScaffoldingLevel = 'try-first' | 'nudge' | 'hint' | 'worked-example' | 'solution-review';

export type ExerciseScaffold = {
  level: ScaffoldingLevel;
  title: string;
  message: string;
  hint?: string;
  shouldRevealExplanation: boolean;
  shouldRevealSolution: boolean;
};

export const supportedExerciseKinds: ExerciseKind[] = [
  'mcq', 'predict-output', 'fill-code', 'order-steps', 'debug', 'write-code', 'refactor', 'explain',
];

function normalize(value: ExerciseAnswer) {
  return Array.isArray(value) ? value.join('\n').trim() : String(value).trim();
}

function testSource(source: string, test: ExerciseTest) {
  const expected = test.expected;
  if (test.kind === 'contains') return source.includes(String(expected));
  if (test.kind === 'not-contains') return !source.includes(String(expected));
  if (test.kind === 'equals') return source.trim() === String(expected).trim();
  if (test.kind === 'regex') {
    try { return new RegExp(String(expected), 'm').test(source); } catch { return false; }
  }
  if (test.kind === 'ordered-fragments') {
    const fragments = Array.isArray(expected) ? expected : [String(expected)];
    let cursor = -1;
    return fragments.every((fragment) => {
      const index = source.indexOf(fragment, cursor + 1);
      if (index < 0) return false;
      cursor = index;
      return true;
    });
  }
  return false;
}

function misconceptionTag(test: ExerciseTest) {
  if (test.kind === 'ordered-fragments') return `structure:${test.id}`;
  if (test.kind === 'not-contains') return `remove:${test.id}`;
  if (test.kind === 'regex') return `syntax:${test.id}`;
  if (test.kind === 'equals') return `precision:${test.id}`;
  return `concept:${test.id}`;
}

export function evaluateExercise(exercise: RichExercise, answer: ExerciseAnswer): ExerciseEvaluation {
  const feedback: string[] = [];
  const misconceptionTags: string[] = [];
  const answerText = normalize(answer);
  const accepted = [exercise.expectedAnswer, ...(exercise.acceptedAnswers ?? [])].filter((item): item is ExerciseAnswer => item !== undefined);
  const directPassed = accepted.length === 0 || accepted.some((item) => normalize(item) === answerText);
  const results = (exercise.tests ?? []).map((test) => ({ test, passed: testSource(answerText, test) }));
  const visibleResults = results.filter(({ test }) => !test.hidden).map(({ test, passed }) => ({ id: test.id, passed, description: test.description }));
  const hidden = results.filter(({ test }) => test.hidden);
  const hiddenPassed = hidden.filter((item) => item.passed).length;
  const testPassed = results.length === 0 || results.every((item) => item.passed);
  const passed = directPassed && testPassed;

  if (!directPassed) {
    feedback.push('Le comportement final n’est pas encore celui demandé. Compare ton résultat à l’objectif, sans repartir de zéro.');
    misconceptionTags.push('expected-behavior');
  }

  for (const item of results) {
    if (item.passed) continue;
    misconceptionTags.push(misconceptionTag(item.test));
    if (!item.test.hidden) feedback.push(`Point à vérifier : ${item.test.description}`);
  }

  if (hidden.length && hiddenPassed < hidden.length) {
    feedback.push('Ta solution fonctionne dans le cas principal, mais un cas limite casse encore. Cherche une entrée inhabituelle.');
    misconceptionTags.push('edge-case');
  }

  if (passed) feedback.push('Exercice validé. Avant de continuer, explique en une phrase pourquoi ta solution fonctionne.');

  const checks = Math.max(1, (accepted.length ? 1 : 0) + results.length);
  const successes = (accepted.length ? (directPassed ? 1 : 0) : 0) + results.filter((item) => item.passed).length;
  const score = results.length === 0 && accepted.length === 0 ? (answerText ? 100 : 0) : Math.round((successes / checks) * 100);

  return {
    passed,
    score,
    visibleResults,
    hiddenPassed,
    hiddenTotal: hidden.length,
    feedback,
    misconceptionTags: [...new Set(misconceptionTags)],
  };
}

export function lessonExerciseCoverage(lesson: Lesson) {
  const kinds = [...new Set((lesson.exercises ?? []).map((exercise) => exercise.kind))];
  const missing = supportedExerciseKinds.filter((kind) => !kinds.includes(kind));
  return { kinds, missing, varietyScore: Math.round((kinds.length / supportedExerciseKinds.length) * 100) };
}

export function nextHint(exercise: RichExercise, attempts: number) {
  const hints = exercise.hints ?? [];
  if (!hints.length) return undefined;
  const threshold = Math.max(1, exercise.maxAttemptsBeforeHint ?? 1);
  if (attempts < threshold) return undefined;
  const index = Math.min(hints.length - 1, Math.floor((attempts - threshold) / threshold));
  return hints[index];
}

export function exerciseScaffold(exercise: RichExercise, attempts: number, evaluation?: ExerciseEvaluation): ExerciseScaffold {
  const safeAttempts = Math.max(0, attempts);
  const hint = nextHint(exercise, safeAttempts);

  if (evaluation?.passed) {
    return {
      level: 'solution-review',
      title: 'Validé — explique-le',
      message: 'Ne passe pas tout de suite à la suite : formule mentalement pourquoi ta solution marche. Cette étape consolide la maîtrise.',
      shouldRevealExplanation: true,
      shouldRevealSolution: false,
    };
  }

  if (safeAttempts <= 0) {
    return {
      level: 'try-first',
      title: 'Essaie sans aide',
      message: 'Fais une première tentative complète. Même imparfaite, elle donne un meilleur signal sur ce que tu sais réellement.',
      shouldRevealExplanation: false,
      shouldRevealSolution: false,
    };
  }

  if (safeAttempts === 1) {
    return {
      level: 'nudge',
      title: 'Tu es en train d’apprendre',
      message: evaluation?.feedback[0] ?? 'Relis l’objectif et modifie seulement la partie qui semble responsable du résultat.',
      shouldRevealExplanation: false,
      shouldRevealSolution: false,
    };
  }

  if (safeAttempts <= 3) {
    return {
      level: 'hint',
      title: hint ? 'Indice débloqué' : 'Réduis le problème',
      message: hint ?? evaluation?.feedback[0] ?? 'Teste une hypothèse à la fois et observe ce qui change.',
      hint,
      shouldRevealExplanation: false,
      shouldRevealSolution: false,
    };
  }

  if (safeAttempts <= 5) {
    return {
      level: 'worked-example',
      title: 'Regarde un raisonnement proche',
      message: exercise.explanation ?? 'Reviens au concept de la leçon, identifie la règle utilisée, puis applique-la à ton propre code sans recopier une solution complète.',
      hint,
      shouldRevealExplanation: true,
      shouldRevealSolution: false,
    };
  }

  return {
    level: 'solution-review',
    title: 'Étudie puis reconstruis',
    message: exercise.explanation ?? 'Analyse la solution attendue, ferme-la, puis reconstruis la réponse de mémoire avant de continuer.',
    hint,
    shouldRevealExplanation: true,
    shouldRevealSolution: true,
  };
}
