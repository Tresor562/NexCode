import fs from 'node:fs';

const courseSource = fs.readFileSync(new URL('../src/data/courses.ts', import.meta.url), 'utf8');
const required = ['html-foundations', 'css-foundations', 'javascript-foundations', 'python-foundations', 'sql-foundations'];

for (const id of required) {
  if (!courseSource.includes(`id: '${id}'`)) {
    throw new Error(`Missing required V1.5 course: ${id}`);
  }
}

const requiredLearningPrimitives = [
  'starterLessons',
  'guidedProjects',
  'practiceTemplates',
  "'HTML/CSS'",
  'correctIndex',
  'explanation',
];

for (const primitive of requiredLearningPrimitives) {
  if (!courseSource.includes(primitive)) {
    throw new Error(`Missing V1.5 learning primitive: ${primitive}`);
  }
}

const projectCount = (courseSource.match(/difficulty: '(Facile|Moyen)'/g) ?? []).length;
if (projectCount < 4) {
  throw new Error(`Expected at least 4 guided projects, found ${projectCount}`);
}

console.log(
  `NexCode content OK: ${required.length} foundation courses, interactive lesson primitives, Web/JS/Python/SQL practice and ${projectCount} guided projects.`,
);
