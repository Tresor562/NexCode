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
    courseId: 'web-internet-foundations', targetActivities: 520, targetChapters: 24,
    chapterThemes: ['Internet et Web', 'client et serveur', 'HTTP', 'URL et DNS', 'navigateurs', 'DevTools', 'fichiers Web', 'accessibilité', 'performance', 'sécurité Web', 'cookies et stockage', 'API', 'hébergement', 'domaines', 'HTTPS', 'déploiement', 'debug réseau', 'architecture Web', 'responsive', 'progressive enhancement', 'qualité', 'observabilité', 'projet Web', 'révision finale'],
    capstone: 'Diagnostiquer, expliquer puis publier une petite application Web complète.', exitCriteria: commonExitCriteria,
  },
  {
    courseId: 'html-foundations', targetActivities: 540, targetChapters: 26,
    chapterThemes: ['structure du document', 'texte', 'liens', 'images', 'listes', 'tables', 'formulaires', 'labels et validation', 'sémantique', 'landmarks', 'accessibilité', 'médias', 'iframe', 'metadata', 'SEO de base', 'données structurées', 'attributs globaux', 'ARIA avec prudence', 'patterns de contenu', 'lecture de HTML existant', 'debug markup', 'refactor sémantique', 'intégration CSS', 'intégration JS', 'projet multi-page', 'capstone'],
    capstone: 'Construire un site multi-page accessible et sémantique sans template.', exitCriteria: commonExitCriteria,
  },
  {
    courseId: 'css-foundations', targetActivities: 560, targetChapters: 28,
    chapterThemes: ['cascade', 'sélecteurs', 'spécificité', 'unités', 'couleurs', 'typographie', 'box model', 'display', 'positionnement', 'flexbox', 'grid', 'responsive', 'media queries', 'images', 'overflow', 'pseudo-classes', 'pseudo-éléments', 'variables', 'transitions', 'animations', 'accessibilité visuelle', 'architecture CSS', 'composants', 'debug layout', 'performance CSS', 'design system', 'landing responsive', 'capstone'],
    capstone: 'Créer un mini design system responsive et l’utiliser dans un site réel.', exitCriteria: commonExitCriteria,
  },
  {
    courseId: 'javascript-foundations', targetActivities: 650, targetChapters: 32,
    chapterThemes: ['valeurs et types', 'variables', 'opérateurs', 'conditions', 'boucles', 'fonctions', 'scope', 'tableaux', 'objets', 'méthodes', 'chaînes', 'destructuring', 'spread/rest', 'erreurs', 'debug', 'DOM', 'événements', 'formulaires', 'modules', 'JSON', 'fetch', 'promesses', 'async/await', 'stockage local', 'dates', 'tests de base', 'qualité', 'refactor', 'algorithmes débutants', 'projet UI', 'projet API', 'capstone'],
    capstone: 'Construire une application interactive consommant une API, testée et débogable.', exitCriteria: commonExitCriteria,
  },
  {
    courseId: 'python-foundations', targetActivities: 620, targetChapters: 30,
    chapterThemes: ['syntaxe', 'variables', 'types', 'conditions', 'boucles', 'fonctions', 'scope', 'listes', 'tuples', 'dictionnaires', 'sets', 'chaînes', 'compréhensions', 'erreurs', 'exceptions', 'fichiers', 'modules', 'packages', 'environnements', 'dates', 'JSON', 'HTTP', 'classes', 'tests', 'debug', 'qualité', 'algorithmes', 'CLI', 'automatisation', 'capstone'],
    capstone: 'Créer un outil Python en ligne de commande structuré, testé et documenté.', exitCriteria: commonExitCriteria,
  },
  {
    courseId: 'sql-foundations', targetActivities: 540, targetChapters: 26,
    chapterThemes: ['modèle relationnel', 'tables', 'types', 'SELECT', 'WHERE', 'ORDER BY', 'LIMIT', 'INSERT', 'UPDATE', 'DELETE', 'NULL', 'fonctions', 'agrégations', 'GROUP BY', 'HAVING', 'jointures', 'sous-requêtes', 'relations', 'contraintes', 'index', 'transactions', 'normalisation', 'debug requêtes', 'performance débutant', 'modélisation projet', 'capstone'],
    capstone: 'Modéliser une application réelle puis écrire et optimiser ses requêtes essentielles.', exitCriteria: commonExitCriteria,
  },
  {
    courseId: 'git-github-foundations', targetActivities: 510, targetChapters: 24,
    chapterThemes: ['modèle Git', 'repository', 'status', 'add', 'commit', 'historique', 'diff', 'branches', 'merge', 'conflits', 'restore', 'reset', 'revert', 'remote', 'push/pull', 'GitHub', 'issues', 'pull requests', 'review', 'rebase débutant', 'tags/releases', 'workflows équipe', 'sécurité secrets', 'capstone'],
    capstone: 'Gérer un projet complet avec branches, PR, revue et résolution de conflits.', exitCriteria: commonExitCriteria,
  },
  {
    courseId: 'node-api-foundations', targetActivities: 640, targetChapters: 30,
    chapterThemes: ['Node runtime', 'npm', 'modules', 'filesystem', 'HTTP', 'serveur', 'routing', 'REST', 'JSON', 'validation', 'erreurs', 'middlewares', 'configuration', 'env', 'logs', 'auth concepts', 'sécurité', 'rate limiting', 'CORS', 'base de données', 'CRUD', 'tests', 'mocks', 'documentation API', 'performance', 'health checks', 'déploiement', 'monitoring', 'API project', 'capstone'],
    capstone: 'Construire, tester, documenter et déployer une API REST avec persistance.', exitCriteria: commonExitCriteria,
  },
  {
    courseId: 'bot-foundations', targetActivities: 520, targetChapters: 24,
    chapterThemes: ['événements', 'updates/messages', 'commandes', 'router', 'état', 'sessions', 'permissions', 'configuration', 'secrets', 'erreurs', 'logs', 'rate limits', 'queues', 'webhooks', 'polling', 'fichiers média', 'internationalisation', 'modération', 'tests', 'simulation événements', 'déploiement', 'monitoring', 'architecture multi-bot', 'capstone'],
    capstone: 'Créer un moteur de bot robuste réutilisable sur plusieurs plateformes.', exitCriteria: commonExitCriteria,
  },
  {
    courseId: 'telegram-bots', targetActivities: 540, targetChapters: 25,
    chapterThemes: ['BotFather et token', 'updates', 'messages', 'commandes', 'claviers', 'callbacks', 'formatage', 'médias', 'fichiers', 'groupes', 'admins', 'permissions', 'sessions', 'inline mode', 'webhooks', 'polling', 'rate limits', 'erreurs API', 'sécurité', 'paiements concepts', 'tests', 'déploiement', 'monitoring', 'assistant groupe', 'capstone'],
    capstone: 'Construire un bot Telegram de groupe robuste avec état, permissions et monitoring.', exitCriteria: commonExitCriteria,
  },
  {
    courseId: 'discord-bots', targetActivities: 540, targetChapters: 25,
    chapterThemes: ['application Discord', 'token', 'intents', 'events', 'slash commands', 'interactions', 'embeds', 'components', 'permissions', 'roles', 'channels', 'guilds', 'modération', 'state', 'rate limits', 'errors', 'logging', 'security', 'voice concepts', 'webhooks', 'tests', 'deploy', 'monitoring', 'community bot', 'capstone'],
    capstone: 'Construire un bot Discord communautaire avec commandes, modération et observabilité.', exitCriteria: commonExitCriteria,
  },
  {
    courseId: 'whatsapp-bots', targetActivities: 560, targetChapters: 26,
    chapterThemes: ['architecture WhatsApp bot', 'connexion', 'sessions', 'messages', 'types média', 'commandes', 'groupes', 'participants', 'permissions', 'mentions', 'réactions', 'quoting', 'état', 'fichiers', 'reconnexion', 'rate limits', 'anti-spam', 'erreurs', 'logs', 'sécurité sessions', 'tests', 'simulation', 'déploiement', 'monitoring', 'utility bot', 'capstone'],
    capstone: 'Construire un bot WhatsApp utilitaire stable avec reconnexion, permissions et monitoring.', exitCriteria: commonExitCriteria,
  },
];

export function blueprintForCourse(courseId: string) {
  return courseBlueprints.find((item) => item.courseId === courseId);
}

export function plannedActivityTarget() {
  return courseBlueprints.reduce((sum, item) => sum + item.targetActivities, 0);
}
