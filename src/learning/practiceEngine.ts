import { Course, Lesson } from '../data/curriculumCore';
import { MasteryMap, SkillNode, prerequisitesReady, skillNeedsEvidence } from './skillGraph';

export type PracticeReason =
  | 'due-review'
  | 'weak-skill'
  | 'repair-misconception'
  | 'new-skill'
  | 'checkpoint'
  | 'lab-transfer'
  | 'interleaving';

export type PracticeRecommendation = {
  lesson: Lesson;
  courseId: string;
  reason: PracticeReason;
  priority: number;
  message: string;
  skillIds: string[];
};

function isDue(iso: string | undefined, now: Date) {
  return Boolean(iso && new Date(iso).getTime() <= now.getTime());
}

function recommendationForLesson(
  course: Course,
  lesson: Lesson,
  graphById: Map<string, SkillNode>,
  mastery: MasteryMap,
  completedLessonIds: string[],
  now: Date,
): PracticeRecommendation | undefined {
  const skills = lesson.skillIds ?? [];
  const completed = completedLessonIds.includes(lesson.id);
  const skillStates = skills.map((id) => mastery[id]).filter(Boolean);
  const due = skillStates.some((state) => isDue(state?.nextReviewAt, now));
  const weakest = skillStates.length ? Math.min(...skillStates.map((state) => state?.score ?? 0)) : 0;
  const hasRecurringError = skillStates.some((state) => (state?.errorTags?.length ?? 0) >= 2);
  const lessonNodes = skills.map((id) => graphById.get(id)).filter((node): node is SkillNode => Boolean(node));
  const prereqsReady = lessonNodes.every((node) => prerequisitesReady(node, mastery));
  const needsEvidence = lessonNodes.some((node) => skillNeedsEvidence(node, mastery));
  const kind = lesson.activityKind ?? 'learn';

  if (completed && hasRecurringError) {
    return {
      lesson,
      courseId: course.id,
      reason: 'repair-misconception',
      priority: 118 - weakest,
      message: 'Réparation ciblée : une erreur revient plusieurs fois sur cette compétence.',
      skillIds: skills,
    };
  }
  if (completed && due) {
    return {
      lesson,
      courseId: course.id,
      reason: 'due-review',
      priority: 108 - weakest,
      message: 'Rappel espacé : récupère la notion de mémoire avant de revoir l’exemple.',
      skillIds: skills,
    };
  }
  if (completed && weakest < 55 && skillStates.length > 0) {
    return {
      lesson,
      courseId: course.id,
      reason: 'weak-skill',
      priority: 95 - weakest,
      message: 'Renforcement : varie l’exercice jusqu’à pouvoir expliquer la notion sans aide.',
      skillIds: skills,
    };
  }
  if (needsEvidence && kind === 'lab' && prereqsReady) {
    return {
      lesson,
      courseId: course.id,
      reason: 'lab-transfer',
      priority: 82,
      message: 'Passe dans le Lab : il faut maintenant prouver la compétence dans du code manipulable.',
      skillIds: skills,
    };
  }
  if (['checkpoint', 'boss'].includes(kind) && prereqsReady) {
    return {
      lesson,
      courseId: course.id,
      reason: 'checkpoint',
      priority: 72,
      message: kind === 'boss'
        ? 'Boss challenge : combine plusieurs acquis sans solution guidée.'
        : 'Checkpoint : vérifie tes acquis avant d’ouvrir de nouvelles notions.',
      skillIds: skills,
    };
  }
  if (!completed && prereqsReady) {
    return {
      lesson,
      courseId: course.id,
      reason: 'new-skill',
      priority: kind === 'learn' ? 52 : 48,
      message: 'Nouvelle activité : tes prérequis sont suffisamment stables pour avancer.',
      skillIds: skills,
    };
  }
  return undefined;
}

export function recommendPractice(
  courses: Course[],
  graph: SkillNode[],
  mastery: MasteryMap,
  completedLessonIds: string[],
  now = new Date(),
  limit = 6,
): PracticeRecommendation[] {
  const graphById = new Map(graph.map((node) => [node.id, node]));
  const candidates = courses.flatMap((course) =>
    course.starterLessons
      .map((lesson) => recommendationForLesson(course, lesson, graphById, mastery, completedLessonIds, now))
      .filter((item): item is PracticeRecommendation => Boolean(item)),
  );

  const deduped = new Map<string, PracticeRecommendation>();
  for (const item of candidates.sort((a, b) => b.priority - a.priority)) {
    if (!deduped.has(item.lesson.id)) deduped.set(item.lesson.id, item);
  }

  // Interleaving: first pass favors different courses and different skills.
  const result: PracticeRecommendation[] = [];
  const usedCourses = new Set<string>();
  const usedSkills = new Set<string>();
  for (const item of deduped.values()) {
    const bringsNewCourse = !usedCourses.has(item.courseId);
    const bringsNewSkill = item.skillIds.some((skill) => !usedSkills.has(skill));
    if (bringsNewCourse || bringsNewSkill || result.length >= Math.ceil(limit * 0.65)) {
      result.push(item);
      usedCourses.add(item.courseId);
      item.skillIds.forEach((skill) => usedSkills.add(skill));
    }
    if (result.length >= limit) break;
  }
  if (result.length < limit) {
    for (const item of deduped.values()) {
      if (!result.some((entry) => entry.lesson.id === item.lesson.id)) result.push(item);
      if (result.length >= limit) break;
    }
  }
  return result;
}

export function shouldRecommendLab(lesson: Lesson, attempts: number, correct: boolean) {
  if (lesson.activityKind === 'lab' || lesson.labMission) return true;
  return attempts >= 2 || correct;
}

export function labPromptForLesson(lesson: Lesson) {
  if (lesson.labMission) return lesson.labMission;
  return {
    id: `${lesson.id}.lab`,
    title: `Pratique : ${lesson.title}`,
    instructions: `Ferme l’exemple, reconstruis la notion « ${lesson.title} » dans le Lab, modifie-la puis explique le résultat.`,
    language: 'JavaScript' as const,
    starterCode: lesson.example,
    successCriteria: [
      'Reproduire la notion sans copier mot pour mot',
      'Modifier au moins une valeur ou branche de logique',
      'Obtenir un résultat cohérent',
      'Pouvoir expliquer pourquoi le résultat change',
    ],
  };
}

export function nextSessionPlan(recommendations: PracticeRecommendation[], minutes: 5 | 10 | 20 | 45) {
  const targetItems = minutes <= 5 ? 2 : minutes <= 10 ? 4 : minutes <= 20 ? 6 : 10;
  const orderedReasons: PracticeReason[] = [
    'repair-misconception', 'due-review', 'weak-skill', 'lab-transfer', 'checkpoint', 'new-skill', 'interleaving',
  ];
  return [...recommendations]
    .sort((a, b) => orderedReasons.indexOf(a.reason) - orderedReasons.indexOf(b.reason) || b.priority - a.priority)
    .slice(0, targetItems);
}
