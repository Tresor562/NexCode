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

const AUTOMATIC_GATE_REQUIRED_KINDS = new Set<ExerciseKind>([
  'mcq',
  'predict-output',
  'fill-code',
  'order-steps',
  'debug',
  'write-code',
  'refactor',
]);

function normalize(value: ExerciseAnswer) {
  return Array.isArray(value) ? value.join('\n').trim() : String(value).trim();
}

function stripCodeComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|\s)\/\/.*$/gm, '$1')
    .replace(/(^|\s)#.*$/gm, '$1');
}

function meaningfulWordCount(source: string) {
  return source
    .normalize('NFKC')
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}_'-]/gu, ''))
    .filter((token) => token.length >= 2).length;
}

function hasSubstantiveOpenEndedAnswer(exercise: RichExercise, answerText: string) {
  if (exercise.kind === 'explain') {
    return answerText.length >= 16 && meaningfulWordCount(answerText) >= 3;
  }

  if (exercise.kind === 'write-code' || exercise.kind === 'debug' || exercise.kind === 'refactor') {
    const executableSignal = stripCodeComments(answerText).trim();
    return executableSignal.length >= 3 && /[\p{L}\p{N}_]/u.test(executableSignal);
  }

  return answerText.length >= 1;
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
  const hasDirectGate = accepted.length > 0;
  const directPassed = !hasDirectGate || accepted.some((item) => normalize(item) === answerText);
  const results = (exercise.tests ?? []).map((test) => ({ test, passed: testSource(answerText, test) }));
  const visibleResults = results.filter(({ test }) => !test.hidden).map(({ test, passed }) => ({ id: test.id, passed, description: test.description }));
  const hidden = results.filter(({ test }) => test.hidden);
  const hiddenPassed = hidden.filter((item) => item.passed).length;
  const hasTestGate = results.length > 0;
  const testPassed = !hasTestGate || results.every((item) => item.passed);
  const hasAutomaticGate = hasDirectGate || hasTestGate;
  const requiresAutomaticGate = AUTOMATIC_GATE_REQUIRED_KINDS.has(exercise.kind);
  const hasSubstantiveAnswer = hasSubstantiveOpenEndedAnswer(exercise, answerText);
  const evaluable = hasAutomaticGate || !requiresAutomaticGate;
  const passed = evaluable && (hasAutomaticGate ? directPassed && testPassed : hasSubstantiveAnswer);

  if (!evaluable) {
    feedback.push('Cet exercice n’a pas encore de clé de correction fiable. Il ne peut pas valider ta maîtrise tant qu’un résultat attendu ou des tests vérifiables ne sont pas définis.');
    misconceptionTags.push('evaluation-gate-missing');
  } else if (!hasAutomaticGate && !hasSubstantiveAnswer) {
    feedback.push(exercise.kind === 'explain'
      ? 'Développe ton explication avec plusieurs mots utiles et une idée complète avant de valider. La longueur seule ne démontre pas encore ton raisonnement.'
      : 'Écris d’abord une réponse exploitable avant de valider. Une tentative trop courte ne compte pas comme un exercice réussi.');
    misconceptionTags.push('input-required');
  }

  if (hasAutomaticGate && !directPassed) {
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

  if (passed) {
    feedback.push(hasAutomaticGate
      ? 'Exercice validé. Avant de continuer, explique en une phrase pourquoi ta solution fonctionne.'
      : 'Réponse enregistrée. Avant de continuer, vérifie qu’elle répond précisément à la consigne et explique ton raisonnement en une phrase.');
  }

  const checks = Math.max(1, (hasDirectGate ? 1 : 0) + results.length);
  const successes = (hasDirectGate ? (directPassed ? 1 : 0) : 0) + results.filter((item) => item.passed).length;
  const score = !evaluable
    ? 0
    : !hasAutomaticGate
      ? (hasSubstantiveAnswer ? 100 : 0)
      : Math.round((successes / checks) * 100);

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

function normalizeAttemptCount(attempts: number) {
  if (!Number.isFinite(attempts)) return 0;
  return Math.max(0, Math.floor(attempts));
}

function normalizeHintThreshold(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(value));
}

function diagnosticNudge(evaluation?: ExerciseEvaluation) {
  if (!evaluation || evaluation.passed) return undefined;
  const tags = evaluation.misconceptionTags;
  const hasTag = (tag: string) => tags.includes(tag);
  const hasPrefix = (prefix: string) => tags.some((tag) => tag.startsWith(prefix));

  if (hasTag('evaluation-gate-missing')) return 'Cette activité ne possède pas encore une correction automatique fiable. Ne transforme pas une absence de test en réussite : passe par une activité vérifiable.';
  if (hasTag('input-required')) return 'Commence par produire une vraie tentative. Écris l’idée ou le code que tu crois correct, puis utilise le retour pour ajuster une seule chose à la fois.';
  if (hasTag('edge-case')) return 'Le cas principal semble proche. Teste maintenant une valeur vide, minimale, maximale ou inattendue pour trouver la condition qui manque.';
  if (hasPrefix('structure:')) return 'Le contenu est peut-être présent, mais pas dans le bon ordre. Repère les étapes qui dépendent les unes des autres et reconstruis leur séquence.';
  if (hasPrefix('remove:')) return 'Une partie qui devait disparaître est encore présente. Cherche le comportement ou le fragment interdit avant d’ajouter du nouveau code.';
  if (hasPrefix('syntax:')) return 'La forme attendue n’est pas encore reconnue. Vérifie la ponctuation, les délimiteurs, le nom des éléments et la structure syntaxique autour de la zone modifiée.';
  if (hasPrefix('precision:')) return 'Tu es proche, mais la sortie doit être précise. Compare caractère par caractère la forme produite avec l’objectif, notamment espaces, casse et valeur finale.';
  if (hasTag('expected-behavior')) return 'Pars du résultat observable demandé. Identifie la plus petite différence entre ce que ton code produit et ce qu’il devrait produire, puis corrige uniquement cette cause.';
  if (hasPrefix('concept:')) return 'Le concept attendu n’apparaît pas encore dans ta réponse. Reviens à la règle centrale de la leçon et demande-toi où elle doit intervenir dans ta solution.';
  return evaluation.feedback[0];
}

export function nextHint(exercise: RichExercise, attempts: number) {
  const hints = exercise.hints ?? [];
  if (!hints.length) return undefined;
  const safeAttempts = normalizeAttemptCount(attempts);
  const threshold = normalizeHintThreshold(exercise.maxAttemptsBeforeHint);
  if (safeAttempts < threshold) return undefined;
  const index = Math.min(hints.length - 1, Math.floor((safeAttempts - threshold) / threshold));
  return hints[index];
}

export function exerciseScaffold(exercise: RichExercise, attempts: number, evaluation?: ExerciseEvaluation): ExerciseScaffold {
  const safeAttempts = normalizeAttemptCount(attempts);
  const hint = nextHint(exercise, safeAttempts);
  const nudge = diagnosticNudge(evaluation);

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
      message: nudge ?? 'Relis l’objectif et modifie seulement la partie qui semble responsable du résultat.',
      shouldRevealExplanation: false,
      shouldRevealSolution: false,
    };
  }

  if (safeAttempts <= 3) {
    return {
      level: 'hint',
      title: hint ? 'Indice débloqué' : 'Réduis le problème',
      message: hint ?? nudge ?? 'Teste une hypothèse à la fois et observe ce qui change.',
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
