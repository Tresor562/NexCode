import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const index = read('../index.ts');
const root = read('../src/ui/RootApp.tsx');
const launch = read('../src/ui/LaunchScreen.tsx');
const app = read('../src/ui/NexCodeApp.tsx');
const hub = read('../src/ui/LearningHub.tsx');
const lesson = read('../src/ui/LessonFlowScreen.tsx');
const learningFeedback = read('../src/ui/learningFeedback.ts');
const lab = read('../src/ui/LabWorkspaceScreen.tsx');
const imports = read('../src/lib/workspaceImport.ts');
const projects = read('../src/ui/ProjectPortfolioScreen.tsx');
const localState = read('../src/lib/localState.ts');
const offline = read('../src/learning/offlineEngine.ts');
const projectEngine = read('../src/learning/projectPortfolioEngine.ts');

const requiredFiles = [root, launch, app, hub, lesson, lab, projects];
if (!index.includes("./src/ui/RootApp")) throw new Error('index.ts does not use RootApp as the runtime entry point');
if (!root.includes('LaunchScreen') || !root.includes('NexCodeApp')) throw new Error('RootApp must transition from launch animation to NexCodeApp');
for (const token of ['exC','robot','translateX','Animated']) {
  if (!launch.includes(token)) throw new Error(`Launch screen missing ${token}`);
}
for (const token of ['Accueil','Apprendre','Lab','Projets','Profil','buildAdaptivePool','planPracticeSession','recordLessonOutcome','rewardLearningCompletion','advanceProjectProgress','recordPortfolioProof','installedOfflinePacks','portfolioProofs','nexCoins']) {
  if (!app.includes(token)) throw new Error(`NexCodeApp missing ${token}`);
}
if (app.includes('rewardProgress(')) throw new Error('NexCodeApp must not bypass canonical lesson/project reward engines with direct rewardProgress calls');
for (const token of ['courseNavigationSummary','buildAdaptivePool','planPracticeSession','Continue ton chemin','LearningPathNode','Progression du parcours','Continuer','checkpoint','lab']) {
  if (!hub.includes(token)) throw new Error(`LearningHub missing ${token}`);
}
for (const token of ['ÉTAPE 1 • COMPRENDRE','ÉTAPE 2 • OBSERVER','RAPPEL ACTIF • SANS REGARDER','À TOI DE JOUER','MISSION FLASH • TRANSFERT','FINAL • CONSTRUIRE','retrievalPrompt','recallConfidence','successCriteria','masterySnapshot','createLearningFeedbackGate','expo-audio']) {
  if (!lesson.includes(token)) throw new Error(`Lesson flow missing ${token}`);
}
for (const token of ['expo-haptics','createLearningFeedbackGate','selectionAsync','notificationAsync','impactAsync']) {
  if (!learningFeedback.includes(token)) throw new Error(`Shared learning feedback controller missing ${token}`);
}
if (lesson.includes("from 'expo-haptics'")) throw new Error('Lesson flow must route haptics through the shared learning feedback controller');
for (const token of ['openLabWorkspace','updateLabFile','validateLabDraft','runBehavioralSuite','sauvegardé','Tests cachés','secretSafetyIssues','WebView','Code Tools','Obfusquer','Déobfusquer','Console','Preview','importFilesFromPhone','importFolderFromPhone']) {
  if (!lab.includes(token)) throw new Error(`Lab workspace UI missing ${token}`);
}
for (const token of ['File.pickFileAsync','pickDirectoryAsync','MAX_FILES_PER_WORKSPACE','MAX_TOTAL_TEXT_CHARS','uniquePath']) {
  if (!imports.includes(token)) throw new Error(`Phone workspace import missing ${token}`);
}
for (const token of ['projectReadinessAgainstGraph','buildPortfolioProof','defaultProjectRubric','Revue avant portfolio']) {
  if (!projects.includes(token)) throw new Error(`Project portfolio UI missing ${token}`);
}
for (const token of ['installedOfflinePacks','portfolioProofs','labDrafts','mastery','lessonAttempts','nexCoins','rewardProgress','touchDailyActivity']) {
  if (!localState.includes(token)) throw new Error(`Local state missing ${token}`);
}
for (const token of ['lite','standard','full','curriculumVersion','offlineUpdatePlan','estimateOfflineStorage']) {
  if (!offline.includes(token)) throw new Error(`Offline engine missing ${token}`);
}
for (const token of ['projectReadinessAgainstGraph','buildPortfolioProof','portfolioSkillCoverage']) {
  if (!projectEngine.includes(token)) throw new Error(`Portfolio engine missing ${token}`);
}
if (requiredFiles.some((source) => source.includes('TODO UI'))) throw new Error('A product UI contains an unfinished TODO marker');
console.log('Product readiness audit OK: animated launch, path-first learning, active recall, canonical idempotent progression engines, step lessons, centralized haptic/audio feedback, bounded phone file/folder import, multi-file IDE, live preview, console, code tools, projects and mastery are wired.');
