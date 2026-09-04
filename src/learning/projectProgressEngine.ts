import { GuidedProject } from '../data/curriculumCore';
import { guidedProjects } from '../data/projects';
import { LocalState, rewardProgress } from '../lib/localState';
import { defaultProjectRubric, reviewProject } from './projectEngine';
import type { PortfolioProof } from './projectPortfolioEngine';
import { hasProjectWorkspaceEvidence } from './projectWorkspaceEvidence';

const PROJECT_STEP_REWARD = Object.freeze({ xp: 15, nexCoins: 3, minutes: 3 });
const PORTFOLIO_PROOF_REWARD = Object.freeze({ xp: 50, nexCoins: 10, minutes: 5 });
const PORTFOLIO_PASS_SCORE = 70;
const MAX_FUTURE_PROOF_SKEW_MS = 5 * 60 * 1000;

function safePercent(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function canonicalProject(projectId: unknown): GuidedProject | undefined {
  if (typeof projectId !== 'string') return undefined;
  const id = projectId.trim();
  if (!id) return undefined;
  return guidedProjects.find((project) => project.id === id);
}

function completedProjectSteps(project: GuidedProject, progress: number): number {
  const total = Math.max(0, project.steps.length);
  if (total === 0) return progress >= 100 ? 1 : 0;

  // A construction step is earned only once its full percentage boundary has
  // been crossed. Rounding would pay a 4-step project at 13% (0.52 -> 1), well
  // before the first 25% milestone is actually complete.
  return Math.min(total, Math.max(0, Math.floor((safePercent(progress) / 100) * total)));
}

function validRewardTime(value: Date, systemNow = new Date()): Date {
  const trustedSystemNow = systemNow instanceof Date && Number.isFinite(systemNow.getTime()) ? systemNow : new Date();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) return trustedSystemNow;

  // A caller-controlled clock must not expand the proof-validation window. Without
  // this boundary, passing `now = 2099` would make an equally future-dated proof
  // look legitimate even though rewardProgress later repairs its own timestamp.
  return value.getTime() <= trustedSystemNow.getTime() + MAX_FUTURE_PROOF_SKEW_MS
    ? value
    : trustedSystemNow;
}

function portfolioProofTimestamp(proof: PortfolioProof | undefined): number | null {
  if (!proof || typeof proof.completedAt !== 'string') return null;
  const completedAt = Date.parse(proof.completedAt);
  return Number.isFinite(completedAt) ? completedAt : null;
}

function isRewardablePortfolioProof(proof: PortfolioProof, project: GuidedProject, now: Date): boolean {
  const projectId = typeof proof.projectId === 'string' ? proof.projectId.trim() : '';
  const title = typeof proof.title === 'string' ? proof.title.trim() : '';
  const evidenceSummary = typeof proof.evidenceSummary === 'string' ? proof.evidenceSummary.trim() : '';
  const completedAt = typeof proof.completedAt === 'string' ? Date.parse(proof.completedAt) : Number.NaN;
  const rubricIds = Array.isArray(proof.rubricIds)
    ? proof.rubricIds.map((id) => typeof id === 'string' ? id.trim() : '').filter(Boolean)
    : [];
  const uniqueRubricIds = new Set(rubricIds);
  const allowedRubricIds = new Set(defaultProjectRubric(project).map((item) => item.id));
  const review = reviewProject(project, rubricIds);

  return projectId === project.id
    && title === project.title.trim()
    && Boolean(evidenceSummary)
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

/**
 * Progress is monotonic by design: stale UI callbacks or manual state tampering
 * can never lower the stored percentage and later re-earn the same step reward.
 * Rewards are derived from newly crossed construction steps, not button presses.
 *
 * The caller may pass a project object from the UI, but reward math always uses
 * the canonical project registered in product data. This prevents a malformed or
 * stale object from inflating the number of rewarded steps for a known project id.
 *
 * A saved workspace is not proof by itself: selecting a file can persist the
 * untouched starter. Every newly claimed construction step therefore requires a
 * growing amount of measurable delta from the canonical starter workspace.
 */
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
  if (newlyCompletedSteps > 0 && !hasProjectWorkspaceEvidence(
    registeredProject,
    state.projectDrafts[registeredProject.id],
    nextSteps,
  )) return state;

  const progressed = {
    ...state,
    projectProgress: {
      ...state.projectProgress,
      [registeredProject.id]: nextProgress,
    },
  };

  if (newlyCompletedSteps === 0) return progressed;
  const rewardTime = validRewardTime(now);
  return rewardProgress(progressed, {
    xp: PROJECT_STEP_REWARD.xp * newlyCompletedSteps,
    nexCoins: PROJECT_STEP_REWARD.nexCoins * newlyCompletedSteps,
    minutes: PROJECT_STEP_REWARD.minutes * newlyCompletedSteps,
    now: rewardTime,
  });
}

/**
 * Only canonical, structurally valid passing evidence can enter the portfolio
 * reward path. Project identity, rubric membership and score are recomputed from
 * product data rather than trusted from a stale/imported proof object.
 *
 * The first portfolio proof earns the one-time completion reward only after the
 * guided project itself has reached 100%. Later valid edits replace the proof in
 * place so learners can improve evidence without farming XP/NexCoins. Stale or
 * equal-version callbacks are ignored so an older editor state cannot overwrite a
 * newer portfolio proof after a fast save/sync sequence.
 */
export function recordPortfolioProof(
  state: LocalState,
  proof: PortfolioProof,
  now = new Date(),
): LocalState {
  const rewardTime = validRewardTime(now);
  const project = canonicalProject(proof?.projectId);
  if (!project || !isRewardablePortfolioProof(proof, project, rewardTime)) return state;

  const existingIndex = state.portfolioProofs.findIndex((item) => item.projectId === project.id);
  if (existingIndex >= 0) {
    const existingProof = state.portfolioProofs[existingIndex];
    const existingCompletedAt = portfolioProofTimestamp(existingProof);
    const incomingCompletedAt = portfolioProofTimestamp(proof);
    if (incomingCompletedAt === null) return state;
    if (existingCompletedAt !== null && incomingCompletedAt <= existingCompletedAt) return state;
    return {
      ...state,
      portfolioProofs: state.portfolioProofs.map((item, index) => index === existingIndex ? proof : item),
    };
  }

  // A passing rubric alone is not completion evidence. The learner must have
  // actually crossed the canonical 100% project-progress boundary before the
  // first proof can mint its one-time portfolio reward. Re-check the full project
  // workspace delta as a second boundary so imported/tampered progress cannot
  // mint a portfolio proof without corresponding code evidence.
  if (safePercent(state.projectProgress[project.id]) < 100) return state;
  const finalStepCount = Math.max(1, project.steps.length);
  if (!hasProjectWorkspaceEvidence(project, state.projectDrafts[project.id], finalStepCount)) return state;

  const rewarded = rewardProgress(state, { ...PORTFOLIO_PROOF_REWARD, now: rewardTime });
  return {
    ...rewarded,
    portfolioProofs: [...rewarded.portfolioProofs, proof],
  };
}