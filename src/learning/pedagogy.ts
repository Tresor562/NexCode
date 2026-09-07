import { ActivityKind } from '../data/curriculumCore';

export type LearningPhase = {
  kind: ActivityKind;
  purpose: string;
  minOccurrences: number;
  masteryGate?: number;
  labRequired?: boolean;
};

export type CourseDepthPolicy = {
  targetActivitiesPerCourse: number;
  preferredChapterCount: { min: number; max: number };
  preferredActivitiesPerChapter: { min: number; max: number };
  phases: LearningPhase[];
  rules: string[];
};

export const beginnerCourseDepthPolicy: CourseDepthPolicy = {
  targetActivitiesPerCourse: 500,
  preferredChapterCount: { min: 20, max: 35 },
  preferredActivitiesPerChapter: { min: 15, max: 30 },
  phases: [
    { kind: 'learn', purpose: 'Introduire une seule nouvelle notion avec modèle mental et exemple minimal.', minOccurrences: 1 },
    { kind: 'practice', purpose: 'Rappeler immédiatement la notion sans recopier la solution.', minOccurrences: 2 },
    { kind: 'practice', purpose: 'Varier le contexte pour éviter la mémorisation mécanique.', minOccurrences: 2 },
    { kind: 'lab', purpose: 'Utiliser la notion dans du code manipulable.', minOccurrences: 1, masteryGate: 55, labRequired: true },
    { kind: 'review', purpose: 'Réactiver la notion après un délai et la mélanger avec des acquis précédents.', minOccurrences: 2 },
    { kind: 'checkpoint', purpose: 'Vérifier la compréhension sans annoncer exactement la notion testée.', minOccurrences: 1, masteryGate: 70 },
    { kind: 'boss', purpose: 'Combiner plusieurs compétences dans un problème plus ouvert.', minOccurrences: 1, masteryGate: 80 },
  ],
  rules: [
    'Une activité doit introduire, pratiquer, réviser, combiner ou évaluer une compétence identifiable.',
    'Aucun compteur de leçons ne doit être saisi manuellement : il dérive du contenu réel.',
    'Une nouvelle notion ne doit pas être débloquée si ses prérequis essentiels sont faibles.',
    'Chaque compétence importante doit réapparaître dans un autre contexte plus tard dans le parcours.',
    'Un chapitre doit contenir au moins une activité de pratique et un checkpoint.',
    'Les chapitres de programmation doivent recommander le Lab régulièrement, pas seulement en fin de cours.',
    'Les projets servent de preuve de transfert : ils ne remplacent pas les exercices ciblés.',
    'XP, progression et maîtrise restent trois métriques distinctes.',
  ],
};

function finitePositiveInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

export function estimatedConceptCapacity(policy = beginnerCourseDepthPolicy) {
  const targetActivities = finitePositiveInteger(policy.targetActivitiesPerCourse);
  const activitiesPerConcept = policy.phases.reduce(
    (sum, phase) => sum + finitePositiveInteger(phase.minOccurrences),
    0,
  );
  if (!targetActivities || !activitiesPerConcept) return 0;
  return Math.floor(targetActivities / activitiesPerConcept);
}
