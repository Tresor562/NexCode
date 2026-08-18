import { Lesson } from './curriculumCore';
import { buildMasterySequence, MasteryConceptSeed, MasterySequenceConfig } from './masteryFactory';

export type DeepBotSeed = MasteryConceptSeed;

function productionTransfer(seed: MasteryConceptSeed): MasteryConceptSeed {
  return {
    ...seed,
    id: `${seed.id}-production-transfer`,
    title: `${seed.title} — transfert production`,
    concept: `${seed.concept} En production, applique aussi ce principe avec observabilité, reprise après erreur, limites explicites et comportement sûr sous retry ou concurrence.`,
    example: `${seed.example}\n// production: validate -> act -> observe -> recover`,
    question: `Quelle approche transforme « ${seed.title} » en comportement fiable de production ?`,
    correct: `Appliquer le principe, vérifier les préconditions, observer le résultat et prévoir la récupération.`,
    distractors: [
      `Ajouter uniquement plus de logs sans changer le comportement.`,
      `Supposer que le cas nominal suffit puisque les tests locaux passent.`,
    ],
    practice: `${seed.practice} Rejoue ensuite le scénario avec retry, concurrence ou erreur réseau et explique ce qui reste stable.`,
    lab: `${seed.lab} Ajoute ensuite une variante production avec journal d’audit, erreur contrôlée et stratégie de reprise.`,
    misconception: `${seed.misconception} Une solution correcte une seule fois n’est pas encore une solution robuste en production.`,
  };
}

export function buildDeepBotMastery(seeds: DeepBotSeed[], config: MasterySequenceConfig): Lesson[] {
  return seeds.flatMap((seed) => [
    ...buildMasterySequence(seed, config),
    ...buildMasterySequence(productionTransfer(seed), config),
  ]);
}
