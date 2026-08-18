import { Course } from '../data/curriculumCore';

export type SkillPrerequisiteRule = {
  skillId: string;
  requires: string[];
  rationale: string;
  minimumScore: number;
};

const courseSkill = (courseId: string, moduleSlug: string) => `${courseId}.${moduleSlug}`;

export const crossTrackPrerequisiteRules: SkillPrerequisiteRule[] = [
  {
    skillId: courseSkill('css-foundations', 'responsive'),
    requires: [courseSkill('html-foundations', 'structure')],
    rationale: 'Le responsive s’appuie sur une structure HTML comprise et stable.',
    minimumScore: 55,
  },
  {
    skillId: courseSkill('javascript-foundations', 'dom'),
    requires: [courseSkill('html-foundations', 'structure'), courseSkill('css-foundations', 'selectors')],
    rationale: 'Manipuler le DOM nécessite de reconnaître les éléments HTML et les sélectionner correctement.',
    minimumScore: 55,
  },
  {
    skillId: courseSkill('node-api-foundations', 'http'),
    requires: [courseSkill('web-internet-foundations', 'http'), courseSkill('javascript-foundations', 'functions')],
    rationale: 'Une API Node combine le modèle HTTP et des fonctions JavaScript solides.',
    minimumScore: 60,
  },
  {
    skillId: courseSkill('node-api-foundations', 'api-rest'),
    requires: [courseSkill('node-api-foundations', 'http'), courseSkill('javascript-foundations', 'objects')],
    rationale: 'Concevoir une API REST nécessite de comprendre HTTP et de manipuler des structures de données.',
    minimumScore: 65,
  },
  {
    skillId: courseSkill('git-github-foundations', 'github'),
    requires: [courseSkill('git-github-foundations', 'commits')],
    rationale: 'GitHub devient utile lorsque les commits et l’historique Git sont compris.',
    minimumScore: 55,
  },
  {
    skillId: courseSkill('bot-foundations', 'transport'),
    requires: [courseSkill('web-internet-foundations', 'http')],
    rationale: 'Polling et webhooks reposent sur le transport réseau et HTTP.',
    minimumScore: 55,
  },
  {
    skillId: courseSkill('telegram-bots', 'webhooks'),
    requires: [courseSkill('bot-foundations', 'transport'), courseSkill('node-api-foundations', 'http')],
    rationale: 'Un webhook Telegram est un endpoint HTTP public piloté par le moteur de bot.',
    minimumScore: 65,
  },
  {
    skillId: courseSkill('discord-bots', 'permissions'),
    requires: [courseSkill('bot-foundations', 'securite')],
    rationale: 'Les permissions Discord doivent être abordées après les principes de sécurité généraux des bots.',
    minimumScore: 60,
  },
  {
    skillId: courseSkill('whatsapp-bots', 'securite'),
    requires: [courseSkill('bot-foundations', 'securite')],
    rationale: 'La gestion des sessions et secrets WhatsApp reprend les mêmes règles fondamentales de sécurité.',
    minimumScore: 60,
  },
  {
    skillId: courseSkill('sql-foundations', 'relations'),
    requires: [courseSkill('sql-foundations', 'tables')],
    rationale: 'Les relations supposent d’abord une compréhension correcte des tables et clés.',
    minimumScore: 60,
  },
];

export function prerequisiteRuleMap() {
  return new Map(crossTrackPrerequisiteRules.map((rule) => [rule.skillId, rule]));
}

export function auditPrerequisiteRules(courses: Course[]) {
  const knownSkills = new Set(courses.flatMap((course) => course.skillIds));
  const issues: string[] = [];
  const seen = new Set<string>();

  for (const rule of crossTrackPrerequisiteRules) {
    if (seen.has(rule.skillId)) issues.push(`Duplicate prerequisite rule for ${rule.skillId}`);
    seen.add(rule.skillId);
    if (!knownSkills.has(rule.skillId)) issues.push(`Prerequisite policy targets unknown skill ${rule.skillId}`);
    for (const prerequisite of rule.requires) {
      if (!knownSkills.has(prerequisite)) issues.push(`Prerequisite policy references unknown skill ${prerequisite}`);
      if (prerequisite === rule.skillId) issues.push(`Skill ${rule.skillId} cannot require itself`);
    }
  }

  const graph = new Map<string, string[]>();
  for (const rule of crossTrackPrerequisiteRules) graph.set(rule.skillId, rule.requires);
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(id: string, trail: string[]) {
    if (visiting.has(id)) {
      issues.push(`Prerequisite cycle detected: ${[...trail, id].join(' -> ')}`);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const next of graph.get(id) ?? []) visit(next, [...trail, id]);
    visiting.delete(id);
    visited.add(id);
  }

  for (const id of graph.keys()) visit(id, []);
  return issues;
}
