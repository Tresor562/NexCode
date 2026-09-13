import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const source = fs.readFileSync(path.join(root, 'src/learning/learningNavigator.ts'), 'utf8');

function requirePattern(pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}

requirePattern(/const MAX_COMPLETION_ID_CHARS = 160;/, 'Learning completion ids must have a bounded restored-input length.');
requirePattern(/function completedLessonSet\([\s\S]*typeof rawId !== 'string'[\s\S]*rawId\.trim\(\)[\s\S]*lessonId\.length > MAX_COMPLETION_ID_CHARS[\s\S]*\\u0000-\\u001f\\u007f[\s\S]*completed\.add\(lessonId\)/, 'Restored completion ids must be trimmed, bounded, reject control characters, and deduplicate through a Set.');
requirePattern(/searchLearningActivities\([\s\S]*const completed = completedLessonSet\(completedLessonIds\);/, 'Learning recommendations must sanitize completion ids before applying completion ranking or filters.');
requirePattern(/courseNavigationSummary\([\s\S]*const completedSet = completedLessonSet\(completedLessonIds\);/, 'Course progress summaries must use the same sanitized completion identity boundary as recommendations.');

console.log('Learning completion input audit OK: restored/synced lesson ids are canonicalized before recommendation and progress calculations.');
