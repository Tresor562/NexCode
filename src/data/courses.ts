export type Lesson = {
  id: string;
  title: string;
  durationMin: number;
  concept: string;
  example: string;
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
};

export type Course = {
  id: string;
  title: string;
  language: string;
  level: 'Débutant' | 'Intermédiaire';
  lessons: number;
  offlineSizeMb: number;
  estimatedHours: number;
  description: string;
  color: string;
  icon: string;
  starterLessons: Lesson[];
};

export type GuidedProject = {
  id: string;
  title: string;
  tech: string;
  description: string;
  difficulty: 'Facile' | 'Moyen';
  estimatedMinutes: number;
  steps: string[];
};

export const courses: Course[] = [
  {
    id: 'html-foundations',
    title: 'HTML Foundations',
    language: 'HTML',
    level: 'Débutant',
    lessons: 18,
    offlineSizeMb: 12,
    estimatedHours: 3,
    description: 'Structure une vraie page Web et prépare ton premier site.',
    color: '#FF8668',
    icon: '<>',
    starterLessons: [
      {
        id: 'html-structure',
        title: 'La structure d’une page',
        durationMin: 7,
        concept: 'HTML décrit la structure d’une page. Les balises indiquent au navigateur ce que représente chaque partie du contenu.',
        example: '<h1>Mon premier site</h1>\n<p>Bienvenue sur NexCode.</p>',
        question: 'Quelle balise représente un grand titre principal ?',
        choices: ['<p>', '<h1>', '<div>'],
        correctIndex: 1,
        explanation: '<h1> représente le titre principal le plus important de la page.',
      },
      {
        id: 'html-links',
        title: 'Créer un lien',
        durationMin: 6,
        concept: 'La balise <a> crée un lien. Son attribut href indique la destination.',
        example: '<a href="https://example.com">Visiter le site</a>',
        question: 'Quel attribut contient l’adresse de destination ?',
        choices: ['src', 'href', 'class'],
        correctIndex: 1,
        explanation: 'href signifie hypertext reference : c’est la destination du lien.',
      },
    ],
  },
  {
    id: 'css-foundations',
    title: 'CSS Foundations',
    language: 'CSS',
    level: 'Débutant',
    lessons: 22,
    offlineSizeMb: 16,
    estimatedHours: 4,
    description: 'Styles, mise en page, responsive et composants visuels.',
    color: '#58A0FF',
    icon: '#',
    starterLessons: [
      {
        id: 'css-selectors',
        title: 'Sélectionner un élément',
        durationMin: 7,
        concept: 'Un sélecteur CSS indique quel élément doit recevoir un style.',
        example: 'h1 {\n  color: royalblue;\n}',
        question: 'Que cible le sélecteur h1 ?',
        choices: ['Tous les paragraphes', 'Tous les titres h1', 'Toute la page'],
        correctIndex: 1,
        explanation: 'Le sélecteur h1 applique les règles à tous les éléments <h1>.',
      },
    ],
  },
  {
    id: 'javascript-foundations',
    title: 'JavaScript Foundations',
    language: 'JavaScript',
    level: 'Débutant',
    lessons: 28,
    offlineSizeMb: 24,
    estimatedHours: 6,
    description: 'Variables, conditions, boucles, fonctions et logique.',
    color: '#FFD45E',
    icon: 'JS',
    starterLessons: [
      {
        id: 'js-variables',
        title: 'Variables et valeurs',
        durationMin: 8,
        concept: 'Une variable garde une valeur pour pouvoir la réutiliser. const convient lorsque la référence ne doit pas être réassignée.',
        example: 'const name = "NexCode";\nconsole.log(name);',
        question: 'Quel mot-clé convient à une valeur qu’on ne souhaite pas réassigner ?',
        choices: ['const', 'print', 'return'],
        correctIndex: 0,
        explanation: 'const déclare une liaison qui ne peut pas être réassignée.',
      },
      {
        id: 'js-functions',
        title: 'Créer une fonction',
        durationMin: 10,
        concept: 'Une fonction regroupe une logique réutilisable. Elle peut recevoir des paramètres et retourner une valeur.',
        example: 'function greet(name) {\n  return `Bonjour ${name}`;\n}',
        question: 'Quel mot-clé renvoie une valeur depuis une fonction ?',
        choices: ['send', 'return', 'yielding'],
        correctIndex: 1,
        explanation: 'return arrête la fonction et renvoie la valeur indiquée.',
      },
    ],
  },
  {
    id: 'python-foundations',
    title: 'Python Foundations',
    language: 'Python',
    level: 'Débutant',
    lessons: 20,
    offlineSizeMb: 20,
    estimatedHours: 5,
    description: 'Syntaxe Python, logique et petits scripts sans IA.',
    color: '#5AD39A',
    icon: 'Py',
    starterLessons: [
      {
        id: 'python-functions',
        title: 'Fonctions Python',
        durationMin: 9,
        concept: 'Python utilise def pour créer une fonction. L’indentation fait partie de la syntaxe.',
        example: 'def greet(name):\n    return f"Bonjour {name}"',
        question: 'Quel mot-clé commence une fonction Python ?',
        choices: ['func', 'def', 'function'],
        correctIndex: 1,
        explanation: 'En Python, une fonction commence avec le mot-clé def.',
      },
    ],
  },
  {
    id: 'sql-foundations',
    title: 'SQL Foundations',
    language: 'SQL',
    level: 'Débutant',
    lessons: 16,
    offlineSizeMb: 14,
    estimatedHours: 4,
    description: 'Tables, SELECT, filtres, tris et premières relations.',
    color: '#A982FF',
    icon: 'DB',
    starterLessons: [
      {
        id: 'sql-select',
        title: 'Lire des données avec SELECT',
        durationMin: 8,
        concept: 'SELECT choisit les colonnes à lire et FROM indique la table source.',
        example: 'SELECT title, author\nFROM books;',
        question: 'Quel mot-clé indique la table source ?',
        choices: ['TABLE', 'FROM', 'WHERE'],
        correctIndex: 1,
        explanation: 'FROM précise la table dans laquelle SQL doit lire les données.',
      },
    ],
  },
];

