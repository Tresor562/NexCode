import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/data/projects.ts', import.meta.url), 'utf8');

const premiumProjectIds = ['portfolio', 'landing-responsive', 'js-quiz-web', 'todo', 'expense-tracker'];

function blockFor(id) {
  const marker = `id: '${id}'`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Projet premium manquant: ${id}`);
  const next = source.indexOf("\n  {\n    id: '", start + marker.length);
  return source.slice(start, next < 0 ? source.length : next);
}

for (const id of premiumProjectIds) {
  const block = blockFor(id);
  const stepMatch = block.match(/steps:\s*\[([\s\S]*?)\],/);
  if (!stepMatch) throw new Error(`Étapes manquantes pour ${id}`);
  const steps = [...stepMatch[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
  if (steps.length < 12) throw new Error(`${id}: ${steps.length} étapes seulement, 12 minimum`);
  if (steps.some((step) => step.length < 35)) throw new Error(`${id}: une étape est trop vague pour servir de critère d’acceptation`);
}

const portfolio = blockFor('portfolio');
for (const signal of ['360 px', 'clavier', 'focus', 'recruteur', 'JavaScript utile']) {
  if (!portfolio.includes(signal)) throw new Error(`portfolio: signal qualité manquant: ${signal}`);
}

const landing = blockFor('landing-responsive');
for (const signal of ['CTA', 'preuve sociale', 'hover', 'focus', '360 px']) {
  if (!landing.includes(signal)) throw new Error(`landing-responsive: signal qualité manquant: ${signal}`);
}

const quiz = blockFor('js-quiz-web');
for (const signal of ['état central', 'double vote', 'progression accessible', 'score', 'clavier']) {
  if (!quiz.includes(signal)) throw new Error(`js-quiz-web: signal qualité manquant: ${signal}`);
}

const todo = blockFor('todo');
for (const signal of ['id stable', 'localStorage', 'JSON', 'corrompu', 'filtres']) {
  if (!todo.includes(signal)) throw new Error(`todo: signal qualité manquant: ${signal}`);
}

const expense = blockFor('expense-tracker');
for (const signal of ['NaN', 'Infinity', 'reduce', 'localStorage', 'malformées']) {
  if (!expense.includes(signal)) throw new Error(`expense-tracker: signal qualité manquant: ${signal}`);
}

if (/Commence ton projet ici|Lorem ipsum|TODO: remplir/i.test(source)) {
  throw new Error('Contenu placeholder détecté dans les briefs projets');
}

console.log('✓ Premium project briefs are specific, testable and portfolio-grade.');
