import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const aggregator = read('../src/data/courses.ts');
const webBase = read('../src/data/coursesWeb.ts');
const devBase = read('../src/data/coursesDev.ts');
const lab = read('../src/learning/labEngine.ts');
const factory = read('../src/data/masteryFactory.ts');

const configs = [
  { id:'web-internet-foundations', symbol:'webInternetMasteryLessons', source:read('../src/data/webInternetMastery.ts'), base:webBase, countConcepts:(source)=> (source.match(/\bmk\('/g) ?? []).length },
  { id:'html-foundations', symbol:'htmlMasteryLessons', source:read('../src/data/htmlMastery.ts'), base:webBase, countConcepts(source) { const bank=source.split('const concepts: HtmlConcept[] = [')[1]?.split('];\n\nfunction slug')[0] ?? ''; return (bank.match(/\{\s*id:'[^']+'/g) ?? []).length; } },
  { id:'css-foundations', symbol:'cssMasteryLessons', source:read('../src/data/cssMastery.ts'), base:webBase, countConcepts(source) { const bank=source.split('const seeds: MasteryConceptSeed[] = [')[1]?.split('];\n\nexport const cssMasteryLessons')[0] ?? ''; return (bank.match(/\{\s*id:'[^']+'/g) ?? []).length; } },
  { id:'javascript-foundations', symbol:'javascriptMasteryLessons', source:read('../src/data/javascriptMastery.ts'), base:webBase, countConcepts:(source)=> (source.match(/\bmk\('/g) ?? []).length },
  { id:'python-foundations', symbol:'pythonMasteryLessons', source:read('../src/data/pythonMastery.ts'), base:devBase, countConcepts:(source)=> (source.match(/\bs\('/g) ?? []).length },
  { id:'sql-foundations', symbol:'sqlMasteryLessons', source:read('../src/data/sqlMastery.ts'), base:devBase, countConcepts:(source)=> (source.match(/\bmk\('/g) ?? []).length },
  { id:'git-github-foundations', symbol:'gitMasteryLessons', source:read('../src/data/gitMastery.ts'), base:devBase, countConcepts:(source)=> (source.match(/\bmk\('/g) ?? []).length },
  { id:'node-api-foundations', symbol:'nodeApiMasteryLessons', source:read('../src/data/nodeApiMastery.ts'), base:devBase, countConcepts:(source)=> (source.match(/\bmk\('/g) ?? []).length },
];

const phases = ['learn', 'recall', 'distinguish', 'apply', 'lab', 'debug', 'review', 'checkpoint'];
for (const phase of phases) {
  if (!factory.includes(`-${phase}\``)) throw new Error(`Mastery factory is missing phase ${phase}`);
}
const activitiesPerConcept = phases.length;

function originalLessonCount(source, courseId) {
  const after = source.split(`id: '${courseId}'`)[1] ?? '';
  const block = after.split('makeCourse({')[0];
  return (block.match(/\blesson\('/g) ?? []).length;
}

let expandedTotalMinimum = 0;
for (const config of configs) {
  const concepts = config.countConcepts(config.source);
  const original = originalLessonCount(config.base, config.id);
  const total = original + concepts * activitiesPerConcept;
  expandedTotalMinimum += total;
  if (concepts < 62) throw new Error(`${config.id} needs at least 62 explicitly authored concepts for a 500+ path; found ${concepts}`);
  if (total < 500) throw new Error(`${config.id} exposes only ${total} calculated real activities`);
  if (!aggregator.includes(`courseId === '${config.id}'`) || !aggregator.includes(config.symbol)) {
    throw new Error(`${config.id} mastery bank is not wired into the real course catalog`);
  }
  if (!config.source.includes(config.symbol)) throw new Error(`${config.id} mastery export is missing`);
  console.log(`${config.id}: ${concepts} explicit concepts × ${activitiesPerConcept} mastery phases + ${original} base lessons = >=${total} real activities before integration additions`);
}

for (const primitive of [
  'languageStructureCheck','meaningfulChange','completenessCheck','containsLikelySecret',
  "language === 'HTML/CSS'","language === 'JavaScript'","language === 'Python'","language === 'SQL'",
  "language === 'Git'","language === 'Node/API'","language === 'Bots'",
]) {
  if (!lab.includes(primitive)) throw new Error(`Behavioral Lab validation is missing ${primitive}`);
}
for (const primitive of ['write-code','debug','explain','order-steps']) {
  if (!factory.includes(`'${primitive}'`)) throw new Error(`Mastery factory is missing exercise kind ${primitive}`);
}

console.log(`Deep mastery audit OK: ${configs.length} courses exceed 500 real activities, >=${expandedTotalMinimum} deep activities combined before integration additions.`);
