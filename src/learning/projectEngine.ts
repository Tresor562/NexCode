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

function canonicalProjectSkills(project: GuidedProject): string[] {
  const seen = new Set<string>();
  const skills: string[] = [];
  const rawSkills: unknown[] = Array.isArray(project.skills) ? project.skills : [];

  for (const rawSkill of rawSkills) {
    if (typeof rawSkill !== 'string') continue;
    const skillId = rawSkill.trim();
    if (!skillId || seen.has(skillId)) continue;
    seen.add(skillId);
    skills.push(skillId);
  }

  return skills;
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
  return [
    { id: 'functionality', title: 'Fonctionnement', description: 'Le résultat répond au besoin principal sans comportement cassé évident.', weight: 30 },
    { id: 'understanding', title: 'Compréhension', description: 'Le développeur peut expliquer les décisions et le rôle des compétences utilisées.', weight: 25 },
    { id: 'quality', title: 'Qualité du code', description: 'Les noms, la structure et la lisibilité permettent de maintenir le projet.', weight: 20 },
    { id: 'resilience', title: 'Cas limites', description: 'Les entrées invalides et principaux échecs sont anticipés.', weight: 15 },
    { id: 'delivery', title: 'Livraison', description: `${project.steps.length} étapes sont revues et le projet possède une trace claire de ce qui a été construit.`, weight: 10 },
  ];
}

export function reviewProject(project: GuidedProject, achievedRubricIds: string[]): ProjectReview {
  const achieved = new Set(achievedRubricIds);
  const rubric = defaultProjectRubric(project).map((item) => ({ ...item, achieved: achieved.has(item.id) }));
  const score = rubric.reduce((sum, item) => sum + (item.achieved ? item.weight : 0), 0);
  const feedback = rubric.filter((item) => !item.achieved).map((item) => `${item.title} : ${item.description}`);
  return { score, passed: score >= 70 && achieved.has('functionality') && achieved.has('understanding'), rubric, feedback };
}

export function nextProjectStep(project: GuidedProject, progress: number) {
  const safeProgress = typeof progress === 'number' && Number.isFinite(progress)
    ? Math.max(0, Math.min(100, progress))
    : 0;
  const stepCount = project.steps.length;
  const complete = safeProgress >= 100;
  // Progress is persisted as a rounded percentage (e.g. 33/67 for 3 steps).
  // Reconstruct the completed step count with the same rounding semantics, but
  // never infer the final step from a merely near-complete percentage. This
  // keeps completedSteps, nextStep and complete logically consistent after
  // restoring old/local/cloud progress snapshots.
  const roundedCompleted = stepCount
    ? Math.max(0, Math.round((safeProgress / 100) * stepCount))
    : 0;
  const completed = stepCount
    ? Math.min(complete ? stepCount : Math.max(0, stepCount - 1), roundedCompleted)
    : 0;
  return {
    completedSteps: completed,
    nextStep: complete || stepCount === 0 ? undefined : project.steps[completed],
    complete,
  };
}
