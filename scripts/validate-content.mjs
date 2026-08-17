import fs from 'node:fs';

const courseSource = fs.readFileSync(new URL('../src/data/courses.ts', import.meta.url), 'utf8');
const required = ['html-foundations', 'css-foundations', 'javascript-foundations', 'python-foundations', 'sql-foundations'];

for (const id of required) {
  if (!courseSource.includes(`id: '${id}'`)) {
    throw new Error(`Missing required V1.5 course: ${id}`);
  }
}

if (!courseSource.includes('guidedProjects')) {
  throw new Error('Guided projects catalog is missing');
}

console.log(`NexCode content OK: ${required.length} foundation courses + guided projects.`);
