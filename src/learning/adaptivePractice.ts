import { Course, Lesson } from '../data/curriculumCore';
import { MasteryMap, SkillNode } from './skillGraph';
import { masterySnapshot, remediationTargets } from './masteryEngine';

export type PracticeMode = 'learn' | 'repair' | 'review' | 'interleave' | 'lab' | 'checkpoint';

export type PlannedActivity = {
  courseId: string;
  lessonId: string;
  mode: PracticeMode;
  priority: number;
  reason: string;
  estimatedMinutes: number;
  skillIds: string[];
};

export type PracticeSession = {
  budgetMinutes: number;
  estimatedMinutes: number;
  activities: PlannedActivity[];
  skillCoverage: string[];
  courseCoverage: string[];
};

function lessonPrerequisitesReady(skills: string[], mastery: MasteryMap, graphById: Map<string, SkillNode>, now: Date) {
  return skills.every((skillId) => {
    const node = graphById.get(skillId);
    if (!node?.prerequisiteIds.length) return true;
    const gate = node.prerequisiteGate ?? 55;
    return node.prerequisiteIds.every((prerequisiteId) => masterySnapshot(prerequisiteId, mastery, now).effectiveScore >= gate);
  });
}

function scoreLesson(
  course: Course,
  lesson: Lesson,
  mastery: MasteryMap,
  completedIds: string[],
  graphById: Map<string, SkillNode>,
  now: Date,
): PlannedActivity | undefined {
  const skills = lesson.skillIds ?? [];
  const snapshots = skills.map((id) => masterySnapshot(id, mastery, now));
  const completed = completedIds.includes(lesson.id);
  const weakest = snapshots.length ? Math.min(...snapshots.map((item) => item.effectiveScore)) : 0;
  const due = snapshots.some((item) => item.needsReview);
  const recurringErrors = snapshots.reduce((sum, item) => sum + item.recurringErrors.length, 0);
  const prereqsReady = lessonPrerequisitesReady(skills, mastery, graphById, now);
  const kind = lesson.activityKind ?? 'learn';

  if (completed && recurringErrors > 0) {
    return { courseId: course.id, lessonId: lesson.id, mode: 'repair', priority: 140 + recurringErrors * 8 - weakest, reason: 'Erreur récurrente détectée : retravailler la notion avec une variante.', estimatedMinutes: Math.max(4, lesson.durationMin), skillIds: skills };
  }
  if (completed && due) {
    return { courseId: course.id, lessonId: lesson.id, mode: 'review', priority: 120 - weakest, reason: 'Révision espacée arrivée à échéance : récupération active avant oubli.', estimatedMinutes: Math.max(3, Math.ceil(lesson.durationMin * 0.65)), skillIds: skills };
  }
  if (!completed && !prereqsReady) return undefined;
  if (!completed && kind === 'lab') {
    return { courseId: course.id, lessonId: lesson.id, mode: 'lab', priority: 92 + (weakest >= 55 ? 8 : 0), reason: 'Transférer la notion dans le Lab pour produire une preuve pratique.', estimatedMinutes: Math.max(8, lesson.durationMin), skillIds: skills };
  }
  if (!completed && ['checkpoint', 'boss'].includes(kind)) {
    return { courseId: course.id, lessonId: lesson.id, mode: 'checkpoint', priority: kind === 'boss' ? 88 : 82, reason: kind === 'boss' ? 'Boss challenge : combiner plusieurs compétences sans guidage.' : 'Checkpoint : vérifier la stabilité avant de continuer.', estimatedMinutes: Math.max(8, lesson.durationMin), skillIds: skills };
  }
  if (!completed) {
    return { courseId: course.id, lessonId: lesson.id, mode: 'learn', priority: 60 - Math.min(20, weakest / 5), reason: 'Nouvelle activité accessible : les prérequis sont suffisamment solides.', estimatedMinutes: lesson.durationMin, skillIds: skills };
  }
  if (completed && weakest < 70) {
    return { courseId: course.id, lessonId: lesson.id, mode: 'interleave', priority: 70 - weakest / 2, reason: 'Interleaving : revoir cette compétence dans un contexte différent.', estimatedMinutes: Math.max(4, Math.ceil(lesson.durationMin * 0.6)), skillIds: skills };
  }
  return undefined;
}

