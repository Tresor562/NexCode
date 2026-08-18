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

export function evaluateExercise(exercise: RichExercise, answer: ExerciseAnswer): ExerciseEvaluation {
  const feedback: string[] = [];
  const answerText = normalize(answer);
  const accepted = [exercise.expectedAnswer, ...(exercise.acceptedAnswers ?? [])].filter((item): item is ExerciseAnswer => item !== undefined);
  const directPassed = accepted.length === 0 || accepted.some((item) => normalize(item) === answerText);
  const results = (exercise.tests ?? []).map((test) => ({ test, passed: testSource(answerText, test) }));
  const visibleResults = results.filter(({ test }) => !test.hidden).map(({ test, passed }) => ({ id: test.id, passed, description: test.description }));
  const hidden = results.filter(({ test }) => test.hidden);
  const hiddenPassed = hidden.filter((item) => item.passed).length;
  const testPassed = results.length === 0 || results.every((item) => item.passed);
  const passed = directPassed && testPassed;
  if (!directPassed) feedback.push('La réponse ne correspond pas encore au comportement attendu.');
  for (const item of visibleResults) if (!item.passed) feedback.push(`À corriger : ${item.description}`);
  if (hidden.length && hiddenPassed < hidden.length) feedback.push('Certains cas limites ne passent pas encore.');
  if (passed) feedback.push('Exercice validé : explique maintenant pourquoi ta solution fonctionne.');
  const checks = Math.max(1, (accepted.length ? 1 : 0) + results.length);
  const successes = (accepted.length ? (directPassed ? 1 : 0) : 0) + results.filter((item) => item.passed).length;
  const score = results.length === 0 && accepted.length === 0 ? (answerText ? 100 : 0) : Math.round((successes / checks) * 100);
  return { passed, score, visibleResults, hiddenPassed, hiddenTotal: hidden.length, feedback };
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
