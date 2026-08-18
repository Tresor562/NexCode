import { MasteryMap, SkillNode, prerequisitesReady } from './skillGraph';

export type SkillGraphIssue = {
  type: 'missing-prerequisite' | 'self-dependency' | 'cycle' | 'no-evidence';
  skillId: string;
  detail: string;
};

export function skillGraphIssues(nodes: SkillNode[]): SkillGraphIssue[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const issues: SkillGraphIssue[] = [];

  for (const node of nodes) {
    if (node.evidenceLessonIds.length === 0) {
      issues.push({ type: 'no-evidence', skillId: node.id, detail: 'Aucune activité de transfert/évaluation ne prouve cette compétence.' });
    }
    for (const prerequisiteId of node.prerequisiteIds) {
      if (prerequisiteId === node.id) {
        issues.push({ type: 'self-dependency', skillId: node.id, detail: 'La compétence dépend d’elle-même.' });
      } else if (!byId.has(prerequisiteId)) {
        issues.push({ type: 'missing-prerequisite', skillId: node.id, detail: `Prérequis introuvable : ${prerequisiteId}` });
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycleKeys = new Set<string>();
  function visit(id: string, path: string[]) {
    if (visiting.has(id)) {
      const cycleStart = path.indexOf(id);
      const cycle = [...path.slice(Math.max(0, cycleStart)), id];
      const key = cycle.join(' -> ');
      if (!cycleKeys.has(key)) {
        cycleKeys.add(key);
        issues.push({ type: 'cycle', skillId: id, detail: `Cycle de prérequis : ${key}` });
      }
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    const node = byId.get(id);
    for (const prerequisiteId of node?.prerequisiteIds ?? []) {
      if (byId.has(prerequisiteId)) visit(prerequisiteId, [...path, id]);
    }
    visiting.delete(id);
    visited.add(id);
  }
  nodes.forEach((node) => visit(node.id, []));
  return issues;
}

export function learningFrontier(nodes: SkillNode[], mastery: MasteryMap) {
  return nodes
    .filter((node) => (mastery[node.id]?.score ?? 0) < 85 && prerequisitesReady(node, mastery))
    .sort((a, b) => {
      const aScore = mastery[a.id]?.score ?? 0;
      const bScore = mastery[b.id]?.score ?? 0;
      const aEvidence = mastery[a.id]?.evidence.length ?? 0;
      const bEvidence = mastery[b.id]?.evidence.length ?? 0;
      return aScore - bScore || aEvidence - bEvidence || a.id.localeCompare(b.id);
    });
}

export function blockedSkills(nodes: SkillNode[], mastery: MasteryMap) {
  return nodes
    .filter((node) => !prerequisitesReady(node, mastery))
    .map((node) => ({
      skillId: node.id,
      missing: node.prerequisiteIds.filter((id) => (mastery[id]?.score ?? 0) < node.prerequisiteGate),
      gate: node.prerequisiteGate,
    }));
}
