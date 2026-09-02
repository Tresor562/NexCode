import { Course, Lesson } from '../data/curriculumCore';
import { MasteryMap, SkillNode } from './skillGraph';
import { evaluateSkillGate, masterySnapshot, remediationTargets } from './masteryEngine';

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
  blockedByRecovery?: boolean;
  deferredRecoveryCount?: number;
};

function lessonPrerequisitesReady(skills: string[], mastery: MasteryMap, graphById: Map<string, SkillNode>, now: Date) {
  return skills.every((skillId) => {
    const node = graphById.get(skillId);
    if (!node?.prerequisiteIds.length) return true;
    const gate = node.prerequisiteGate ?? 55;
    return evaluateSkillGate(node.prerequisiteIds, mastery, gate, now).passed;
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

const modeOrder: PracticeMode[] = ['repair', 'review', 'checkpoint', 'lab', 'learn', 'interleave'];
const practiceModes = new Set<PracticeMode>(modeOrder);
const MAX_RUNTIME_ACTIVITY_MINUTES = 240;
const MAX_RUNTIME_ACTIVITY_PRIORITY = 1000;
const MAX_RUNTIME_ACTIVITY_SKILLS = 24;
const MAX_RUNTIME_ID_LENGTH = 128;
const MAX_RUNTIME_REASON_LENGTH = 400;

function normalizeRuntimeActivity(candidate: PlannedActivity): PlannedActivity | undefined {
  if (!candidate || typeof candidate !== 'object') return undefined;
  if (!practiceModes.has(candidate.mode)) return undefined;
  if (!Number.isFinite(candidate.estimatedMinutes) || candidate.estimatedMinutes <= 0 || candidate.estimatedMinutes > MAX_RUNTIME_ACTIVITY_MINUTES) return undefined;
  if (!Number.isFinite(candidate.priority) || Math.abs(candidate.priority) > MAX_RUNTIME_ACTIVITY_PRIORITY) return undefined;
  if (typeof candidate.courseId !== 'string' || typeof candidate.lessonId !== 'string') return undefined;
  const courseId = candidate.courseId.trim();
  const lessonId = candidate.lessonId.trim();
  if (!courseId || !lessonId || courseId.length > MAX_RUNTIME_ID_LENGTH || lessonId.length > MAX_RUNTIME_ID_LENGTH) return undefined;
  if (!Array.isArray(candidate.skillIds) || candidate.skillIds.length > MAX_RUNTIME_ACTIVITY_SKILLS) return undefined;

  const skillIds = [...new Set(candidate.skillIds
    .filter((skill): skill is string => typeof skill === 'string')
    .map((skill) => skill.trim())
    .filter((skill) => skill.length > 0 && skill.length <= MAX_RUNTIME_ID_LENGTH))];
  const reason = typeof candidate.reason === 'string'
    ? candidate.reason.trim().slice(0, MAX_RUNTIME_REASON_LENGTH)
    : '';

  return {
    courseId,
    lessonId,
    mode: candidate.mode,
    priority: candidate.priority,
    reason,
    estimatedMinutes: Math.ceil(candidate.estimatedMinutes),
    skillIds,
  };
}

function activitySort(a: PlannedActivity, b: PlannedActivity) {
  const modeDelta = modeOrder.indexOf(a.mode) - modeOrder.indexOf(b.mode);
  if (modeDelta !== 0) return modeDelta;
  if (b.priority !== a.priority) return b.priority - a.priority;
  if (a.estimatedMinutes !== b.estimatedMinutes) return a.estimatedMinutes - b.estimatedMinutes;
  const courseDelta = a.courseId.localeCompare(b.courseId);
  return courseDelta !== 0 ? courseDelta : a.lessonId.localeCompare(b.lessonId);
}

function isRecoveryMode(mode: PracticeMode) {
  return mode === 'repair' || mode === 'review';
}

function recoveryActivityKey(activity: PlannedActivity) {
  return `${activity.courseId}:${activity.lessonId}`;
}

function acceptableFallbackMinutes(budgetMinutes: PracticeSession['budgetMinutes']) {
  return budgetMinutes + Math.max(3, Math.round(budgetMinutes * 0.5));
}

function maxNewActivitiesForBudget(budgetMinutes: PracticeSession['budgetMinutes']) {
  if (budgetMinutes <= 10) return 1;
  if (budgetMinutes <= 20) return 2;
  return 3;
}

function recoveryQuotaForBudget(budgetMinutes: PracticeSession['budgetMinutes'], pendingRecoveryCount: number) {
  if (budgetMinutes <= 10) return pendingRecoveryCount;
  if (budgetMinutes <= 20) return Math.min(2, pendingRecoveryCount);
  return Math.min(3, pendingRecoveryCount);
}

export function planPracticeSession(pool: PlannedActivity[], budgetMinutes: 5 | 10 | 20 | 45): PracticeSession {
  const selected: PlannedActivity[] = [];
  const usedSkills = new Set<string>();
  const usedCourses = new Set<string>();
  const recoveredSkills = new Set<string>();
  const recoveredUnscopedKeys = new Set<string>();
  const maxNewActivities = maxNewActivitiesForBudget(budgetMinutes);
  let newActivities = 0;
  let recoveryActivities = 0;
  let minutes = 0;

  const sorted = pool
    .map(normalizeRuntimeActivity)
    .filter((item): item is PlannedActivity => Boolean(item))
    .sort(activitySort);
  const recoveryCandidates = sorted.filter((item) => isRecoveryMode(item.mode));
  const recoverySkills = new Set(recoveryCandidates.flatMap((item) => item.skillIds));
  const unscopedRecoveryKeys = new Set(
    recoveryCandidates
      .filter((item) => item.skillIds.length === 0)
      .map(recoveryActivityKey),
  );
  const hasPendingRecovery = recoverySkills.size > 0 || unscopedRecoveryKeys.size > 0;
  const recoveryQuota = recoveryQuotaForBudget(budgetMinutes, recoveryCandidates.length);
  const overrunAllowance = Math.max(2, Math.round(budgetMinutes * 0.15));
  const maxMinutes = budgetMinutes + overrunAllowance;

  for (const candidate of sorted) {
    if (minutes + candidate.estimatedMinutes > maxMinutes) continue;

    if (selected.length === 0 && hasPendingRecovery && !isRecoveryMode(candidate.mode)) continue;

    const recoveryMode = isRecoveryMode(candidate.mode);
    const candidateRecoveryKey = recoveryActivityKey(candidate);
    const bringsNewRecoverySkill = candidate.skillIds.some((skill) => !recoveredSkills.has(skill));
    if (recoveryMode && candidate.skillIds.length > 0 && !bringsNewRecoverySkill) continue;
    if (recoveryMode && candidate.skillIds.length === 0 && recoveredUnscopedKeys.has(candidateRecoveryKey)) continue;

    const recoveryQuotaOutstanding = recoveryActivities < recoveryQuota;
    if (recoveryQuotaOutstanding && !recoveryMode) continue;
    if (candidate.mode === 'learn' && newActivities >= maxNewActivities) continue;

    const bringsNewSkill = candidate.skillIds.some((skill) => !usedSkills.has(skill));
    const bringsNewCourse = !usedCourses.has(candidate.courseId);
    const needsDiversity = selected.length >= 1;
    if (needsDiversity && !bringsNewSkill && !bringsNewCourse && candidate.mode !== 'repair') continue;

    selected.push(candidate);
    minutes += candidate.estimatedMinutes;
    if (candidate.mode === 'learn') newActivities += 1;
    if (recoveryMode) recoveryActivities += 1;
    candidate.skillIds.forEach((skill) => {
      usedSkills.add(skill);
      if (recoveryMode) recoveredSkills.add(skill);
    });
    if (recoveryMode && candidate.skillIds.length === 0) recoveredUnscopedKeys.add(candidateRecoveryKey);
    usedCourses.add(candidate.courseId);
    if (minutes >= budgetMinutes) break;
  }

  if (selected.length === 0 && sorted.length > 0) {
    const fallbackLimit = acceptableFallbackMinutes(budgetMinutes);
    const fallbackPool = hasPendingRecovery ? sorted.filter((item) => isRecoveryMode(item.mode)) : sorted;
    const fallback = [...fallbackPool]
      .filter((item) => item.estimatedMinutes <= fallbackLimit)
      .sort((a, b) => {
        const overrunA = Math.max(0, a.estimatedMinutes - budgetMinutes);
        const overrunB = Math.max(0, b.estimatedMinutes - budgetMinutes);
        if (overrunA !== overrunB) return overrunA - overrunB;
        return activitySort(a, b);
      })[0];

    if (fallback) {
      selected.push(fallback);
      minutes = fallback.estimatedMinutes;
      fallback.skillIds.forEach((skill) => {
        usedSkills.add(skill);
        if (isRecoveryMode(fallback.mode)) recoveredSkills.add(skill);
      });
      if (isRecoveryMode(fallback.mode) && fallback.skillIds.length === 0) {
        recoveredUnscopedKeys.add(recoveryActivityKey(fallback));
      }
      usedCourses.add(fallback.courseId);
    }
  }

  const deferredRecoverySkills = [...recoverySkills].filter((skill) => !recoveredSkills.has(skill));
  const deferredUnscopedRecovery = [...unscopedRecoveryKeys].filter((key) => !recoveredUnscopedKeys.has(key)).length;
  const deferredRecoveryCount = deferredRecoverySkills.length + deferredUnscopedRecovery;

  return {
    budgetMinutes,
    estimatedMinutes: minutes,
    activities: selected,
    skillCoverage: [...usedSkills],
    courseCoverage: [...usedCourses],
    blockedByRecovery: hasPendingRecovery && selected.length === 0,
    deferredRecoveryCount,
  };
}

export function recommendedSessionMessage(session: PracticeSession) {
  if (session.activities.length === 0) {
    if (session.blockedByRecovery) {
      return `Une réparation ou révision importante dépasse ${session.budgetMinutes} min. Choisis plus de temps pour la traiter avant d'ajouter une nouvelle notion.`;
    }
    return `Aucune activité ne tient honnêtement dans ${session.budgetMinutes} min. Choisis plus de temps pour garder une séance complète.`;
  }
  const repair = session.activities.filter((item) => item.mode === 'repair').length;
  const review = session.activities.filter((item) => item.mode === 'review').length;
  const lab = session.activities.filter((item) => item.mode === 'lab').length;
  const deferred = session.deferredRecoveryCount ?? 0;
  const deferredMessage = deferred > 0
    ? ` Il restera ${deferred} récupération${deferred > 1 ? 's' : ''} à traiter avant d'ajouter du nouveau contenu.`
    : '';
  if (repair > 0) return `Commence par ${repair} réparation${repair > 1 ? 's' : ''} ciblée${repair > 1 ? 's' : ''}, puis consolide.${deferredMessage}`;
  if (review > 0) return `${review} révision${review > 1 ? 's' : ''} espacée${review > 1 ? 's' : ''} avant les nouvelles notions.${deferredMessage}`;
  if (lab > 0) return `Cette session inclut du Lab pour transformer la compréhension en compétence pratique.${deferredMessage}`;
  return `Session équilibrée entre nouvelles notions et consolidation.${deferredMessage}`;
}
