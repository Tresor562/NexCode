export type Course = {
  id: string;
  title: string;
  language: string;
  level: 'Débutant' | 'Intermédiaire';
  lessons: number;
  offlineSizeMb: number;
  description: string;
  color: string;
};

export const courses: Course[] = [
  {
    id: 'html-foundations',
    title: 'HTML Foundations',
    language: 'HTML',
    level: 'Débutant',
    lessons: 18,
    offlineSizeMb: 12,
    description: 'Structure une vraie page Web et prépare ton premier site.',
    color: '#FF7A59',
  },
  {
    id: 'css-foundations',
    title: 'CSS Foundations',
    language: 'CSS',
    level: 'Débutant',
    lessons: 22,
    offlineSizeMb: 16,
    description: 'Styles, mise en page, responsive et composants visuels.',
    color: '#4A8CFF',
  },
  {
    id: 'javascript-foundations',
    title: 'JavaScript Foundations',
    language: 'JavaScript',
    level: 'Débutant',
    lessons: 28,
    offlineSizeMb: 24,
    description: 'Variables, conditions, boucles, fonctions et logique.',
    color: '#F7D046',
  },
  {
    id: 'python-foundations',
    title: 'Python Foundations',
    language: 'Python',
    level: 'Débutant',
    lessons: 20,
    offlineSizeMb: 20,
    description: 'Syntaxe Python, logique et petits scripts sans IA.',
    color: '#55B887',
  },
  {
    id: 'sql-foundations',
    title: 'SQL Foundations',
    language: 'SQL',
    level: 'Débutant',
    lessons: 16,
    offlineSizeMb: 14,
    description: 'Tables, SELECT, filtres, tris et premières relations.',
    color: '#9A78FF',
  },
];

export const guidedProjects = [
  { id: 'portfolio', title: 'Mon premier portfolio', progress: 65, tech: 'HTML • CSS • JS' },
  { id: 'todo', title: 'ToDo App', progress: 20, tech: 'JavaScript' },
  { id: 'python-quiz', title: 'Quiz console Python', progress: 0, tech: 'Python' },
  { id: 'sql-library', title: 'Base de données Bibliothèque', progress: 0, tech: 'SQL' },
];

export const practiceTemplates = {
  JavaScript: 'const greet = (name) => `Bonjour ${name}`;\n\nconsole.log(greet("NexCode"));',
  Python: 'def greet(name):\n    return f"Bonjour {name}"\n\nprint(greet("NexCode"))',
  SQL: 'SELECT title, author\nFROM books\nWHERE published = 1\nORDER BY title;',
};
