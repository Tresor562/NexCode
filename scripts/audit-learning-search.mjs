import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const source = fs.readFileSync(path.join(root, 'src/learning/learningNavigator.ts'), 'utf8');

function requirePattern(pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}

requirePattern(
  /normalize\('NFKD'\)/,
  'Learning search must use compatibility-aware normalization so equivalent text forms rank consistently.',
);
requirePattern(
  /\.replace\(\/\\s\+\/g, ' '\)[\s\S]*\.trim\(\)/,
  'Learning search normalization must collapse incidental whitespace so phrase ranking stays stable across pasted or spaced queries.',
);
requirePattern(
  /function tokenizeSearch\([\s\S]*new Set\([\s\S]*split\(\/\[\^\\p\{L\}\\p\{N\}\+#\._-\]\+\/u\)[\s\S]*filter\(Boolean\)/,
  'Learning search must tokenize natural multi-term queries, preserve programming tokens, and deduplicate repeated intent terms.',
);
requirePattern(
  /const terms = tokenizeSearch\(query\);[\s\S]*const phrase = terms\.join\(' '\);/,
  'Phrase ranking must be derived from canonical unique query terms instead of raw whitespace or repeated words.',
);
requirePattern(
  /if \(!terms\.every\(\(term\) => combined\.includes\(term\)\)\) return 0;/,
  'Every search term must be represented somewhere in the learning activity context instead of matching only one token.',
);
requirePattern(
  /\{ value: lesson\.title, weight: 60 \}[\s\S]*\{ value: lesson\.concept, weight: 45 \}[\s\S]*\{ value: \(lesson\.skillIds \?\? \[\]\)\.join\(' '\), weight: 40 \}/,
  'Lesson title, concept and skills must outrank broad course metadata in learning search relevance.',
);
requirePattern(
  /if \(phrase && normalizedFields\[0\]\?\.value\.includes\(phrase\)\) score \+= 80;/,
  'Exact lesson-title phrases must receive a strong relevance bonus.',
);
requirePattern(
  /const completed = new Set\(completedLessonIds\);[\s\S]*completed\.has\(lesson\.id\)/,
  'Large learning paths must avoid repeatedly scanning the completed lesson array during search.',
);
requirePattern(
  /const completedSet = new Set\(completedLessonIds\);[\s\S]*completedSet\.has\(lesson\.id\)[\s\S]*completedSet\.has\(id\)/,
  'Course navigation summaries must also use constant-time completion membership checks.',
);
requirePattern(
  /function reviewIsDue\([\s\S]*if \(!nextReviewAt\) return true;/,
  'Existing mastery without a scheduled nextReviewAt must stay reviewable instead of disappearing from the due-review path.',
);
requirePattern(
  /const state = mastery\[skillId\];[\s\S]*return state \? reviewIsDue\(state\.nextReviewAt, now\) : false;/,
  'Due-review search must distinguish existing mastery with no schedule from completely unseen skills.',
);

console.log('Learning search audit OK: canonical multi-term intent, stable phrase ranking, weighted pedagogy fields, compatibility normalization, scalable completion lookup, and due-review mastery semantics are protected.');
