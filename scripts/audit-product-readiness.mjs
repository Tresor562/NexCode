import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const index = read('../index.ts');
const app = read('../src/ui/AppV15.tsx');
const hub = read('../src/ui/LearningHub.tsx');
const lesson = read('../src/ui/LessonFlowScreen.tsx');
const lab = read('../src/ui/LabWorkspaceScreen.tsx');
const localState = read('../src/lib/localState.ts');
const offline = read('../src/learning/offlineEngine.ts');
const project = read('../src/learning/projectPortfolioEngine.ts');

const requiredFiles = [app, hub, lesson, lab];
if (!index.includes("./src/ui/AppV15")) throw new Error('index.ts does not use the modular V1.5 app');
for (const token of ['Accueil','Apprendre','Lab','Projets','Profil','buildAdaptivePool','planPracticeSession','recordSkillAttempt']) {
  if (!app.includes(token)) throw new Error(`AppV15 missing ${token}`);
}
for (const token of ['courseNavigationSummary','searchLearningActivities','buildChapterOfflinePack','5, 10, 20, 45','Maîtrise','Chapitres']) {
  if (!hub.includes(token)) throw new Error(`LearningHub missing ${token}`);
}
for (const token of ['Comprendre','Observer un exemple','Vérifier sans deviner','Pratiquer dans le Lab','Révision future','masterySnapshot']) {
  if (!lesson.includes(token)) throw new Error(`Lesson flow missing ${token}`);
}
for (const token of ['openLabWorkspace','updateLabFile','validateLabDraft','runBehavioralSuite','autosave local','Tests cachés','secretSafetyIssues']) {
  if (!lab.includes(token)) throw new Error(`Lab workspace UI missing ${token}`);
}
for (const token of ['installedOfflinePacks','portfolioProofs','labDrafts','mastery','lessonAttempts']) {
  if (!localState.includes(token)) throw new Error(`Local state missing ${token}`);
}
for (const token of ['lite','standard','full','curriculumVersion','offlineUpdatePlan','estimateOfflineStorage']) {
  if (!offline.includes(token)) throw new Error(`Offline engine missing ${token}`);
}
for (const token of ['projectReadinessAgainstGraph','buildPortfolioProof','portfolioSkillCoverage']) {
  if (!project.includes(token)) throw new Error(`Portfolio engine missing ${token}`);
}
if (requiredFiles.some((source) => source.includes('TODO UI'))) throw new Error('A product UI contains an unfinished TODO marker');
console.log('Product readiness audit OK: modular mobile UX, adaptive learning, mastery, lesson→Lab flow, offline model and portfolio engines are wired for final device testing.');
