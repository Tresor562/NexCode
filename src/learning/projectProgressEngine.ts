import { GuidedProject } from '../data/curriculumCore';
import { LocalState, rewardProgress } from '../lib/localState';
import type { PortfolioProof } from './projectPortfolioEngine';

const PROJECT_STEP_REWARD = Object.freeze({ xp: 15, nexCoins: 3, minutes: 3 });
const PORTFOLIO_PROOF_REWARD = Object.freeze({ xp: 50, nexCoins: 10, minutes: 5 });
const PORTFOLIO_PASS_SCORE = 70;

function safePercent(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function completedProjectSteps(project: GuidedProject, progress: number): number {
  const total = Math.max(0, project.steps.length);
  if (total === 0) return progress >= 100 ? 1 : 0;
  return Math.min(total, Math.max(0, Math.round((safePercent(progress) / 100) * total)));
}

function isRewardablePortfolioProof(proof: PortfolioProof): boolean {
  const projectId = typeof proof.projectId === 'string' ? proof.projectId.trim() : '';
  const title = typeof proof.title === 'string' ? proof.title.trim() : '';
  const evidenceSummary = typeof proof.evidenceSummary === 'string' ? proof.evidenceSummary.trim() : '';
  const completedAt = typeof proof.completedAt === 'string' ? Date.parse(proof.completedAt) : Number.NaN;
  const rubricIds = Array.isArray(proof.rubricIds)
    ? proof.rubricIds.map((id) => typeof id === 'string' ? id.trim() : '').filter(Boolean)
    : [];
  const uniqueRubricIds = new Set(rubricIds);

  return Boolean(projectId)
    && Boolean(title)
    && Boolean(evidenceSummary)
    && typeof proof.score === 'number'
    && Number.isFinite(proof.score)
    && proof.score >= PORTFOLIO_PASS_SCORE
    && proof.score <= 100
    && Number.isFinite(completedAt)
    && rubricIds.length > 0
    && uniqueRubricIds.size === rubricIds.length;
}

/**
 * Progress is monotonic by design: stale UI callbacks or manual state tampering
 * can never lower the stored percentage and later re-earn the same step reward.
 * Rewards are derived from newly crossed construction steps, not button presses.
 */
export function advanceProjectProgress(
  state: LocalState,
  project: GuidedProject,
  requestedProgress: number,
  now = new Date(),
): LocalState {
  const previousProgress = safePercent(state.projectProgress[project.id]);
  const nextProgress = Math.max(previousProgress, safePercent(requestedProgress));
  if (nextProgress === previousProgress) return state;

  const previousSteps = completedProjectSteps(project, previousProgress);
  const nextSteps = completedProjectSteps(project, nextProgress);
  const newlyCompletedSteps = Math.max(0, nextSteps - previousSteps);
  const progressed = {
    ...state,
    projectProgress: {
      ...state.projectProgress,
      [project.id]: nextProgress,
    },
  };

  if (newlyCompletedSteps === 0) return progressed;
  return rewardProgress(progressed, {
    xp: PROJECT_STEP_REWARD.xp * newlyCompletedSteps,
    nexCoins: PROJECT_STEP_REWARD.nexCoins * newlyCompletedSteps,
    minutes: PROJECT_STEP_REWARD.minutes * newlyCompletedSteps,
    now,
  });
}

/**
 * Only structurally valid passing evidence can enter the portfolio reward path.
 * This keeps the progression boundary safe even if a stale client, imported
 * local state or future UI accidentally calls the engine with malformed data.
 *
 * The first portfolio proof earns the one-time completion reward. Later valid
 * edits replace the proof in place so learners can improve their evidence
 * without farming XP/NexCoins or being stuck with stale portfolio metadata.
 */
export function recordPortfolioProof(
  state: LocalState,
  proof: PortfolioProof,
  now = new Date(),
): LocalState {
  if (!isRewardablePortfolioProof(proof)) return state;

  const existingIndex = state.portfolioProofs.findIndex((item) => item.projectId === proof.projectId);
  if (existingIndex >= 0) {
    return {
      ...state,
      portfolioProofs: state.portfolioProofs.map((item, index) => index === existingIndex ? proof : item),
    };
  }

  const rewarded = rewardProgress(state, { ...PORTFOLIO_PROOF_REWARD, now });
  return {
    ...rewarded,
    portfolioProofs: [...rewarded.portfolioProofs, proof],
  };
}