export function buildAdaptivePool(
  courses: Course[],
  graph: SkillNode[],
  mastery: MasteryMap,
  completedIds: string[],
  now = new Date(),
) {
  const graphById = new Map(graph.map((node) => [node.id, node]));
  const repairSkills = new Set(remediationTargets(mastery, now).slice(0, 12).map((item) => item.skillId));
  return courses
    .flatMap((course) => course.starterLessons.map((lesson) => scoreLesson(course, lesson, mastery, completedIds, graphById, now)))
    .filter((item): item is PlannedActivity => Boolean(item))
    .map((item) => ({
      ...item,
      priority: item.priority + (item.skillIds.some((id) => repairSkills.has(id)) ? 18 : 0),
    }))
    .sort((a, b) => b.priority - a.priority);
}

export function planPracticeSession(pool: PlannedActivity[], budgetMinutes: 5 | 10 | 20 | 45): PracticeSession {
  const selected: PlannedActivity[] = [];
  const usedSkills = new Set<string>();
  const usedCourses = new Set<string>();
  let minutes = 0;

  const modeOrder: PracticeMode[] = ['repair', 'review', 'learn', 'lab', 'interleave', 'checkpoint'];
  const sorted = [...pool].sort((a, b) => {
    const modeDelta = modeOrder.indexOf(a.mode) - modeOrder.indexOf(b.mode);
    return modeDelta !== 0 ? modeDelta : b.priority - a.priority;
  });

  for (const candidate of sorted) {
    const wouldExceed = minutes + candidate.estimatedMinutes > budgetMinutes + Math.max(3, Math.round(budgetMinutes * 0.2));
    if (wouldExceed && selected.length > 0) continue;
    const bringsNewSkill = candidate.skillIds.some((skill) => !usedSkills.has(skill));
    const bringsNewCourse = !usedCourses.has(candidate.courseId);
    const needsDiversity = selected.length >= 2;
    if (needsDiversity && !bringsNewSkill && !bringsNewCourse && candidate.mode !== 'repair') continue;
    selected.push(candidate);
    minutes += candidate.estimatedMinutes;
    candidate.skillIds.forEach((skill) => usedSkills.add(skill));
    usedCourses.add(candidate.courseId);
    if (minutes >= budgetMinutes) break;
  }

  if (selected.length === 0 && sorted[0]) {
    selected.push(sorted[0]);
    minutes = sorted[0].estimatedMinutes;
    sorted[0].skillIds.forEach((skill) => usedSkills.add(skill));
    usedCourses.add(sorted[0].courseId);
  }

  return {
    budgetMinutes,
    estimatedMinutes: minutes,
    activities: selected,
    skillCoverage: [...usedSkills],
    courseCoverage: [...usedCourses],
  };
}

export function recommendedSessionMessage(session: PracticeSession) {
  const repair = session.activities.filter((item) => item.mode === 'repair').length;
  const review = session.activities.filter((item) => item.mode === 'review').length;
  const lab = session.activities.filter((item) => item.mode === 'lab').length;
  if (repair > 0) return `Commence par ${repair} réparation${repair > 1 ? 's' : ''} ciblée${repair > 1 ? 's' : ''}, puis consolide.`;
  if (review > 0) return `${review} révision${review > 1 ? 's' : ''} espacée${review > 1 ? 's' : ''} avant les nouvelles notions.`;
  if (lab > 0) return 'Cette session inclut du Lab pour transformer la compréhension en compétence pratique.';
  return 'Session équilibrée entre nouvelles notions et consolidation.';
}
