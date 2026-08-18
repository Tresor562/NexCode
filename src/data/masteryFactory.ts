import { ExerciseSpec, LabMission, Lesson } from './curriculumCore';

export type MasteryConceptSeed = {
  id: string;
  module: string;
  title: string;
  concept: string;
  example: string;
  question: string;
  correct: string;
  distractors: [string, string];
  practice: string;
  lab: string;
  misconception: string;
};

export type MasterySequenceConfig = {
  courseId: string;
  language: LabMission['language'];
  starterFiles: (seed: MasteryConceptSeed) => Record<string, string>;
};

function slug(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function exercise(id: string, kind: ExerciseSpec['kind'], prompt: string, skillId: string, difficulty: 1|2|3|4|5, hints: string[], error: string): ExerciseSpec {
  return { id, kind, prompt, skillIds: [skillId], difficulty, hints, errorTags: [error] };
}

export function buildMasterySequence(seed: MasteryConceptSeed, config: MasterySequenceConfig): Lesson[] {
  const skill = `${config.courseId}.${slug(seed.module)}.${seed.id}`;
  const error = `${skill}.misconception`;
  const [wrongA, wrongB] = seed.distractors;
  const common = { module: seed.module, skillIds: [skill] };
  return [
    { ...common, id:`${config.courseId}-mastery-${seed.id}-learn`, title:`${seed.title} — comprendre`, durationMin:7, concept:seed.concept, example:seed.example, question:seed.question, choices:[seed.correct,wrongA,wrongB], correctIndex:0, explanation:`${seed.correct}. ${seed.misconception}`, activityKind:'learn', difficulty:1, retrievalPrompt:`Explique sans regarder : ${seed.title}.`, transferPrompt:seed.practice, exercises:[exercise(`${config.courseId}.${seed.id}.learn`,'mcq',seed.question,skill,1,['Reviens au rôle de la notion avant sa syntaxe.'],error)] },
    { ...common, id:`${config.courseId}-mastery-${seed.id}-recall`, title:`${seed.title} — rappel actif`, durationMin:5, concept:`Récupère « ${seed.title} » de mémoire avant de revoir le modèle.`, example:'Fais une tentative complète avant d’afficher le modèle.', question:seed.question, choices:[wrongA,seed.correct,wrongB], correctIndex:1, explanation:`${seed.correct}. ${seed.misconception}`, activityKind:'practice', difficulty:2, retrievalPrompt:seed.practice, transferPrompt:`Donne un autre contexte réel pour ${seed.title}.`, exercises:[exercise(`${config.courseId}.${seed.id}.recall`,'explain',seed.practice,skill,2,['Explique d’abord le principe, ensuite la syntaxe.'],error)] },
    { ...common, id:`${config.courseId}-mastery-${seed.id}-distinguish`, title:`${seed.title} — distinguer`, durationMin:6, concept:'Compare la solution correcte à deux alternatives plausibles et justifie le choix.', example:seed.example, question:`Quelle réponse respecte le mieux « ${seed.title} » ?`, choices:[wrongB,wrongA,seed.correct], correctIndex:2, explanation:`${seed.correct} répond au besoin. ${seed.misconception}`, activityKind:'practice', difficulty:2, retrievalPrompt:`Quelle confusion faut-il éviter ? ${seed.misconception}`, transferPrompt:seed.practice, exercises:[exercise(`${config.courseId}.${seed.id}.distinguish`,'order-steps',`Décris ton raisonnement avant d’appliquer : ${seed.practice}`,skill,2,['Intention → contrainte → solution → vérification.'],error)] },
    { ...common, id:`${config.courseId}-mastery-${seed.id}-apply`, title:`${seed.title} — appliquer`, durationMin:8, concept:'Applique la notion dans un contexte différent afin de vérifier que tu ne mémorises pas seulement l’exemple.', example:seed.example, question:seed.question, choices:[seed.correct,wrongB,wrongA], correctIndex:0, explanation:`La solution doit conserver le principe. ${seed.misconception}`, activityKind:'practice', difficulty:3, retrievalPrompt:seed.practice, transferPrompt:`Adapte ${seed.title} à une interface différente.`, exercises:[exercise(`${config.courseId}.${seed.id}.apply`,'write-code',seed.practice,skill,3,['Commence par la version minimale correcte puis améliore-la.'],error)] },
    { ...common, id:`${config.courseId}-mastery-${seed.id}-lab`, title:`${seed.title} — mission Lab`, durationMin:12, concept:'Manipule la notion dans un workspace et produis une variante observable.', example:seed.example, question:'Quelle preuve est la plus forte ?', choices:['Une variante fonctionnelle que tu peux expliquer','Une copie exacte','Un QCM mémorisé'], correctIndex:0, explanation:'Le Lab crée une preuve de transfert plus forte qu’une simple reconnaissance.', activityKind:'lab', difficulty:3, retrievalPrompt:`Décris ton plan avant d’ouvrir le Lab.`, transferPrompt:seed.lab, labMission:{ id:`${config.courseId}.${seed.id}.lab`, title:`Lab — ${seed.title}`, instructions:seed.lab, language:config.language, starterFiles:config.starterFiles(seed), successCriteria:['Le travail diffère réellement du départ','La structure correspond au langage et à la notion','Aucun secret ou token réel n’est présent','Le résultat est assez complet pour être expliqué'] }, exercises:[exercise(`${config.courseId}.${seed.id}.lab`,'write-code',seed.lab,skill,3,['Observe le résultat après chaque modification importante.'],error)] },
    { ...common, id:`${config.courseId}-mastery-${seed.id}-debug`, title:`${seed.title} — déboguer`, durationMin:8, concept:'Repère une mauvaise utilisation réaliste et justifie la correction plutôt que de modifier au hasard.', example:`Erreur à éviter : ${seed.misconception}\nRéférence : ${seed.example}`, question:'Quelle méthode de debug est préférable ?', choices:['Identifier la règle violée puis tester la correction','Modifier au hasard','Masquer le défaut'], correctIndex:0, explanation:`Le debug part du modèle mental. ${seed.misconception}`, activityKind:'practice', difficulty:4, retrievalPrompt:`Explique l’erreur : ${seed.misconception}`, transferPrompt:'Invente une erreur voisine puis corrige-la.', exercises:[exercise(`${config.courseId}.${seed.id}.debug`,'debug',`Trouve et corrige une erreur liée à « ${seed.title} ».`,skill,4,['Reviens au comportement attendu avant de changer le code.'],error)] },
    { ...common, id:`${config.courseId}-mastery-${seed.id}-review`, title:`${seed.title} — révision espacée`, durationMin:6, concept:'Réactive la notion sans modèle immédiat et relie-la à un acquis antérieur.', example:`Modèle après tentative : ${seed.example}`, question:seed.question, choices:[wrongB,seed.correct,wrongA], correctIndex:1, explanation:`${seed.correct}. ${seed.misconception}`, activityKind:'review', difficulty:3, retrievalPrompt:`Explique ${seed.title} en une phrase puis donne un exemple de mémoire.`, transferPrompt:`Relie cette notion à une autre du parcours.`, exercises:[exercise(`${config.courseId}.${seed.id}.review`,'explain',`Explique ${seed.title} et une erreur à éviter.`,skill,3,['N’ouvre le modèle qu’après ta tentative.'],error)] },
    { ...common, id:`${config.courseId}-mastery-${seed.id}-checkpoint`, title:`${seed.title} — checkpoint`, durationMin:10, concept:'Vérifie reconnaissance, production, correction et transfert avec moins de guidage.', example:`Référence après tentative : ${seed.example}`, question:seed.question, choices:[seed.correct,wrongA,wrongB], correctIndex:0, explanation:`Checkpoint : ${seed.correct}. ${seed.misconception}`, activityKind:'checkpoint', difficulty:4, retrievalPrompt:seed.practice, transferPrompt:seed.lab, exercises:[exercise(`${config.courseId}.${seed.id}.checkpoint.write`,'write-code',seed.practice,skill,4,['Essaie sans indice avant de demander de l’aide.'],error),exercise(`${config.courseId}.${seed.id}.checkpoint.explain`,'explain',seed.misconception,skill,4,['Explique pourquoi l’erreur est plausible mais incorrecte.'],error)] },
  ];
}

export function buildMasteryCurriculum(seeds: MasteryConceptSeed[], config: MasterySequenceConfig) {
  return seeds.flatMap((seed) => buildMasterySequence(seed, config));
}
