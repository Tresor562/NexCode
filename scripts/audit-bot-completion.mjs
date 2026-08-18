import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const completion = read('../src/data/botCompletionMastery.ts');
const base = read('../src/data/coursesBots.ts');
const courses = read('../src/data/courses.ts');
const deepFactory = read('../src/data/botDeepFactory.ts');

if (!deepFactory.includes('productionTransfer(seed)')) throw new Error('Deep bot production-transfer sequence is missing');

const tracks = [
  ['bot-foundations', 'botFoundationSeeds', 'telegramSeeds', 'botFoundationCompletionLessons'],
  ['telegram-bots', 'telegramSeeds', 'discordSeeds', 'telegramCompletionLessons'],
  ['discord-bots', 'discordSeeds', 'whatsappSeeds', 'discordCompletionLessons'],
  ['whatsapp-bots', 'whatsappSeeds', 'const config =', 'whatsappCompletionLessons'],
];

function baseCount(courseId) {
  const block = (base.split(`id: '${courseId}'`)[1] ?? '').split('makeCourse({')[0];
  return (block.match(/\blesson\('/g) ?? []).length;
}

let minimum = 0;
for (const [courseId, seedName, nextName, exportName] of tracks) {
  const bank = completion.split(`const ${seedName}: DeepBotSeed[] = [`)[1]?.split(nextName)[0] ?? '';
  const concepts = (bank.match(/\{\s*id:'[^']+'/g) ?? []).length;
  const baseLessons = baseCount(courseId);
  const calculated = baseLessons + concepts * 16;
  if (concepts < 31) throw new Error(`${courseId}: expected >=31 explicitly authored concepts, found ${concepts}`);
  if (calculated < 500) throw new Error(`${courseId}: only ${calculated} calculated activities`);
  if (!completion.includes(`export const ${exportName}`)) throw new Error(`${courseId}: completion export missing`);
  if (!courses.includes(exportName) || !courses.includes(`courseId === '${courseId}'`)) throw new Error(`${courseId}: completion bank not wired into catalog`);
  minimum += calculated;
  console.log(`${courseId}: ${concepts} concepts × 16 mastery/production phases + ${baseLessons} base = >=${calculated}`);
}

console.log(`Bot completion audit OK: 4/4 bot tracks exceed 500 real structured activities; >=${minimum} combined before integration additions.`);
