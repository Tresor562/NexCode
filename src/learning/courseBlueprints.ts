export type CourseExpansionBlueprint = {
  courseId: string;
  targetActivities: number;
  targetChapters: number;
  chapterThemes: string[];
  capstone: string;
  exitCriteria: string[];
};

const commonExitCriteria = [
  'Expliquer les notions principales sans réciter le cours',
  'Résoudre des exercices nouveaux sans dépendre systématiquement des indices',
  'Corriger des erreurs réalistes et expliquer leur cause',
  'Réussir les checkpoints et boss challenges avec une maîtrise suffisante',
  'Terminer au moins un projet de transfert avec revue de qualité',
];

export const courseBlueprints: CourseExpansionBlueprint[] = [
  {
    courseId: 'web-internet-foundations', targetActivities: 176, targetChapters: 14,
    chapterThemes: ['Internet, Web et architecture client-serveur', 'HTTP, URL et DNS', 'navigateurs et DevTools', 'fichiers Web et progressive enhancement', 'accessibilité et responsive', 'stockage, cookies et sécurité Web', 'API et échanges de données', 'performance et observabilité', 'hébergement, domaines et HTTPS', 'debug réseau', 'architecture d’une application Web', 'qualité et revue', 'projet Web guidé', 'capstone et révision finale'],
    capstone: 'Diagnostiquer, expliquer puis publier une petite application Web complète.', exitCriteria: commonExitCriteria,
  },
  {
    courseId: 'html-foundations', targetActivities: 184, targetChapters: 15,
    chapterThemes: ['structure et sémantique du document', 'texte, liens et navigation', 'images et médias', 'listes et tableaux', 'formulaires, labels et validation', 'landmarks et accessibilité', 'metadata et SEO de base', 'attributs globaux et ARIA avec prudence', 'patterns de contenu', 'lecture et debug de HTML existant', 'refactor sémantique', 'intégration CSS', 'intégration JavaScript', 'projet multi-page', 'capstone'],
    capstone: 'Construire un site multi-page accessible et sémantique sans template.', exitCriteria: commonExitCriteria,
  },
  {
    courseId: 'css-foundations', targetActivities: 190, targetChapters: 16,
    chapterThemes: ['cascade, sélecteurs et spécificité', 'unités, couleurs et typographie', 'box model et display', 'positionnement et overflow', 'flexbox', 'grid', 'responsive et media queries', 'pseudo-classes et pseudo-éléments', 'variables et tokens', 'transitions et animations', 'accessibilité visuelle', 'architecture CSS et composants', 'debug layout', 'performance CSS', 'mini design system', 'capstone responsive'],
    capstone: 'Créer un mini design system responsive et l’utiliser dans un site réel.', exitCriteria: commonExitCriteria,
  },
  {
    courseId: 'javascript-foundations', targetActivities: 198, targetChapters: 18,
    chapterThemes: ['valeurs, types et variables', 'opérateurs et conditions', 'boucles et raisonnement', 'fonctions et scope', 'tableaux et objets', 'chaînes, destructuring et spread', 'erreurs et debug', 'DOM', 'événements et formulaires', 'modules', 'JSON et stockage local', 'fetch et API', 'promesses et async/await', 'dates et données', 'tests de base', 'qualité et refactor', 'projet UI + API', 'capstone'],
    capstone: 'Construire une application interactive consommant une API, testée et débogable.', exitCriteria: commonExitCriteria,
  },
  {
    courseId: 'python-foundations', targetActivities: 194, targetChapters: 17,
    chapterThemes: ['syntaxe, variables et types', 'conditions et boucles', 'fonctions et scope', 'listes, tuples et sets', 'dictionnaires et chaînes', 'compréhensions', 'erreurs et exceptions', 'fichiers', 'modules, packages et environnements', 'JSON et HTTP', 'classes', 'tests et debug', 'qualité et refactor', 'algorithmes débutants', 'CLI', 'automatisation', 'capstone'],
    capstone: 'Créer un outil Python en ligne de commande structuré, testé et documenté.', exitCriteria: commonExitCriteria,
  },
  {
    courseId: 'sql-foundations', targetActivities: 182, targetChapters: 15,
    chapterThemes: ['modèle relationnel, tables et types', 'SELECT, WHERE et ORDER BY', 'écriture de données et NULL', 'fonctions et agrégations', 'GROUP BY et HAVING', 'jointures', 'sous-requêtes', 'relations et contraintes', 'index', 'transactions', 'normalisation', 'debug de requêtes', 'performance débutant', 'modélisation de projet', 'capstone'],
    capstone: 'Modéliser une application réelle puis écrire et optimiser ses requêtes essentielles.', exitCriteria: commonExitCriteria,
  },
  {
    courseId: 'git-github-foundations', targetActivities: 174, targetChapters: 14,
    chapterThemes: ['modèle Git, repository et status', 'add, commit et historique', 'diff, restore et revert', 'branches et merge', 'conflits', 'remote, push et pull', 'GitHub et collaboration', 'issues et pull requests', 'review', 'rebase débutant', 'tags et releases', 'workflows équipe', 'sécurité des secrets', 'capstone'],
    capstone: 'Gérer un projet complet avec branches, PR, revue et résolution de conflits.', exitCriteria: commonExitCriteria,
  },
  {
    courseId: 'node-api-foundations', targetActivities: 198, targetChapters: 18,
    chapterThemes: ['runtime Node, npm et modules', 'filesystem et configuration', 'HTTP et serveur', 'routing et REST', 'JSON et validation', 'erreurs et middlewares', 'env, logs et observabilité', 'auth et sécurité', 'rate limiting et CORS', 'base de données et CRUD', 'tests', 'mocks', 'documentation API', 'performance', 'health checks', 'déploiement', 'projet API', 'capstone'],
    capstone: 'Construire, tester, documenter et déployer une API REST avec persistance.', exitCriteria: commonExitCriteria,
  },
  {
    courseId: 'bot-foundations', targetActivities: 178, targetChapters: 15,
    chapterThemes: ['événements et updates', 'commandes et routing', 'état et sessions', 'permissions', 'configuration et secrets', 'erreurs et logs', 'rate limits et queues', 'webhooks et polling', 'médias et fichiers', 'internationalisation', 'modération', 'tests et simulation', 'déploiement et monitoring', 'architecture multi-bot', 'capstone'],
    capstone: 'Créer un moteur de bot robuste réutilisable sur plusieurs plateformes.', exitCriteria: commonExitCriteria,
  },
  {
    courseId: 'telegram-bots', targetActivities: 184, targetChapters: 16,
    chapterThemes: ['BotFather, token et sécurité', 'updates, messages et commandes', 'claviers et callbacks', 'formatage et médias', 'groupes et admins', 'permissions et sessions', 'inline mode', 'webhooks et polling', 'rate limits et erreurs API', 'paiements : concepts', 'tests', 'déploiement', 'monitoring', 'assistant de groupe', 'projet Telegram', 'capstone'],
    capstone: 'Construire un bot Telegram de groupe robuste avec état, permissions et monitoring.', exitCriteria: commonExitCriteria,
  },
  {
    courseId: 'discord-bots', targetActivities: 184, targetChapters: 16,
    chapterThemes: ['application, token et intents', 'events et slash commands', 'interactions', 'embeds et components', 'permissions et roles', 'channels et guilds', 'modération', 'state', 'rate limits et erreurs', 'logging et sécurité', 'voice : concepts', 'webhooks', 'tests', 'déploiement et monitoring', 'projet community bot', 'capstone'],
    capstone: 'Construire un bot Discord communautaire avec commandes, modération et observabilité.', exitCriteria: commonExitCriteria,
  },
  {
    courseId: 'whatsapp-bots', targetActivities: 188, targetChapters: 16,
    chapterThemes: ['architecture et connexion', 'sessions et reconnexion', 'messages et médias', 'commandes', 'groupes et participants', 'permissions et mentions', 'réactions et quoting', 'état et fichiers', 'rate limits et anti-spam', 'erreurs et logs', 'sécurité des sessions', 'tests et simulation', 'déploiement', 'monitoring', 'projet utility bot', 'capstone'],
    capstone: 'Construire un bot WhatsApp utilitaire stable avec reconnexion, permissions et monitoring.', exitCriteria: commonExitCriteria,
  },
];

export function blueprintForCourse(courseId: string) {
  return courseBlueprints.find((item) => item.courseId === courseId);
}

export function plannedActivityTarget() {
  return courseBlueprints.reduce((sum, item) => sum + item.targetActivities, 0);
}
