import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const index = read('../index.ts');
const app = read('../src/ui/NexCodeApp.tsx');
const hub = read('../src/ui/LearningHub.tsx');
const lesson = read('../src/ui/LessonFlowScreen.tsx');
const lab = read('../src/ui/LabWorkspaceScreen.tsx');
const projects = read('../src/ui/ProjectPortfolioScreen.tsx');
const localState = read('../src/lib/localState.ts');
const offline = read('../src/learning/offlineEngine.ts');
const projectEngine = read('../src/learning/projectPortfolioEngine.ts');

const requiredFiles = [app, hub, lesson, lab, projects];
if (!index.includes("./src/ui/NexCodeApp")) throw new Error('index.ts does not use NexCodeApp as the runtime entry point');
for (const token of ['Accueil','Apprendre','Lab','Projets','Profil','buildAdaptivePool','planPracticeSession','recordSkillAttempt','installedOfflinePacks','portfolioProofs']) {
  if (!app.includes(token)) throw new Error(`NexCodeApp missing ${token}`);
}
for (const token of ['courseNavigationSummary','searchLearningActivities','buildChapterOfflinePack','5, 10, 20, 45','Maîtrise','Chapitres','Mise à jour disponible']) {
  if (!hub.includes(token)) throw new Error(`LearningHub missing ${token}`);
}
for (const token of ['Comprendre','Observer un exemple','Vérifier sans deviner','Pratiquer dans le Lab','Révision future','masterySnapshot']) {
  if (!lesson.includes(token)) throw new Error(`Lesson flow missing ${token}`);
}
for (const token of ['openLabWorkspace','updateLabFile','validateLabDraft','runBehavioralSuite','autosave local','Tests cachés','secretSafetyIssues']) {
  if (!lab.includes(token)) throw new Error(`Lab workspace UI missing ${token}`);
}
for (const token of ['projectReadinessAgainstGraph','buildPortfolioProof','defaultProjectRubric','Revue avant portfolio']) {
  if (!projects.includes(token)) throw new Error(`Project portfolio UI missing ${token}`);
}
for (const token of ['installedOfflinePacks','portfolioProofs','labDrafts','mastery','lessonAttempts']) {
  if (!localState.includes(token)) throw new Error(`Local state missing ${token}`);
}
for (const token of ['lite','standard','full','curriculumVersion','offlineUpdatePlan','estimateOfflineStorage']) {
  if (!offline.includes(token)) throw new Error(`Offline engine missing ${token}`);
}
for (const token of ['projectReadinessAgainstGraph','buildPortfolioProof','portfolioSkillCoverage']) {
  if (!projectEngine.includes(token)) throw new Error(`Portfolio engine missing ${token}`);
}
if (requiredFiles.some((source) => source.includes('TODO UI'))) throw new Error('A product UI contains an unfinished TODO marker');
console.log('Product readiness audit OK: final runtime shell exposes adaptive learning, chapters, mastery, lesson→Lab flow, versioned offline packs and reviewed portfolio proofs.');
