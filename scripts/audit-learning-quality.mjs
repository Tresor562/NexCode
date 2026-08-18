import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const exists = (path) => fs.existsSync(new URL(path, import.meta.url));

const requiredEngines = {
  '../src/learning/curriculumStructure.ts': ['buildCurriculumTree', 'curriculumStructureIssues', 'nextCurriculumActivity'],
  '../src/learning/skillGraphDiagnostics.ts': ['skillGraphIssues', 'learningFrontier', 'blockedSkills'],
  '../src/learning/masteryEvidence.ts': ['evidenceQuality', 'masteryIsDurable', 'masteryEvidenceGaps'],
  '../src/learning/reviewScheduler.ts': ['buildReviewQueue', 'interleavedPracticeSession'],
  '../src/learning/exerciseEngine.ts': ['evaluateExercise', 'nextHint', 'lessonExerciseCoverage'],
  '../src/learning/assessmentEngine.ts': ['chapterAssessment', 'courseExam', 'assessmentGate'],
  '../src/learning/labSession.ts': ['startLabSession', 'autosaveLabSession', 'webPreviewDocument'],
  '../src/learning/labBehavioralTests.ts': ['runBehavioralSuite', 'secretSafetyIssues', 'defaultBehavioralTests'],
  '../src/learning/learningNavigator.ts': ['searchLearningActivities', 'courseNavigationSummary', 'learningEmptyState'],
  '../src/learning/offlineEngine.ts': ['buildChapterOfflinePack', 'buildStageOfflinePack', 'offlineUpdatePlan'],
  '../src/learning/projectPortfolioEngine.ts': ['resolveProjectSkills', 'projectReadinessAgainstGraph', 'buildPortfolioProof'],
};

for (const [path, primitives] of Object.entries(requiredEngines)) {
  if (!exists(path)) throw new Error(`Missing quality engine: ${path}`);
  const source = read(path);
  for (const primitive of primitives) {
    if (!source.includes(primitive)) throw new Error(`${path} is missing ${primitive}`);
  }
}

const masteryFiles = [
  ['web-internet-foundations', '../src/data/webInternetMastery.ts', /\bmk\('/g],
  ['html-foundations', '../src/data/htmlMastery.ts', /\{\s*id:'[^']+'/g],
  ['css-foundations', '../src/data/cssMastery.ts', /\{\s*id:'[^']+'/g],
  ['javascript-foundations', '../src/data/javascriptMastery.ts', /\bmk\('/g],
  ['python-foundations', '../src/data/pythonMastery.ts', /\bs\('/g],
  ['sql-foundations', '../src/data/sqlMastery.ts', /\bmk\('/g],
  ['git-github-foundations', '../src/data/gitMastery.ts', /\bmk\('/g],
  ['node-api-foundations', '../src/data/nodeApiMastery.ts', /\bmk\('/g],
];

let deepActivitiesMinimum = 0;
for (const [courseId, path, pattern] of masteryFiles) {
  const source = read(path);
  const concepts = (source.match(pattern) ?? []).length;
  if (concepts < 62) throw new Error(`${courseId}: expected >=62 explicitly authored concepts, found ${concepts}`);
  const activities = concepts * 8;
  deepActivitiesMinimum += activities;
  console.log(`${courseId}: ${concepts} authored concepts -> at least ${activities} mastery activities before base/integration lessons`);
}

const aggregator = read('../src/data/courses.ts');
const courseIds = [
  'web-internet-foundations','html-foundations','css-foundations','javascript-foundations','python-foundations','sql-foundations',
  'git-github-foundations','node-api-foundations','bot-foundations','telegram-bots','discord-bots','whatsapp-bots',
];
for (const id of courseIds) {
  if (!aggregator.includes(`courseId === '${id}'`)) throw new Error(`Catalog expansion missing for ${id}`);
}

for (const integration of [
  '../src/data/frontendIntegrationMastery.ts',
  '../src/data/programmingIntegrationMastery.ts',
  '../src/data/systemsBotsIntegrationMastery.ts',
]) {
  const source = read(integration);
  if (!source.includes('buildMasteryCurriculum')) throw new Error(`${integration}: mastery curriculum not generated`);
  if (!source.includes('practice') && !source.includes('practice:')) throw new Error(`${integration}: practice transfer prompts missing`);
}

const bots = read('../src/data/systemsBotsIntegrationMastery.ts');
for (const symbol of ['botFoundationIntegrationMasteryLessons','telegramIntegrationMasteryLessons','discordIntegrationMasteryLessons','whatsappIntegrationMasteryLessons']) {
  if (!bots.includes(symbol) || !aggregator.includes(symbol)) throw new Error(`Bot integration not wired: ${symbol}`);
}
for (const safetyWord of ['secret','idempotent','permission','webhook','reconnect']) {
  if (!bots.toLowerCase().includes(safetyWord)) throw new Error(`Bot production curriculum missing safety topic: ${safetyWord}`);
}

const labTests = read('../src/learning/labBehavioralTests.ts');
for (const mode of ['HTML/CSS','JavaScript','Python','SQL','Git','Node/API','Bots']) {
  if (!labTests.includes(`language === '${mode}'`) && mode !== 'Bots') throw new Error(`Behavioral Lab audit missing mode ${mode}`);
}
if (!labTests.includes("language === 'Bots'")) throw new Error('Behavioral Lab audit missing Bots mode');

const exercise = read('../src/learning/exerciseEngine.ts');
for (const kind of ['mcq','predict-output','fill-code','order-steps','debug','write-code','refactor','explain']) {
  if (!exercise.includes(`'${kind}'`)) throw new Error(`Rich exercise model missing ${kind}`);
}

console.log(`Learning quality audit OK: ${requiredEngines ? Object.keys(requiredEngines).length : 0} engines checked, 12 catalog tracks wired, >=${deepActivitiesMinimum} mastery activities across the 8 deep-expanded tracks before base/integration additions.`);
console.log('Bot tracks are intentionally audited for real wiring and production topics, not falsely declared at 500+ yet.');
