import { GuidedProject } from '../data/curriculumCore';
import { MasteryMap } from './skillGraph';

export type ProjectReadiness = {
  ready: boolean;
  score: number;
  missingSkills: string[];
  weakSkills: string[];
};

export type ProjectReviewRubric = {
  id: string;
  title: string;
  description: string;
  weight: number;
};

export type ProjectReview = {
  score: number;
  passed: boolean;
  rubric: Array<ProjectReviewRubric & { achieved: boolean }>;
  feedback: string[];
};

const DEFAULT_PROJECT_READINESS_GATE = 55;
const MAX_PROJECT_SKILL_ID_LENGTH = 96;
const MAX_PROJECT_RUBRIC_ID_LENGTH = 64;
const MAX_PROJECT_STEP_LENGTH = 240;
const REQUIRED_PROJECT_RUBRIC_IDS = ['functionality', 'understanding', 'quality', 'delivery'] as const;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F-\u009F]/;

function boundedPercent(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, value));
}

function projectReadinessGate(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    return DEFAULT_PROJECT_READINESS_GATE;
  }
  return value;
}

function canonicalProjectSkillId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.normalize('NFKC').trim();
  if (!normalized || normalized.length > MAX_PROJECT_SKILL_ID_LENGTH || CONTROL_CHARACTER_PATTERN.test(normalized)) {
    return undefined;
  }
  return normalized;
}

function canonicalProjectSkills(project: GuidedProject): string[] {
  const seen = new Set<string>();
  const skills: string[] = [];
  const rawSkills: unknown[] = Array.isArray(project.skills) ? project.skills : [];

  for (const rawSkill of rawSkills) {
    const skillId = canonicalProjectSkillId(rawSkill);
    if (!skillId || seen.has(skillId)) continue;
    seen.add(skillId);
    skills.push(skillId);
  }

  return skills;
}

function canonicalProjectSteps(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) return [];

  const normalizedSteps: string[] = [];
  const seen = new Set<string>();
  for (const rawStep of value) {
    if (typeof rawStep !== 'string') return [];
    const normalized = rawStep.normalize('NFKC').trim();
    if (!normalized || normalized.length > MAX_PROJECT_STEP_LENGTH || CONTROL_CHARACTER_PATTERN.test(normalized)) return [];
    if (seen.has(normalized)) return [];
    seen.add(normalized);
    normalizedSteps.push(normalized);
  }

  return normalizedSteps;
}

function canonicalAchievedRubricIds(value: unknown, rubric: ProjectReviewRubric[]): Set<string> {
  const allowed = new Set(rubric.map((item) => item.id));
  const achieved = new Set<string>();
  if (!Array.isArray(value)) return achieved;

  for (const rawId of value) {
    if (typeof rawId !== 'string') continue;
    const normalized = rawId.normalize('NFKC').trim();
    if (!normalized || normalized.length > MAX_PROJECT_RUBRIC_ID_LENGTH || CONTROL_CHARACTER_PATTERN.test(normalized)) continue;
    if (allowed.has(normalized)) achieved.add(normalized);
  }

  return achieved;
}

export function projectReadiness(project: GuidedProject, mastery: MasteryMap, gate = DEFAULT_PROJECT_READINESS_GATE): ProjectReadiness {
  // A malformed runtime gate must never make a project easier to unlock.
  // Fall back to the product default rather than coercing invalid input to 0.
  const safeGate = projectReadinessGate(gate);
  const skills = canonicalProjectSkills(project);
  const hasPrerequisites = skills.length > 0;
  const missingSkills = skills.filter((skillId) => !mastery[skillId]);
  const weakSkills = skills.filter((skillId) => mastery[skillId] && boundedPercent(mastery[skillId]?.score) < safeGate);
  const masteredScore = hasPrerequisites
    ? Math.round(skills.reduce((sum, id) => sum + boundedPercent(mastery[id]?.score), 0) / skills.length)
    : 0;
  return {
    // A guided project with no usable skill prerequisites is malformed content.
    // Fail closed instead of exposing a premium project without evidence that
    // the learner has acquired the concepts it is supposed to consolidate.
    ready: hasPrerequisites && missingSkills.length === 0 && weakSkills.length === 0,
    score: masteredScore,
    missingSkills,
    weakSkills,
  };
}

export function defaultProjectRubric(project: GuidedProject): ProjectReviewRubric[] {
  const stepCount = canonicalProjectSteps(project.steps).length;
  return [
    { id: 'functionality', title: 'Fonctionnement', description: 'Le résultat répond au besoin principal sans comportement cassé évident.', weight: 30 },
    { id: 'understanding', title: 'Compréhension', description: 'Le développeur peut expliquer les décisions et le rôle des compétences utilisées.', weight: 25 },
    { id: 'quality', title: 'Qualité du code', description: 'Les noms, la structure et la lisibilité permettent de maintenir le projet.', weight: 20 },
    { id: 'resilience', title: 'Cas limites', description: 'Les entrées invalides et principaux échecs sont anticipés.', weight: 15 },
    { id: 'delivery', title: 'Livraison', description: `${stepCount} étapes sont revues et le projet possède une trace claire de ce qui a été construit.`, weight: 10 },
  ];
}

export function reviewProject(project: GuidedProject, achievedRubricIds: unknown): ProjectReview {
  const baseRubric = defaultProjectRubric(project);
  const achieved = canonicalAchievedRubricIds(achievedRubricIds, baseRubric);
  const rubric = baseRubric.map((item) => ({ ...item, achieved: achieved.has(item.id) }));
  const score = rubric.reduce((sum, item) => sum + (item.achieved ? item.weight : 0), 0);
  const feedback = rubric.filter((item) => !item.achieved).map((item) => `${item.title} : ${item.description}`);
  const hasCoreEvidence = REQUIRED_PROJECT_RUBRIC_IDS.every((id) => achieved.has(id));
  return { score, passed: score >= 70 && hasCoreEvidence, rubric, feedback };
}

function restoredCompletedSteps(progress: number, stepCount: number): number {
  if (stepCount <= 0) return 0;

  // Guided-project progress is persisted as an integer percentage. A legitimate
  // milestone such as 1/3 is therefore stored as 33%, while 2/3 is stored as
  // 67%. Reconstruct completion from those canonical rounded boundaries rather
  // than rounding the raw ratio itself: Math.round(13% * 4) incorrectly turns
  // a partial first step into a completed one.
  let completed = 0;
  for (let step = 1; step <= stepCount; step += 1) {
    const boundary = Math.round((step / stepCount) * 100);
    if (progress < boundary) break;
    completed = step;
  }
  return completed;
}

export function nextProjectStep(project: GuidedProject, progress: number) {
  const safeProgress = typeof progress === 'number' && Number.isFinite(progress)
    ? Math.max(0, Math.min(100, progress))
    : 0;
  // Project definitions may be restored from persisted/cloud state before the
  // latest curriculum is loaded. Validate the whole ordered sequence instead
  // of filtering individual entries: dropping one malformed item would shift
  // persisted percentage milestones onto a different construction step.
  const steps = canonicalProjectSteps(project.steps);
  const stepCount = steps.length;
  const complete = stepCount > 0 && safeProgress >= 100;
  const restoredCompleted = restoredCompletedSteps(safeProgress, stepCount);
  const completed = stepCount
    ? Math.min(complete ? stepCount : Math.max(0, stepCount - 1), restoredCompleted)
    : 0;
  return {
    completedSteps: completed,
    nextStep: complete || stepCount === 0 ? undefined : steps[completed],
    complete,
  };
}
