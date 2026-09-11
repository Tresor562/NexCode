import { courses } from '../data/courses';
import { GuidedProject } from '../data/curriculumCore';
import { guidedProjects } from '../data/projects';
import { LocalState, rewardProgress } from '../lib/localState';
import { defaultProjectRubric, reviewProject } from './projectEngine';
import { resolveProjectSkills, type PortfolioProof } from './projectPortfolioEngine';
import { hasProjectWorkspaceEvidence } from './projectWorkspaceEvidence';
import { buildSkillGraph } from './skillGraph';

const PROJECT_STEP_REWARD = Object.freeze({ xp: 15, nexCoins: 3, minutes: 3 });
const PORTFOLIO_PROOF_REWARD = Object.freeze({ xp: 50, nexCoins: 10, minutes: 5 });
const PORTFOLIO_PASS_SCORE = 70;
const MAX_FUTURE_PROOF_SKEW_MS = 5 * 60 * 1000;
const MAX_PORTFOLIO_SKILL_ID_LENGTH = 160;
const MAX_PORTFOLIO_PROJECT_ID_LENGTH = 160;
const portfolioSkillGraph = buildSkillGraph(courses);

function safePercent(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.floor(value)));
}

function canonicalProject(projectId: unknown): GuidedProject | undefined {
  if (typeof projectId !== 'string') return undefined;
  const id = projectId.trim();
  if (!id) return undefined;
  return guidedProjects.find((project) => project.id === id);
}

function canonicalPortfolioProjectId(value: unknown): string {
  if (typeof value !== 'string') return '';
  const projectId = value.trim();
  if (!projectId || projectId.length > MAX_PORTFOLIO_PROJECT_ID_LENGTH || /[\u0000-\u001f\u007f]/.test(projectId)) return '';
  return projectId;
}

function portfolioSkillIdentity(skillId: string): string {
  return skillId.normalize('NFKC').toLowerCase();
}

function canonicalPortfolioSkillIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const seen = new Set<string>();
  const canonical: string[] = [];
  for (const raw of value) {
    if (typeof raw !== 'string') return null;
    const skillId = raw.trim();
    if (!skillId || skillId.length > MAX_PORTFOLIO_SKILL_ID_LENGTH || /[\u0000-\u001f\u007f]/.test(skillId)) return null;
    const identity = portfolioSkillIdentity(skillId);
    if (seen.has(identity)) return null;
    seen.add(identity);
    canonical.push(skillId);
  }
  return canonical;
}

function canonicalProjectSkillIds(project: GuidedProject): string[] {
  return [...new Set(resolveProjectSkills(project, portfolioSkillGraph).flatMap((item) => item.skillIds))];
}

function matchesCanonicalProjectSkills(skillIds: string[] | null, project: GuidedProject): boolean {
  if (skillIds === null) return false;
  const expected = canonicalProjectSkillIds(project);
  if (skillIds.length !== expected.length) return false;
  const actualIdentities = new Set(skillIds.map(portfolioSkillIdentity));
  return expected.every((skillId) => actualIdentities.has(portfolioSkillIdentity(skillId)));
}

function completedProjectSteps(project: GuidedProject, progress: number): number {
  const total = Math.max(0, project.steps.length);
  if (total === 0) return progress >= 100 ? 1 : 0;
  return Math.min(total, Math.max(0, Math.floor((safePercent(progress) / 100) * total)));
}

function validRewardTime(value: Date, systemNow = new Date()): Date {
  const trustedSystemNow = systemNow instanceof Date && Number.isFinite(systemNow.getTime()) ? systemNow : new Date();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) return trustedSystemNow;
  const clockSkewMs = value.getTime() - trustedSystemNow.getTime();
  return Math.abs(clockSkewMs) <= MAX_FUTURE_PROOF_SKEW_MS ? value : trustedSystemNow;
}

function portfolioProofTimestamp(proof: PortfolioProof | undefined): number | null {
  if (!proof || typeof proof.completedAt !== 'string') return null;
  const completedAt = Date.parse(proof.completedAt);
  return Number.isFinite(completedAt) ? completedAt : null;
}

function canonicalizePortfolioProof(proof: PortfolioProof, project: GuidedProject): PortfolioProof {
  const completedAt = Date.parse(proof.completedAt);
  return {
    projectId: project.id,
    title: project.title.trim(),
    completedAt: new Date(completedAt).toISOString(),
    score: proof.score,
    skillIds: canonicalPortfolioSkillIds(proof.skillIds) ?? [],
    rubricIds: [...new Set(proof.rubricIds.map((id) => typeof id === 'string' ? id.trim() : '').filter(Boolean))],
    evidenceSummary: proof.evidenceSummary.trim(),
  };
}

