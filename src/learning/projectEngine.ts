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

function boundedPercent(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : 0;
}

export function projectReadiness(project: GuidedProject, mastery: MasteryMap, gate = 55): ProjectReadiness {
  const safeGate = boundedPercent(gate);
  const missingSkills = project.skills.filter((skillId) => !mastery[skillId]);
  const weakSkills = project.skills.filter((skillId) => mastery[skillId] && boundedPercent(mastery[skillId]?.score) < safeGate);
  const masteredScore = project.skills.length
    ? Math.round(project.skills.reduce((sum, id) => sum + boundedPercent(mastery[id]?.score), 0) / project.skills.length)
    : 0;
  return {
    ready: missingSkills.length === 0 && weakSkills.length === 0,
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
  // Progress is persisted as a rounded percentage (e.g. 33/67 for 3 steps).
  // Reconstruct the completed step count with the same rounding semantics so a
  // saved 33% project restores to 1/3 instead of falling back to 0/3.
  const completed = project.steps.length
    ? Math.min(project.steps.length, Math.max(0, Math.round((safeProgress / 100) * project.steps.length)))
    : 0;
  return {
    completedSteps: completed,
    nextStep: project.steps[Math.min(completed, project.steps.length - 1)],
    complete: safeProgress >= 100,
  };
}
