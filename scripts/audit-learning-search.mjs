import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const source = fs.readFileSync(path.join(root, 'src/learning/learningNavigator.ts'), 'utf8');

function requirePattern(pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}

requirePattern(/normalize\('NFKD'\)/, 'Learning search must use compatibility-aware normalization so equivalent text forms rank consistently.');
requirePattern(/\.replace\(\/\\s\+\/g, ' '\)[\s\S]*\.trim\(\)/, 'Learning search normalization must collapse incidental whitespace so phrase ranking stays stable across pasted or spaced queries.');
requirePattern(/const PROGRAMMING_IDENTITY_ALIASES = new Map\(\[[\s\S]*\['js', 'javascript'\][\s\S]*\['ts', 'typescript'\][\s\S]*\]\);/, 'Common programming-language aliases such as JS and TS must canonicalize to their full language identities.');
requirePattern(/function canonicalSearchToken\([\s\S]*PROGRAMMING_IDENTITY_ALIASES\.get\(token\) \?\? token/, 'Learning search tokens must pass through the programming-language alias canonicalizer.');
requirePattern(/function tokenizeSearch\([\s\S]*new Set\([\s\S]*split\(\/\[\^\\p\{L\}\\p\{N\}\+#\._-\]\+\/u\)[\s\S]*canonicalSearchToken\(token\.trim\(\)\)[\s\S]*filter\(Boolean\)/, 'Learning search must tokenize natural multi-term queries, preserve programming tokens, canonicalize aliases, and deduplicate repeated intent terms.');

const identitySetMatch = source.match(/const PROGRAMMING_IDENTITY_TERMS = new Set\(\[([\s\S]*?)\]\);/);
if (!identitySetMatch) {
  throw new Error('Programming language identities must be explicitly protected from substring collisions.');
}
const identitySetSource = identitySetMatch[1];
for (const identity of ['java', 'javascript', 'c++', 'c#', 'go', 'r', 'rust', 'typescript']) {
  if (!identitySetSource.includes(`'${identity}'`)) {
    throw new Error(`Programming language identity ${identity} must be protected from substring collisions.`);
  }
}

requirePattern(/function fieldMatchesTerm\([\s\S]*PROGRAMMING_IDENTITY_TERMS\.has\(term\)[\s\S]*tokenizeSearch\(value\)\.includes\(term\)/, 'Protected programming language identities must match canonical whole tokens rather than arbitrary substrings.');
requirePattern(/normalizedFields\.some\(\(field\) => fieldMatchesTerm\(field\.value, term\)\)/, 'All-term learning search gating must use language-aware identity matching.');
requirePattern(/if \(fieldMatchesTerm\(field\.value, term\)\) bestWeight = Math\.max\(bestWeight, field\.weight\);/, 'Weighted relevance scoring must use the same language-aware identity matching as search gating.');
requirePattern(/const terms = tokenizeSearch\(query\);[\s\S]*const phrase = terms\.join\(' '\);/, 'Phrase ranking must be derived from canonical unique query terms instead of raw whitespace or repeated words.');
requirePattern(/\{ value: lesson\.title, weight: 60 \}[\s\S]*\{ value: lesson\.concept, weight: 45 \}[\s\S]*\{ value: \(lesson\.skillIds \?\? \[\]\)\.join\(' '\), weight: 40 \}/, 'Lesson title, concept and skills must outrank broad course metadata in learning search relevance.');
requirePattern(/if \(phrase && normalizedFields\[0\]\?\.value\.includes\(phrase\)\) score \+= 80;/, 'Exact lesson-title phrases must receive a strong relevance bonus.');
requirePattern(/const completed = new Set\(completedLessonIds\);[\s\S]*completed\.has\(lesson\.id\)/, 'Large learning paths must avoid repeatedly scanning the completed lesson array during search.');
requirePattern(/const lessonsById = new Map\(course\.starterLessons\.map\(\(lesson\) => \[lesson\.id, lesson\]\)\);[\s\S]*lessonsById\.get\(lessonId\)/, 'Learning traversal must index lessons once per course instead of repeatedly scanning the starter lesson collection.');
requirePattern(/const lessonOrder = curriculumOrder\+\+;[\s\S]*curriculumOrder: lessonOrder/, 'Learning recommendations must retain authored curriculum position for deterministic pedagogical tie-breaking.');
requirePattern(/\.sort\(\(a, b\) => b\.score - a\.score \|\| a\.curriculumOrder - b\.curriculumOrder\)/, 'Equal-priority recommendations must preserve authored curriculum order instead of falling back to alphabetical lesson titles.');
requirePattern(/\.map\(\(\{ curriculumOrder: _curriculumOrder, \.\.\.result \}\) => result\)/, 'Internal curriculum ordering metadata must not leak through the public learning search result contract.');
requirePattern(/const completedSet = new Set\(completedLessonIds\);[\s\S]*completedSet\.has\(lesson\.id\)[\s\S]*completedSet\.has\(id\)/, 'Course navigation summaries must also use constant-time completion membership checks.');
requirePattern(/function reviewIsDue\([\s\S]*if \(!nextReviewAt\) return true;/, 'Existing mastery without a scheduled nextReviewAt must stay reviewable instead of disappearing from the due-review path.');
requirePattern(/const state = mastery\[skillId\];[\s\S]*return state \? reviewIsDue\(state\.nextReviewAt, now\) : false;/, 'Due-review search must distinguish existing mastery with no schedule from completely unseen skills.');
requirePattern(/const MAX_REVIEW_URGENCY_BONUS = 35;/, 'Review urgency must be capped so overdue material cannot permanently starve new learning.');
requirePattern(/function reviewUrgencyBonus\([\s\S]*if \(nextReviewMs > nowMs\) return 0;/, 'Review urgency must ignore reviews that are still scheduled in the future.');
requirePattern(/const overdueDays = Math\.max\(0, Math\.floor\(\(nowMs - nextReviewMs\) \/ DAY_MS\)\);/, 'Review urgency must derive from a bounded non-negative overdue age.');
requirePattern(/return Math\.min\(MAX_REVIEW_URGENCY_BONUS,\s*12 \+ Math\.floor\(Math\.log2\(overdueDays \+ 1\) \* 6\)\);/, 'Review urgency must grow sublinearly and be capped in the returned score regardless of lexical operand order.');
requirePattern(/const dueStates = skillStates\.filter\(\(state\) => reviewIsDue\(state\.nextReviewAt, now\)\);[\s\S]*Math\.max\(\.\.\.dueStates\.map\(\(state\) => reviewUrgencyBonus\(state\.nextReviewAt, now\)\)\)/, 'Recommendation priority must derive urgency only from skills that are actually due and use the most urgent due skill.');
requirePattern(/function boundedMasteryScore\([\s\S]*Number\.isFinite\(value\)[\s\S]*Math\.max\(0, Math\.min\(100, value\)\)/, 'Recommendation priority must bound malformed mastery scores before they influence ranking.');
requirePattern(/const RECOMMENDATION_PREREQUISITE_GATE = 55;[\s\S]*const MAX_PREREQUISITE_PENALTY = 90;/, 'Prerequisite readiness must use an explicit mastery gate and a bounded penalty so blocked material is deprioritized without disappearing.');
requirePattern(/function prerequisiteReadinessPenalty\([\s\S]*new Set\(lesson\.prerequisiteSkillIds \?\? \[\]\)[\s\S]*if \(!state\)[\s\S]*penalty \+= 40;[\s\S]*score < RECOMMENDATION_PREREQUISITE_GATE[\s\S]*Math\.min\(MAX_PREREQUISITE_PENALTY, penalty\)/, 'Default recommendations must penalize missing or under-mastered prerequisites, deduplicate prerequisite ids, and cap the penalty.');
requirePattern(/function learningPriorityScore\([\s\S]*if \(!completed\.has\(lesson\.id\)\) score \+= 45;[\s\S]*if \(dueReview\) score \+= 70 \+ reviewUrgency;[\s\S]*score -= prerequisiteReadinessPenalty\(lesson, mastery\);/, 'Default learning recommendations must combine due-review urgency with prerequisite readiness instead of surfacing advanced blocked activities too early.');
requirePattern(/const score = terms\.length[\s\S]*\? searchScore[\s\S]*: learningPriorityScore\(lesson, completed, mastery, now\);/, 'Pedagogical recommendation priority, including prerequisite penalties, must apply only when the learner is not performing an explicit text search.');

console.log('Learning search audit OK: canonical intent, programming-language isolation, weighted search, scalable indexed traversal, due-review semantics, bounded overdue urgency, prerequisite-aware readiness, mastery-safe recommendation ranking, and authored-order tie-breaking are protected.');
