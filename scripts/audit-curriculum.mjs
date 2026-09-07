import fs from 'node:fs';

const files = [
  '../src/data/coursesWeb.ts',
  '../src/data/coursesDev.ts',
  '../src/data/coursesBots.ts',
];

const blueprintSource = fs.readFileSync(new URL('../src/learning/courseBlueprints.ts', import.meta.url), 'utf8');
const blueprintTargets = new Map();
for (const match of blueprintSource.matchAll(/courseId:\s*'([^']+)'\s*,\s*targetActivities:\s*(\d+)\s*,\s*targetChapters:\s*(\d+)/g)) {
  blueprintTargets.set(match[1], {
    activities: Number(match[2]),
    chapters: Number(match[3]),
  });
}

const courses = [];
for (const path of files) {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  let current = null;
  let waitingForCourseId = false;
  for (const line of source.split('\n')) {
    if (line.includes('makeCourse({')) {
      waitingForCourseId = true;
      current = null;
      continue;
    }
    if (waitingForCourseId) {
      const idMatch = line.match(/id: '([^']+)'/);
      if (idMatch) {
        current = { id: idMatch[1], lessons: 0, modules: new Map() };
        courses.push(current);
        waitingForCourseId = false;
      }
    }
    const lessonMatch = line.match(/lesson\('([^']+)',\s*'([^']+)'/);
    if (lessonMatch && current) {
      current.lessons += 1;
      const moduleName = lessonMatch[2];
      current.modules.set(moduleName, (current.modules.get(moduleName) ?? 0) + 1);
    }
  }
}

const PREMIUM_ACTIVITY_MIN = 160;
const PREMIUM_ACTIVITY_MAX = 220;
const PREMIUM_CHAPTER_MIN = 12;
const PREMIUM_CHAPTER_MAX = 20;
const problems = [];
let totalLessons = 0;
let totalBlueprintActivities = 0;

console.log('NexCode premium curriculum audit');
console.log('--------------------------------');
for (const course of courses) {
  const target = blueprintTargets.get(course.id);
  const authoredChapters = course.modules.size;
  totalLessons += course.lessons;

  if (!target) {
    problems.push(`${course.id}: blueprint premium manquant`);
    console.log(`${course.id}: ${course.lessons} authored lessons | ${authoredChapters} authored chapters | blueprint missing`);
    continue;
  }

  totalBlueprintActivities += target.activities;
  if (target.activities < PREMIUM_ACTIVITY_MIN || target.activities > PREMIUM_ACTIVITY_MAX) {
    problems.push(`${course.id}: cible ${target.activities} activités hors fenêtre premium ${PREMIUM_ACTIVITY_MIN}-${PREMIUM_ACTIVITY_MAX}`);
  }
  if (target.chapters < PREMIUM_CHAPTER_MIN || target.chapters > PREMIUM_CHAPTER_MAX) {
    problems.push(`${course.id}: cible ${target.chapters} chapitres hors fenêtre premium ${PREMIUM_CHAPTER_MIN}-${PREMIUM_CHAPTER_MAX}`);
  }

  const remaining = Math.max(0, target.activities - course.lessons);
  const surplus = Math.max(0, course.lessons - target.activities);
  const deltaLabel = surplus > 0 ? `${surplus} au-dessus de la cible` : `${remaining} restant(s) vers la cible`;
  console.log(`${course.id}: ${course.lessons}/${target.activities} activités | ${authoredChapters}/${target.chapters} chapitres | ${deltaLabel}`);
}

for (const courseId of blueprintTargets.keys()) {
  if (!courses.some((course) => course.id === courseId)) problems.push(`${courseId}: blueprint sans cours source correspondant`);
}

console.log('--------------------------------');
console.log(`${courses.length} cours | ${totalLessons} activités rédigées | ${totalBlueprintActivities} activités premium ciblées`);
console.log('Policy: profondeur ciblée, transfert réel, checkpoints et projets — aucun remplissage pour atteindre un quota artificiel.');

if (problems.length) {
  console.error('\nCurriculum audit failed:');
  problems.forEach((problem) => console.error(`- ${problem}`));
  process.exit(1);
}
