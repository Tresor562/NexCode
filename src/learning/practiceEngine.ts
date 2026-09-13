import { Course, Lesson } from '../data/curriculumCore';
import { missionForLesson } from './labEngine';
import { MasteryMap, SkillMastery, SkillNode, prerequisitesReady, skillNeedsEvidence } from './skillGraph';

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

function recurringMisconception(states: SkillMastery[]): { tag: string; count: number } | undefined {
  const counts = new Map<string, number>();
  for (const state of states) {
    // Evidence preserves repeated attempts while errorTags is intentionally unique.
    // Look only at recent failures so an old mistake does not dominate forever.
    for (const item of state.evidence.slice(-12)) {
      if (item.correct || !item.errorTag) continue;
      counts.set(item.errorTag, (counts.get(item.errorTag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag, count]) => ({ tag, count }))[0];
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
  const skillStates = skills.map((id) => mastery[id]).filter((state): state is SkillMastery => Boolean(state));
  const due = skillStates.some((state) => isDue(state.nextReviewAt, now));
  const weakest = skillStates.length ? Math.min(...skillStates.map((state) => state.score)) : 0;
  const recurringError = recurringMisconception(skillStates);
  const lessonNodes = skills.map((id) => graphById.get(id)).filter((node): node is SkillNode => Boolean(node));
  const prereqsReady = lessonNodes.every((node) => prerequisitesReady(node, mastery));
  const needsEvidence = lessonNodes.some((node) => skillNeedsEvidence(node, mastery));
  const kind = lesson.activityKind ?? 'learn';

  if (completed && recurringError) {
    return {
      lesson,
      courseId: course.id,
      reason: 'repair-misconception',
      priority: 118 - weakest + Math.min(12, (recurringError.count - 2) * 3),
      message: 'Réparation ciblée : la même erreur revient. Reprends une variante et explique ton choix avant de valider.',
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
      message: 'Renforcement : varie l’exercice jusqu’à pouvoir expliquer et réutiliser la notion sans aide.',
      skillIds: skills,
    };
  }
  if (!completed && kind === 'lab' && prereqsReady) {
    return {
      lesson,
      courseId: course.id,
      reason: 'lab-transfer',
      priority: needsEvidence ? 86 : 80,
      message: 'Passe dans le Lab : transforme la notion en code manipulable et produis une preuve de maîtrise.',
      skillIds: skills,
    };
  }
  if (!completed && ['checkpoint', 'boss'].includes(kind) && prereqsReady) {
    return {
      lesson,
      courseId: course.id,
      reason: 'checkpoint',
      priority: kind === 'boss' ? 76 : 72,
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
  for (const item of candidates.sort((a, b) => b.priority - a.priority || a.lesson.id.localeCompare(b.lesson.id))) {
    if (!deduped.has(item.lesson.id)) deduped.set(item.lesson.id, item);
  }

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
  if (lesson.activityKind === 'checkpoint' || lesson.activityKind === 'boss') return correct;
  return attempts >= 2 || correct;
}

export function labPromptForLesson(lesson: Lesson) {
  return missionForLesson(lesson);
}

export function nextSessionPlan(recommendations: PracticeRecommendation[], minutes: 5 | 10 | 20 | 45) {
  const targetItems = minutes <= 5 ? 2 : minutes <= 10 ? 4 : minutes <= 20 ? 6 : 10;
  const orderedReasons: PracticeReason[] = [
    'repair-misconception', 'due-review', 'weak-skill', 'lab-transfer', 'checkpoint', 'new-skill', 'interleaving',
  ];
  return [...recommendations]
    .sort((a, b) => orderedReasons.indexOf(a.reason) - orderedReasons.indexOf(b.reason) || b.priority - a.priority || a.lesson.id.localeCompare(b.lesson.id))
    .slice(0, targetItems);
}
