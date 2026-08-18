import { buildDeepBotMastery, DeepBotSeed } from './botDeepFactory';

const telegramSupplementSeeds: DeepBotSeed[] = [
  {
    id: 'conversation-routing',
    module: 'Architecture',
    title: 'Router privé, groupe et canal sans ambiguïté',
    concept: 'Un bot Telegram doit distinguer le contexte de conversation avant d’appliquer règles, commandes, confidentialité et réponses. La même commande peut être valide en privé et interdite dans un groupe.',
    example: 'const context = chat.type === "private" ? "private" : chat.type === "channel" ? "channel" : "group";',
    question: 'Pourquoi le type de chat doit-il faire partie du routage métier ?',
    correct: 'Parce que permissions, visibilité, commandes et attentes utilisateur changent selon le contexte.',
    distractors: ['Parce que tous les groupes utilisent un autre token', 'Uniquement pour modifier la couleur des boutons'],
    practice: 'Définis la matrice de disponibilité de /profile, /ban et /announce en privé, groupe et canal.',
    lab: 'Implémente un routeur contextuel qui refuse proprement les commandes impossibles et teste au moins trois types de chat.',
    misconception: 'Vérifier seulement chat.id ne suffit pas : deux conversations peuvent avoir des identifiants valides mais des règles radicalement différentes.',
  },
  {
    id: 'telegram-api-error-taxonomy',
    module: 'Fiabilité',
    title: 'Classifier les erreurs Bot API',
    concept: 'Les erreurs Telegram doivent être séparées entre entrée invalide, permission manquante, ressource disparue, limite temporaire et panne distante afin de choisir abandon, correction, retry ou intervention.',
    example: '400 -> corriger requête; 403 -> permission/contexte; 429 -> retry_after; 5xx -> retry borné',
    question: 'Quelle réponse mérite normalement un retry planifié selon retry_after ?',
    correct: 'Une limitation 429 indiquant un délai avant nouvel essai.',
    distractors: ['Toute erreur 400 sans analyse', 'Une permission 403 permanente en boucle'],
    practice: 'Classe huit erreurs Bot API entre retry, abandon contrôlé, correction développeur et action administrateur.',
    lab: 'Crée un classifyTelegramError(error) puis une politique de retry avec backoff, retry_after et dead-letter après épuisement.',
    misconception: 'Réessayer toutes les erreurs transforme les fautes permanentes en boucles de charge et masque leur vraie cause.',
  },
];

const whatsappSupplementSeeds: DeepBotSeed[] = [
  {
    id: 'protocol-version-compatibility',
    module: 'Production',
    title: 'Compatibilité de version et changements protocole',
    concept: 'Une intégration WhatsApp basée sur une bibliothèque cliente doit isoler les dépendances protocole, tester les mises à jour et prévoir rollback, car une mise à jour de bibliothèque peut changer connexion, événements ou structures de messages.',
    example: 'adapter -> normalized events -> domain handlers; canary library upgrade -> rollback on reconnect/error regression',
    question: 'Pourquoi placer un adaptateur entre la bibliothèque WhatsApp et les commandes métier ?',
    correct: 'Pour limiter l’impact des changements de structures ou comportements de la bibliothèque sur le reste du bot.',
    distractors: ['Pour contourner les règles de la plateforme', 'Pour stocker le QR dans chaque commande'],
    practice: 'Liste les contrats internes qui doivent rester stables lors d’une mise à jour de la bibliothèque cliente.',
    lab: 'Crée une interface WhatsAppAdapter, deux formes d’événement simulées v1/v2 et prouve que le handler métier reste inchangé.',
    misconception: 'Un build TypeScript réussi ne garantit pas qu’une mise à jour protocolaire reste compatible à l’exécution ; les tests de reconnexion et événements sont indispensables.',
  },
];

const config = (courseId: string) => ({
  courseId,
  language: 'Bots' as const,
  starterFiles: (seed: DeepBotSeed) => ({
    'handler.ts': `// ${seed.title}\nexport async function handle(event: unknown) {\n  // TODO pédagogique : ${seed.practice}\n}\n`,
    'README.md': `# Mission\n${seed.lab}\n`,
    'tests.md': '- nominal\n- erreur permanente\n- erreur temporaire\n- concurrence/retry\n- aucun secret réel\n',
  }),
});

export const telegramCompletionSupplementLessons = buildDeepBotMastery(telegramSupplementSeeds, config('telegram-bots'));
export const whatsappCompletionSupplementLessons = buildDeepBotMastery(whatsappSupplementSeeds, config('whatsapp-bots'));

export const botCompletionSupplementMetrics = {
  telegram: { concepts: telegramSupplementSeeds.length, activities: telegramCompletionSupplementLessons.length },
  whatsapp: { concepts: whatsappSupplementSeeds.length, activities: whatsappCompletionSupplementLessons.length },
};
