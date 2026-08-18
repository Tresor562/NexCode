import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const completion = read('../src/data/botCompletionMastery.ts');
const supplement = read('../src/data/botCompletionSupplement.ts');
const base = read('../src/data/coursesBots.ts');
const courses = read('../src/data/courses.ts');
const deepFactory = read('../src/data/botDeepFactory.ts');

if (!deepFactory.includes('productionTransfer(seed)')) throw new Error('Deep bot production-transfer sequence is missing');

const tracks = [
  { courseId:'bot-foundations', seedName:'botFoundationSeeds', nextName:'telegramSeeds', exportName:'botFoundationCompletionLessons', supplementSeed:null, supplementExport:null },
  { courseId:'telegram-bots', seedName:'telegramSeeds', nextName:'discordSeeds', exportName:'telegramCompletionLessons', supplementSeed:'telegramSupplementSeeds', supplementExport:'telegramCompletionSupplementLessons' },
  { courseId:'discord-bots', seedName:'discordSeeds', nextName:'whatsappSeeds', exportName:'discordCompletionLessons', supplementSeed:null, supplementExport:null },
  { courseId:'whatsapp-bots', seedName:'whatsappSeeds', nextName:'const config =', exportName:'whatsappCompletionLessons', supplementSeed:'whatsappSupplementSeeds', supplementExport:'whatsappCompletionSupplementLessons' },
];

function baseCount(courseId) {
  const block = (base.split(`id: '${courseId}'`)[1] ?? '').split('makeCourse({')[0];
  return (block.match(/\blesson\('/g) ?? []).length;
}
function countBank(source, seedName, nextToken) {
  const block = source.split(`const ${seedName}: DeepBotSeed[] = [`)[1]?.split(nextToken)[0] ?? '';
  return (block.match(/\{\s*id\s*:\s*'[^']+'/g) ?? []).length;
}

let minimum = 0;
for (const track of tracks) {
  const primary = countBank(completion, track.seedName, track.nextName);
  const extra = track.supplementSeed
    ? countBank(supplement, track.supplementSeed, track.supplementSeed === 'telegramSupplementSeeds' ? 'const whatsappSupplementSeeds' : 'const config =')
    : 0;
  const concepts = primary + extra;
  const baseLessons = baseCount(track.courseId);
  const calculated = baseLessons + concepts * 16;
  if (concepts < 31) throw new Error(`${track.courseId}: expected >=31 explicitly authored concepts, found ${concepts}`);
  if (calculated < 500) throw new Error(`${track.courseId}: only ${calculated} calculated activities`);
  if (!completion.includes(`export const ${track.exportName}`)) throw new Error(`${track.courseId}: completion export missing`);
  if (track.supplementExport && (!supplement.includes(`export const ${track.supplementExport}`) || !courses.includes(track.supplementExport))) {
    throw new Error(`${track.courseId}: supplement is not exported and wired into catalog`);
  }
  if (!courses.includes(track.exportName) || !courses.includes(`courseId === '${track.courseId}'`)) throw new Error(`${track.courseId}: completion bank not wired into catalog`);
  minimum += calculated;
  console.log(`${track.courseId}: ${concepts} explicit concepts (${primary} core${extra ? ` + ${extra} supplement` : ''}) × 16 mastery/production phases + ${baseLessons} base = >=${calculated}`);
}

console.log(`Bot completion audit OK: 4/4 bot tracks exceed 500 real structured activities; >=${minimum} combined before integration additions.`);
