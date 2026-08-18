import fs from 'node:fs';

const files = [
  '../src/data/coursesWeb.ts',
  '../src/data/coursesDev.ts',
  '../src/data/coursesBots.ts',
];

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

const target = 500;
let totalLessons = 0;
let totalChapters = 0;
let totalUnits = 0;

console.log('NexCode curriculum depth audit');
console.log('--------------------------------');
for (const course of courses) {
  const chapters = course.modules.size;
  const units = [...course.modules.values()].reduce((sum, count) => sum + Math.ceil(count / 5), 0);
  const gap = Math.max(0, target - course.lessons);
  totalLessons += course.lessons;
  totalChapters += chapters;
  totalUnits += units;
  console.log(`${course.id}: ${course.lessons} lessons | ${chapters} chapters | ${units} units | gap to 500: ${gap}`);
}
console.log('--------------------------------');
console.log(`${courses.length} courses | ${totalChapters} chapters | ${totalUnits} units | ${totalLessons} authored lessons`);
console.log(`Target for 500+ each: ${courses.length * target}+ activities; current authored gap: ${courses.length * target - totalLessons}`);
