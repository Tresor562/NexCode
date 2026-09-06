import { ActivityKind, Course, Lesson } from '../data/curriculumCore';
import { MasteryMap, SkillMastery } from './skillGraph';
import { courseMasterySnapshot } from './masteryEngine';

export type LearningFilter = {
  query?: string;
  kinds?: ActivityKind[];
  difficulty?: Array<1 | 2 | 3 | 4 | 5>;
  courseIds?: string[];
  onlyIncomplete?: boolean;
  onlyDueReview?: boolean;
};

export type LearningSearchResult = {
  course: Course;
  lesson: Lesson;
  chapterId: string;
  unitId: string;
  score: number;
};

const PROGRAMMING_IDENTITY_ALIASES = new Map([
  ['js', 'javascript'],
  ['ts', 'typescript'],
]);

const PROGRAMMING_IDENTITY_TERMS = new Set([
  'c',
  'c++',
  'c#',
  'dart',
  'go',
  'java',
  'javascript',
  'kotlin',
  'python',
  'r',
  'rust',
  'swift',
  'typescript',
]);

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_REVIEW_URGENCY_BONUS = 35;
const RECOMMENDATION_PREREQUISITE_GATE = 55;
const MAX_PREREQUISITE_PENALTY = 90;
const COMPLETED_NOT_DUE_PENALTY = 80;

