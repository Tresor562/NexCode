import fs from 'node:fs';

const dataFiles = ['../src/data/coursesWeb.ts', '../src/data/coursesDev.ts', '../src/data/coursesBots.ts'];
const curriculumSources = dataFiles.map((path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
const curriculumSource = curriculumSources.join('\n');
const aggregatorSource = fs.readFileSync(new URL('../src/data/courses.ts', import.meta.url), 'utf8');
const projectSource = fs.readFileSync(new URL('../src/data/projects.ts', import.meta.url), 'utf8');
const coreSource = fs.readFileSync(new URL('../src/data/curriculumCore.ts', import.meta.url), 'utf8');
const masterySource = fs.readFileSync(new URL('../src/learning/skillGraph.ts', import.meta.url), 'utf8');
const practiceSource = fs.readFileSync(new URL('../src/learning/practiceEngine.ts', import.meta.url), 'utf8');
const catalogSource = fs.readFileSync(new URL('../src/learning/catalog.ts', import.meta.url), 'utf8');
const labSource = fs.readFileSync(new URL('../src/learning/labEngine.ts', import.meta.url), 'utf8');
const pedagogySource = fs.readFileSync(new URL('../src/learning/pedagogy.ts', import.meta.url), 'utf8');
const localStateSource = fs.readFileSync(new URL('../src/lib/localState.ts', import.meta.url), 'utf8');

const requiredCourses = [
  'web-internet-foundations', 'html-foundations', 'css-foundations', 'javascript-foundations',
  'python-foundations', 'sql-foundations', 'git-github-foundations', 'node-api-foundations',
  'bot-foundations', 'telegram-bots', 'discord-bots', 'whatsapp-bots',
];
for (const id of requiredCourses) {
  if (!curriculumSource.includes(`id: '${id}'`)) throw new Error(`Missing required NexCode course: ${id}`);
}

const courseCount = (curriculumSource.match(/makeCourse\(\{/g) ?? []).length;
if (courseCount < requiredCourses.length) throw new Error(`Expected at least ${requiredCourses.length} real courses, found ${courseCount}`);

const lessonIds = [...curriculumSource.matchAll(/lesson\('([^']+)'/g)].map((match) => match[1]);
if (lessonIds.length < 160) throw new Error(`Expected at least 160 authored interactive lessons, found ${lessonIds.length}`);
const duplicateLessonIds = lessonIds.filter((id, index) => lessonIds.indexOf(id) !== index);
if (duplicateLessonIds.length) throw new Error(`Duplicate lesson ids: ${[...new Set(duplicateLessonIds)].join(', ')}`);

const modules = [...curriculumSource.matchAll(/lesson\('[^']+',\s*'([^']+)'/g)].map((match) => match[1]);
const uniqueModules = new Set(modules);
if (uniqueModules.size < 25) throw new Error(`Curriculum is too flat: expected at least 25 authored modules, found ${uniqueModules.size}`);

const chapterBuckets = new Map();
for (const source of curriculumSources) {
  let currentCourseId = null;
  let waitingForCourseId = false;
  for (const line of source.split('\n')) {
    if (line.includes('makeCourse({')) { waitingForCourseId = true; continue; }
    if (waitingForCourseId) {
      const courseMatch = line.match(/id: '([^']+)'/);
      if (courseMatch) { currentCourseId = courseMatch[1]; waitingForCourseId = false; }
    }
    const lessonMatch = line.match(/lesson\('([^']+)',\s*'([^']+)'/);
    if (lessonMatch && currentCourseId) {
      const key = `${currentCourseId}::${lessonMatch[2]}`;
      chapterBuckets.set(key, (chapterBuckets.get(key) ?? 0) + 1);
    }
  }
}
const chapterCount = chapterBuckets.size;
const unitCount = [...chapterBuckets.values()].reduce((sum, lessonCount) => sum + Math.ceil(lessonCount / 5), 0);
if (chapterCount < 25) throw new Error(`Expected at least 25 course chapters, found ${chapterCount}`);
const emptyChapters = [...chapterBuckets.entries()].filter(([, count]) => count < 1);
if (emptyChapters.length) throw new Error(`Empty curriculum chapters: ${emptyChapters.map(([id]) => id).join(', ')}`);

const projectIds = [...projectSource.matchAll(/id: '([^']+)'/g)].map((match) => match[1]);
if (projectIds.length < 18) throw new Error(`Expected at least 18 guided projects, found ${projectIds.length}`);
const duplicateProjectIds = projectIds.filter((id, index) => projectIds.indexOf(id) !== index);
if (duplicateProjectIds.length) throw new Error(`Duplicate guided project ids: ${[...new Set(duplicateProjectIds)].join(', ')}`);
const projectSkillLists = (projectSource.match(/skills:\s*\[/g) ?? []).length;
if (projectSkillLists < projectIds.length) throw new Error(`Every guided project must declare skills: ${projectSkillLists}/${projectIds.length}`);

for (const requiredPrimitive of ["'HTML/CSS'", 'JavaScript', 'Python', 'SQL']) {
  if (!aggregatorSource.includes(requiredPrimitive)) throw new Error(`Missing Lab practice primitive: ${requiredPrimitive}`);
}
for (const botProject of ['telegram-revision-bot', 'discord-community-bot', 'whatsapp-utility-bot']) {
  if (!projectSource.includes(`id: '${botProject}'`)) throw new Error(`Missing guided bot project: ${botProject}`);
}
for (const primitive of [
  'Chapter', 'LearningUnit', 'CourseStage', 'ExerciseSpec', 'ExerciseKind', 'skillIds', 'prerequisiteSkillIds',
  'LabMission', 'buildChapters', 'buildStages', 'activityCycle', 'checkpointLessonIds', 'masteryGate',
]) {
  if (!coreSource.includes(primitive)) throw new Error(`Missing structured curriculum primitive: ${primitive}`);
}
for (const kind of ["'learn'", "'practice'", "'lab'", "'review'", "'checkpoint'", "'boss'"]) {
  if (!coreSource.includes(kind)) throw new Error(`Missing activity kind in curriculum sequencing: ${kind}`);
}
for (const primitive of [
  'SkillMastery', 'confidence', 'consecutiveCorrect', 'nextReviewAt', 'errorTags', 'evidence',
  'recordSkillAttempt', 'prerequisitesReady', 'skillNeedsEvidence', 'weakSkillIds',
]) {
  if (!masterySource.includes(primitive)) throw new Error(`Missing mastery primitive: ${primitive}`);
}
for (const primitive of [
  'due-review', 'weak-skill', 'repair-misconception', 'new-skill', 'lab-transfer', 'checkpoint',
  'recommendPractice', 'interleaving', 'nextSessionPlan',
]) {
  if (!practiceSource.includes(primitive)) throw new Error(`Missing practice engine primitive: ${primitive}`);
}
for (const primitive of ['searchCourses', 'chapterProgress', 'offlineChapterSizeMb', 'curriculumMetrics']) {
  if (!catalogSource.includes(primitive)) throw new Error(`Missing scalable catalog primitive: ${primitive}`);
}
for (const primitive of [
  'missionForLesson', 'openLabWorkspace', 'updateLabFile', 'addLabFile', 'removeLabFile',
  'validateLabDraft', 'stampLabValidation', 'starterFiles',
]) {
  if (!labSource.includes(primitive)) throw new Error(`Missing lesson-linked Lab primitive: ${primitive}`);
}
for (const primitive of ['labDrafts', 'downloadedChapters', 'lessonAttempts', 'lessonErrorTags', 'normalizeMastery']) {
  if (!localStateSource.includes(primitive)) throw new Error(`Missing persisted learning-state primitive: ${primitive}`);
}
for (const primitive of [
  'targetActivitiesPerCourse: 500', "kind: 'lab'", "kind: 'review'", "kind: 'checkpoint'", "kind: 'boss'", 'masteryGate',
]) {
  if (!pedagogySource.includes(primitive)) throw new Error(`Missing deep-course pedagogy primitive: ${primitive}`);
}

console.log(
  `NexCode curriculum OK: ${courseCount} courses, ${chapterCount} chapters, ${unitCount} units, ${uniqueModules.size} unique module names, ${lessonIds.length} authored lessons, ${projectIds.length} guided projects + staged curriculum, evidence-based mastery, adaptive practice, multi-file Lab and 500-activity depth policy.`,
);
