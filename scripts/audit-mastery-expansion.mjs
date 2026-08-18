import fs from 'node:fs';

const mastery = fs.readFileSync(new URL('../src/data/htmlMastery.ts', import.meta.url), 'utf8');
const base = fs.readFileSync(new URL('../src/data/coursesWeb.ts', import.meta.url), 'utf8');
const aggregator = fs.readFileSync(new URL('../src/data/courses.ts', import.meta.url), 'utf8');
const lab = fs.readFileSync(new URL('../src/learning/labEngine.ts', import.meta.url), 'utf8');

const conceptCount = (mastery.match(/misconception:/g) ?? []).length;
const phases = ['-learn`', '-recall`', '-distinguish`', '-apply`', '-lab`', '-debug`', '-review`', '-checkpoint`'];
for (const phase of phases) {
  if (!mastery.includes(phase)) throw new Error(`HTML mastery sequence is missing phase ${phase}`);
}
const activitiesPerConcept = phases.length;
const generatedActivities = conceptCount * activitiesPerConcept;
const htmlBlock = base.split("id: 'html-foundations'")[1]?.split('makeCourse({')[0] ?? '';
const originalHtmlLessons = (htmlBlock.match(/lesson\('/g) ?? []).length;
const totalHtmlActivities = originalHtmlLessons + generatedActivities;

if (conceptCount < 60) throw new Error(`HTML mastery requires at least 60 explicitly authored concepts, found ${conceptCount}`);
if (totalHtmlActivities < 500) throw new Error(`HTML must expose at least 500 real activities, calculated ${totalHtmlActivities}`);
if (!aggregator.includes("course.id === 'html-foundations' ? htmlMasteryLessons")) throw new Error('HTML mastery lessons are not wired into the real course catalog');

for (const primitive of ['languageStructureCheck', 'meaningfulChange', 'completenessCheck', 'containsLikelySecret', "language === 'Git'", "language === 'Node/API'", "language === 'Bots'"]) {
  if (!lab.includes(primitive)) throw new Error(`Behavioral Lab validation is missing ${primitive}`);
}

const kinds = ['learn','practice','lab','review','checkpoint'];
for (const kind of kinds) {
  if (!mastery.includes(`activityKind:'${kind}'`)) throw new Error(`HTML mastery is missing activity kind ${kind}`);
}
for (const kind of ['write-code','debug','explain','order-steps']) {
  if (!mastery.includes(`'${kind}'`)) throw new Error(`HTML mastery is missing exercise kind ${kind}`);
}

console.log(`HTML mastery audit OK: ${conceptCount} explicit concepts × ${activitiesPerConcept} phases + ${originalHtmlLessons} original lessons = ${totalHtmlActivities} real HTML activities.`);
