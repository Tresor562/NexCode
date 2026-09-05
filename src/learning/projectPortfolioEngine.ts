import { GuidedProject } from '../data/curriculumCore';
import { MasteryMap, SkillNode } from './skillGraph';
import { defaultProjectRubric, reviewProject } from './projectEngine';

export type ResolvedProjectSkill = {
  requested: string;
  skillIds: string[];
};

export type PortfolioProof = {
  projectId: string;
  title: string;
  completedAt: string;
  score: number;
  skillIds: string[];
  rubricIds: string[];
  evidenceSummary: string;
};

const MAX_COMPLETION_CLOCK_SKEW_MS = 5 * 60 * 1000;

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function canonicalProjectSkills(skills: string[]): string[] {
  const seen = new Set<string>();
  const canonical: string[] = [];
  for (const raw of skills) {
    const requested = raw.trim();
    const identity = normalize(requested);
    if (!identity || seen.has(identity)) continue;
    seen.add(identity);
    canonical.push(requested);
  }
  return canonical;
}

function canonicalProofSkillIds(skillIds: string[]): string[] {
  const seen = new Set<string>();
  const canonical: string[] = [];
  for (const raw of skillIds) {
    const skillId = raw.trim();
    const identity = normalize(skillId);
    if (!identity || seen.has(identity)) continue;
    seen.add(identity);
    canonical.push(skillId);
  }
  return canonical;
}

function boundedPercent(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
}

function readinessGate(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 55;
}

function validCompletionDate(value: Date, now = new Date()): Date {
  const safeNow = now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) return safeNow;
  return value.getTime() <= safeNow.getTime() + MAX_COMPLETION_CLOCK_SKEW_MS ? value : safeNow;
}

function canonicalAchievedRubricIds(project: GuidedProject, achievedRubricIds: string[]): string[] {
  const allowed = new Set(defaultProjectRubric(project).map((item) => item.id));
  return [...new Set(achievedRubricIds.map((id) => id.trim()).filter((id) => id && allowed.has(id)))];
}

export function resolveProjectSkills(project: GuidedProject, graph: SkillNode[]): ResolvedProjectSkill[] {
  return canonicalProjectSkills(project.skills).map((requested) => {
    const terms = normalize(requested).split(/\s+/).filter((term) => term.length >= 3);
    const scored = graph.map((node) => {
      const haystack = normalize(`${node.id} ${node.title}`);
      const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
      return { node, score };
    }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.node.id.localeCompare(b.node.id));
    const best = scored[0]?.score ?? 0;
    return { requested, skillIds: scored.filter((item) => item.score === best).slice(0, 4).map((item) => item.node.id) };
  });
}

function skillReadinessScore(skillId: string, mastery: MasteryMap) {
  const state = mastery[skillId];
  if (!state) return 0;
  const score = boundedPercent(state.score);
  const confidence = boundedPercent(state.confidence);

  // Projects are a transfer activity: the learner does not need prior project
  // evidence to start one, but a high raw score from too little evidence should
  // not make the prerequisite look consolidated. Blend demonstrated score with
  // confidence so readiness reflects both competence and evidence depth.
  return Math.round((score * 0.75) + (confidence * 0.25));
}

export function projectReadinessAgainstGraph(project: GuidedProject, graph: SkillNode[], mastery: MasteryMap, gate = 55) {
  const safeGate = readinessGate(gate);
  const resolved = resolveProjectSkills(project, graph);
  const skillIds = [...new Set(resolved.flatMap((item) => item.skillIds))];
  const unresolved = resolved.filter((item) => item.skillIds.length === 0).map((item) => item.requested);
  const missing = skillIds.filter((id) => !mastery[id]);
  const weak = skillIds.filter((id) => mastery[id] && boundedPercent(mastery[id]?.score) < safeGate);
  const confidenceGate = Math.min(70, Math.max(40, safeGate));
  const uncertain = skillIds.filter((id) => {
    const state = mastery[id];
    if (!state) return false;
    const score = boundedPercent(state.score);
    const confidence = boundedPercent(state.confidence);
    return score >= safeGate && confidence < confidenceGate;
  });

  // Unmapped prerequisite labels are real readiness gaps. Treat each unresolved
  // label as a zero-score prerequisite so the percentage cannot claim 100%
  // consolidated while the project is still blocked by unknown skills.
  const prerequisiteCount = skillIds.length + unresolved.length;
  const score = prerequisiteCount > 0
    ? Math.round(skillIds.reduce((sum, id) => sum + skillReadinessScore(id, mastery), 0) / prerequisiteCount)
    : 0;

  return {
    ready: unresolved.length === 0 && missing.length === 0 && weak.length === 0 && uncertain.length === 0,
    score,
    skillIds,
    unresolvedSkillLabels: unresolved,
    missingSkillIds: missing,
    weakSkillIds: weak,
    uncertainSkillIds: uncertain,
  };
}

export function buildPortfolioProof(
  project: GuidedProject,
  graph: SkillNode[],
  achievedRubricIds: string[],
  completedAt = new Date(),
): PortfolioProof | undefined {
  const safeRubricIds = canonicalAchievedRubricIds(project, achievedRubricIds);
  const review = reviewProject(project, safeRubricIds);
  if (!review.passed) return undefined;
  const skillIds = [...new Set(resolveProjectSkills(project, graph).flatMap((item) => item.skillIds))];
  const rubric = defaultProjectRubric(project);
  const achievedTitles = rubric.filter((item) => safeRubricIds.includes(item.id)).map((item) => item.title);
  return {
    projectId: project.id,
    title: project.title,
    completedAt: validCompletionDate(completedAt).toISOString(),
    score: review.score,
    skillIds,
    rubricIds: safeRubricIds,
    evidenceSummary: `${project.title} • ${review.score}/100 • preuves : ${achievedTitles.join(', ')}`,
  };
}

export function portfolioSkillCoverage(proofs: PortfolioProof[]) {
  const projectsBySkill = new Map<string, Set<string>>();
  for (const proof of proofs) {
    const projectId = typeof proof.projectId === 'string' ? normalize(proof.projectId) : '';
    if (!projectId) continue;
    for (const skillId of canonicalProofSkillIds(proof.skillIds)) {
      const projects = projectsBySkill.get(skillId) ?? new Set<string>();
      projects.add(projectId);
      projectsBySkill.set(skillId, projects);
    }
  }
  return [...projectsBySkill.entries()]
    .map(([skillId, projectIds]) => ({ skillId, projectCount: projectIds.size }))
    .sort((a, b) => b.projectCount - a.projectCount || a.skillId.localeCompare(b.skillId));
}
