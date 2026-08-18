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

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function resolveProjectSkills(project: GuidedProject, graph: SkillNode[]): ResolvedProjectSkill[] {
  return project.skills.map((requested) => {
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

export function projectReadinessAgainstGraph(project: GuidedProject, graph: SkillNode[], mastery: MasteryMap, gate = 55) {
  const resolved = resolveProjectSkills(project, graph);
  const skillIds = [...new Set(resolved.flatMap((item) => item.skillIds))];
  const unresolved = resolved.filter((item) => item.skillIds.length === 0).map((item) => item.requested);
  const missing = skillIds.filter((id) => !mastery[id]);
  const weak = skillIds.filter((id) => mastery[id] && (mastery[id]?.score ?? 0) < gate);
  const score = skillIds.length ? Math.round(skillIds.reduce((sum, id) => sum + (mastery[id]?.score ?? 0), 0) / skillIds.length) : 0;
  return {
    ready: unresolved.length === 0 && missing.length === 0 && weak.length === 0,
    score,
    skillIds,
    unresolvedSkillLabels: unresolved,
    missingSkillIds: missing,
    weakSkillIds: weak,
  };
}

export function buildPortfolioProof(
  project: GuidedProject,
  graph: SkillNode[],
  achievedRubricIds: string[],
  completedAt = new Date(),
): PortfolioProof | undefined {
  const review = reviewProject(project, achievedRubricIds);
  if (!review.passed) return undefined;
  const skillIds = [...new Set(resolveProjectSkills(project, graph).flatMap((item) => item.skillIds))];
  const rubric = defaultProjectRubric(project);
  const achievedTitles = rubric.filter((item) => achievedRubricIds.includes(item.id)).map((item) => item.title);
  return {
    projectId: project.id,
    title: project.title,
    completedAt: completedAt.toISOString(),
    score: review.score,
    skillIds,
    rubricIds: achievedRubricIds,
    evidenceSummary: `${project.title} • ${review.score}/100 • preuves : ${achievedTitles.join(', ')}`,
  };
}

export function portfolioSkillCoverage(proofs: PortfolioProof[]) {
  const covered = new Map<string, number>();
  for (const proof of proofs) for (const skillId of proof.skillIds) covered.set(skillId, (covered.get(skillId) ?? 0) + 1);
  return [...covered.entries()].map(([skillId, projectCount]) => ({ skillId, projectCount })).sort((a, b) => b.projectCount - a.projectCount);
}