function isRewardablePortfolioProof(proof: PortfolioProof, project: GuidedProject, now: Date): boolean {
  const projectId = typeof proof.projectId === 'string' ? proof.projectId.trim() : '';
  const title = typeof proof.title === 'string' ? proof.title.trim() : '';
  const evidenceSummary = typeof proof.evidenceSummary === 'string' ? proof.evidenceSummary.trim() : '';
  const completedAt = typeof proof.completedAt === 'string' ? Date.parse(proof.completedAt) : Number.NaN;
  const skillIds = canonicalPortfolioSkillIds(proof.skillIds);
  const rubricIds = Array.isArray(proof.rubricIds)
    ? proof.rubricIds.map((id) => typeof id === 'string' ? id.trim() : '').filter(Boolean)
    : [];
  const uniqueRubricIds = new Set(rubricIds);
  const allowedRubricIds = new Set(defaultProjectRubric(project).map((item) => item.id));
  const review = reviewProject(project, rubricIds);

  return projectId === project.id
    && title === project.title.trim()
    && Boolean(evidenceSummary)
    && skillIds !== null
    && matchesCanonicalProjectSkills(skillIds, project)
    && typeof proof.score === 'number'
    && Number.isFinite(proof.score)
    && proof.score >= PORTFOLIO_PASS_SCORE
    && proof.score <= 100
    && review.passed
    && proof.score === review.score
    && Number.isFinite(completedAt)
    && completedAt <= now.getTime() + MAX_FUTURE_PROOF_SKEW_MS
    && rubricIds.length > 0
    && uniqueRubricIds.size === rubricIds.length
    && rubricIds.every((id) => allowedRubricIds.has(id));
}

export function advanceProjectProgress(
  state: LocalState,
  project: GuidedProject,
  requestedProgress: number,
  now = new Date(),
): LocalState {
  const registeredProject = canonicalProject(project?.id);
  if (!registeredProject) return state;

  const previousProgress = safePercent(state.projectProgress[registeredProject.id]);
  const nextProgress = Math.max(previousProgress, safePercent(requestedProgress));
  if (nextProgress === previousProgress) return state;

  const previousSteps = completedProjectSteps(registeredProject, previousProgress);
  const nextSteps = completedProjectSteps(registeredProject, nextProgress);
  const newlyCompletedSteps = Math.max(0, nextSteps - previousSteps);
  if (newlyCompletedSteps > 0 && !hasProjectWorkspaceEvidence(registeredProject, state.projectDrafts[registeredProject.id], nextSteps)) return state;

  const progressed = {
    ...state,
    projectProgress: { ...state.projectProgress, [registeredProject.id]: nextProgress },
  };

  if (newlyCompletedSteps === 0) return progressed;
  const rewardTime = validRewardTime(now);
  return rewardProgress(progressed, {
    xp: PROJECT_STEP_REWARD.xp * newlyCompletedSteps,
    nexCoins: PROJECT_STEP_REWARD.nexCoins * newlyCompletedSteps,
    minutes: PROJECT_STEP_REWARD.minutes * newlyCompletedSteps,
    now: rewardTime,
    receiptId: `project:${registeredProject.id}:steps:${previousSteps + 1}-${nextSteps}`,
  });
}

export function recordPortfolioProof(
  state: LocalState,
  proof: PortfolioProof,
  now = new Date(),
): LocalState {
  const rewardTime = validRewardTime(now);
  const project = canonicalProject(proof?.projectId);
  if (!project || !isRewardablePortfolioProof(proof, project, rewardTime)) return state;

  const canonicalProof = canonicalizePortfolioProof(proof, project);
  const existingIndex = state.portfolioProofs.findIndex((item) => canonicalPortfolioProjectId(item?.projectId) === project.id);
  if (existingIndex >= 0) {
    const existingProof = state.portfolioProofs[existingIndex];
    const existingCompletedAt = portfolioProofTimestamp(existingProof);
    const incomingCompletedAt = portfolioProofTimestamp(canonicalProof);
    if (incomingCompletedAt === null) return state;
    if (existingCompletedAt !== null && incomingCompletedAt <= existingCompletedAt) return state;
    return {
      ...state,
      portfolioProofs: state.portfolioProofs.map((item, index) => index === existingIndex ? canonicalProof : item),
    };
  }

  if (safePercent(state.projectProgress[project.id]) < 100) return state;
  const finalStepCount = Math.max(1, project.steps.length);
  if (!hasProjectWorkspaceEvidence(project, state.projectDrafts[project.id], finalStepCount)) return state;

  const rewarded = rewardProgress(state, {
    ...PORTFOLIO_PROOF_REWARD,
    now: rewardTime,
    receiptId: `project:${project.id}:portfolio`,
  });
  return { ...rewarded, portfolioProofs: [...rewarded.portfolioProofs, canonicalProof] };
}
