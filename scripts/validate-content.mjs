import fs from 'node:fs';

const dataFiles = [
  '../src/data/coursesWeb.ts',
  '../src/data/coursesDev.ts',
  '../src/data/coursesBots.ts',
];

const curriculumSource = dataFiles
  .map((path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8'))
  .join('\n');
const aggregatorSource = fs.readFileSync(new URL('../src/data/courses.ts', import.meta.url), 'utf8');
const projectSource = fs.readFileSync(new URL('../src/data/projects.ts', import.meta.url), 'utf8');

const requiredCourses = [
  'web-internet-foundations',
  'html-foundations',
  'css-foundations',
  'javascript-foundations',
  'python-foundations',
  'sql-foundations',
  'git-github-foundations',
  'node-api-foundations',
  'bot-foundations',
  'telegram-bots',
  'discord-bots',
  'whatsapp-bots',
];

for (const id of requiredCourses) {
  if (!curriculumSource.includes(`id: '${id}'`)) {
    throw new Error(`Missing required NexCode course: ${id}`);
  }
}

const courseCount = (curriculumSource.match(/makeCourse\(\{/g) ?? []).length;
if (courseCount < requiredCourses.length) {
  throw new Error(`Expected at least ${requiredCourses.length} real courses, found ${courseCount}`);
}

const lessonIds = [...curriculumSource.matchAll(/lesson\('([^']+)'/g)].map((match) => match[1]);
if (lessonIds.length < 160) {
  throw new Error(`Expected at least 160 authored interactive lessons, found ${lessonIds.length}`);
}

const duplicateLessonIds = lessonIds.filter((id, index) => lessonIds.indexOf(id) !== index);
if (duplicateLessonIds.length) {
  throw new Error(`Duplicate lesson ids: ${[...new Set(duplicateLessonIds)].join(', ')}`);
}

const projectIds = [...projectSource.matchAll(/id: '([^']+)'/g)].map((match) => match[1]);
if (projectIds.length < 18) {
  throw new Error(`Expected at least 18 guided projects, found ${projectIds.length}`);
}

const duplicateProjectIds = projectIds.filter((id, index) => projectIds.indexOf(id) !== index);
if (duplicateProjectIds.length) {
  throw new Error(`Duplicate guided project ids: ${[...new Set(duplicateProjectIds)].join(', ')}`);
}

for (const requiredPrimitive of ["'HTML/CSS'", 'JavaScript', 'Python', 'SQL']) {
  if (!aggregatorSource.includes(requiredPrimitive)) {
    throw new Error(`Missing Lab practice primitive: ${requiredPrimitive}`);
  }
}

for (const botProject of ['telegram-revision-bot', 'discord-community-bot', 'whatsapp-utility-bot']) {
  if (!projectSource.includes(`id: '${botProject}'`)) {
    throw new Error(`Missing guided bot project: ${botProject}`);
  }
}

console.log(
  `NexCode curriculum OK: ${courseCount} real courses, ${lessonIds.length} authored interactive lessons and ${projectIds.length} guided projects.`,
);