function normalize(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalSearchToken(token: string) {
  return PROGRAMMING_IDENTITY_ALIASES.get(token) ?? token;
}

function tokenizeSearch(value: string) {
  return [...new Set(
    normalize(value)
      .split(/[^\p{L}\p{N}+#._-]+/u)
      .map((token) => canonicalSearchToken(token.trim()))
      .filter(Boolean),
  )];
}

function fieldMatchesTerm(value: string, term: string) {
  if (!PROGRAMMING_IDENTITY_TERMS.has(term)) return value.includes(term);
  return tokenizeSearch(value).includes(term);
}

function reviewIsDue(nextReviewAt: string | undefined, now: Date) {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) return false;
  if (!nextReviewAt) return true;
  const nextReviewMs = Date.parse(nextReviewAt);
  if (!Number.isFinite(nextReviewMs)) return true;
  return nextReviewMs <= nowMs;
}

function reviewUrgencyBonus(nextReviewAt: string | undefined, now: Date) {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) return 0;
  if (!nextReviewAt) return 12;
  const nextReviewMs = Date.parse(nextReviewAt);
  if (!Number.isFinite(nextReviewMs)) return 12;
  if (nextReviewMs > nowMs) return 0;

  const overdueDays = Math.max(0, Math.floor((nowMs - nextReviewMs) / DAY_MS));
  return Math.min(MAX_REVIEW_URGENCY_BONUS, 12 + Math.floor(Math.log2(overdueDays + 1) * 6));
}

function boundedMasteryScore(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : 0;
}

function prerequisiteReadinessPenalty(lesson: Lesson, mastery: MasteryMap) {
  const prerequisites = [...new Set(lesson.prerequisiteSkillIds ?? [])].filter(Boolean);
  if (!prerequisites.length) return 0;

  let penalty = 0;
  for (const skillId of prerequisites) {
    const state = mastery[skillId];
    if (!state) {
      penalty += 40;
      continue;
    }

    const score = boundedMasteryScore(state.score);
    if (score < RECOMMENDATION_PREREQUISITE_GATE) {
      const readinessGap = RECOMMENDATION_PREREQUISITE_GATE - score;
      penalty += 20 + Math.ceil((readinessGap / RECOMMENDATION_PREREQUISITE_GATE) * 25);
    }
  }

  return Math.min(MAX_PREREQUISITE_PENALTY, penalty);
}

function learningPriorityScore(lesson: Lesson, completed: Set<string>, mastery: MasteryMap, now: Date) {
  const skillStates = (lesson.skillIds ?? [])
    .map((skillId) => mastery[skillId])
    .filter((state): state is SkillMastery => Boolean(state));
  const dueStates = skillStates.filter((state) => reviewIsDue(state.nextReviewAt, now));
  const dueReview = dueStates.length > 0;
  const isCompleted = completed.has(lesson.id);
  const weakestSkill = skillStates.length
    ? Math.min(...skillStates.map((state) => boundedMasteryScore(state.score)))
    : 0;
  const reviewUrgency = dueStates.length
    ? Math.max(...dueStates.map((state) => reviewUrgencyBonus(state.nextReviewAt, now)))
    : 0;

  let score = 1;
  if (!isCompleted) score += 45;
  if (dueReview) score += 70 + reviewUrgency;
  if (isCompleted && !dueReview) score -= COMPLETED_NOT_DUE_PENALTY;
  score += Math.round((100 - weakestSkill) * 0.2);

  const kind = lesson.activityKind ?? 'learn';
  if (kind === 'review') score += dueReview ? 18 : 0;
  else if (kind === 'practice') score += 10;
  else if (kind === 'lab') score += 8;
  else if (kind === 'checkpoint' || kind === 'boss') score += 5;

  // Prerequisites should sequence unseen material, not suppress spaced repetition for
  // a lesson the learner has already completed. Once learned, a due review remains
  // actionable even if an upstream mastery score later decays below the new-content gate.
  if (!isCompleted) score -= prerequisiteReadinessPenalty(lesson, mastery);
  return score;
}

function weightedSearchScore(
  terms: string[],
  phrase: string,
  fields: Array<{ value: string; weight: number }>,
) {
  if (!terms.length) return 1;
  const normalizedFields = fields.map(({ value, weight }) => ({ value: normalize(value), weight }));
  if (!terms.every((term) => normalizedFields.some((field) => fieldMatchesTerm(field.value, term)))) return 0;

  let score = 0;
  for (const term of terms) {
    let bestWeight = 0;
    for (const field of normalizedFields) {
      if (fieldMatchesTerm(field.value, term)) bestWeight = Math.max(bestWeight, field.weight);
    }
    score += bestWeight;
  }

  const combined = normalizedFields.map((field) => field.value).join(' ');
  if (phrase && normalizedFields[0]?.value.includes(phrase)) score += 80;
  else if (phrase && combined.includes(phrase)) score += 35;

  return score;
}

export function searchLearningActivities(
  courses: Course[],
  filter: LearningFilter,
  completedLessonIds: string[],
  mastery: MasteryMap,
  now = new Date(),
): LearningSearchResult[] {
  const query = filter.query?.trim() ?? '';
  const terms = tokenizeSearch(query);
  const phrase = terms.join(' ');
  const completed = new Set(completedLessonIds);
  const results: Array<LearningSearchResult & { curriculumOrder: number }> = [];
  let curriculumOrder = 0;

  for (const course of courses) {
    if (filter.courseIds?.length && !filter.courseIds.includes(course.id)) continue;
    const lessonsById = new Map(course.starterLessons.map((lesson) => [lesson.id, lesson]));
    for (const chapter of course.chapters) {
      for (const unit of chapter.units) {
        for (const lessonId of unit.lessonIds) {
          const lessonOrder = curriculumOrder++;
          const lesson = lessonsById.get(lessonId);
          if (!lesson) continue;
          if (filter.onlyIncomplete && completed.has(lesson.id)) continue;
          if (filter.kinds?.length && !filter.kinds.includes(lesson.activityKind ?? 'learn')) continue;
          if (filter.difficulty?.length && !filter.difficulty.includes(lesson.difficulty ?? 1)) continue;
          if (filter.onlyDueReview) {
            const due = (lesson.skillIds ?? []).some((skillId) => {
              const state = mastery[skillId];
              return state ? reviewIsDue(state.nextReviewAt, now) : false;
            });
            if (!due) continue;
          }

          const searchScore = weightedSearchScore(terms, phrase, [
            { value: lesson.title, weight: 60 },
            { value: lesson.concept, weight: 45 },
            { value: (lesson.skillIds ?? []).join(' '), weight: 40 },
            { value: unit.title, weight: 28 },
            { value: chapter.title, weight: 20 },
            { value: course.title, weight: 16 },
            { value: course.language, weight: 12 },
          ]);
          if (terms.length && searchScore <= 0) continue;
          const score = terms.length
            ? searchScore
            : learningPriorityScore(lesson, completed, mastery, now);
          results.push({ course, lesson, chapterId: chapter.id, unitId: unit.id, score, curriculumOrder: lessonOrder });
        }
      }
    }
  }

  return results
    .sort((a, b) => b.score - a.score || a.curriculumOrder - b.curriculumOrder)
    .map(({ curriculumOrder: _curriculumOrder, ...result }) => result);
}

export function courseNavigationSummary(course: Course, completedLessonIds: string[], mastery: MasteryMap) {
  const masterySnapshot = courseMasterySnapshot(course, mastery);
  const completedSet = new Set(completedLessonIds);
  const completed = course.starterLessons.filter((lesson) => completedSet.has(lesson.id)).length;
  const chapters = course.chapters.map((chapter) => {
    const chapterCompleted = chapter.lessonIds.filter((id) => completedSet.has(id)).length;
    const nextLessonId = chapter.lessonIds.find((id) => !completedSet.has(id));
    return {
      id: chapter.id,
      title: chapter.title,
      completed: chapterCompleted,
      total: chapter.lessonIds.length,
      progress: chapter.lessonIds.length ? Math.round((chapterCompleted / chapter.lessonIds.length) * 100) : 0,
      nextLessonId,
      estimatedMinutes: chapter.estimatedMinutes,
      hasLab: chapter.labLessonIds.length > 0,
      hasCheckpoint: chapter.checkpointLessonIds.length > 0,
    };
  });
  return {
    courseId: course.id,
    completed,
    total: course.starterLessons.length,
    progress: course.starterLessons.length ? Math.round((completed / course.starterLessons.length) * 100) : 0,
    mastery: masterySnapshot.score,
    dueForReview: masterySnapshot.dueForReview,
    chapters,
  };
}

export function learningEmptyState(filter: LearningFilter) {
  if (filter.onlyDueReview) return 'Aucune révision n’est due pour le moment. Continue une nouvelle activité ou pratique dans le Lab.';
  if (filter.query?.trim()) return 'Aucune activité ne correspond à cette recherche. Essaie une compétence, un langage ou un chapitre.';
  return 'Aucune activité disponible avec ces filtres. Retire un filtre pour élargir les résultats.';
}
