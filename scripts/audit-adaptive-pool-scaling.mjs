import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const source = fs.readFileSync(path.join(process.cwd(), 'src/learning/adaptivePractice.ts'), 'utf8');

if (!/const completed = new Set\(completedIds\);/.test(source)) {
  throw new Error('Adaptive practice must index completed lesson ids once before traversing the curriculum.');
}

if (!/completedIds: Set<string>[\s\S]*const completed = completedIds\.has\(lesson\.id\);/.test(source)) {
  throw new Error('Lesson scoring must use constant-time completion membership checks.');
}

if (/completedIds\.includes\(lesson\.id\)/.test(source)) {
  throw new Error('Adaptive pool construction must not rescan the completed lesson array for every lesson.');
}

if (!/scoreLesson\(course, lesson, mastery, completed, graphById, now\)/.test(source)) {
  throw new Error('The indexed completion set must be reused across adaptive lesson scoring.');
}

console.log('Adaptive pool scaling audit OK: completion membership is indexed once and reused across curriculum traversal.');