export const guidedProjects: GuidedProject[] = [
  {
    id: 'portfolio',
    title: 'Mon premier portfolio',
    tech: 'HTML • CSS • JS',
    description: 'Construis une page personnelle responsive avec présentation, projets et contact.',
    difficulty: 'Facile',
    estimatedMinutes: 90,
    steps: ['Créer la structure HTML', 'Créer une identité visuelle', 'Rendre la page responsive', 'Ajouter une interaction JavaScript', 'Faire la revue finale'],
  },
  {
    id: 'todo',
    title: 'ToDo App',
    tech: 'JavaScript',
    description: 'Crée une petite application de tâches et pratique les événements et le DOM.',
    difficulty: 'Moyen',
    estimatedMinutes: 120,
    steps: ['Créer la liste', 'Ajouter une tâche', 'Marquer comme terminée', 'Supprimer une tâche', 'Polir l’expérience'],
  },
  {
    id: 'python-quiz',
    title: 'Quiz console Python',
    tech: 'Python',
    description: 'Utilise variables, conditions et fonctions dans un mini quiz.',
    difficulty: 'Facile',
    estimatedMinutes: 75,
    steps: ['Définir les questions', 'Lire une réponse', 'Vérifier la réponse', 'Calculer le score', 'Afficher le résultat'],
  },
  {
    id: 'sql-library',
    title: 'Base Bibliothèque',
    tech: 'SQL',
    description: 'Modélise une petite bibliothèque puis interroge les livres et auteurs.',
    difficulty: 'Moyen',
    estimatedMinutes: 100,
    steps: ['Créer le modèle', 'Ajouter des livres', 'Écrire les SELECT', 'Filtrer les résultats', 'Créer une relation auteur-livre'],
  },
];

export const practiceTemplates = {
  JavaScript: 'const greet = (name) => `Bonjour ${name}`;\n\nconsole.log(greet("NexCode"));',
  Python: 'def greet(name):\n    return f"Bonjour {name}"\n\nprint(greet("NexCode"))',
  SQL: 'SELECT title, author\nFROM books\nWHERE published = 1\nORDER BY title;',
};
