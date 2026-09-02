import fs from 'node:fs';

const session = fs.readFileSync('src/learning/labSession.ts', 'utf8');

const required = [
  'previewRuntimeFeedback',
  "['log','info','warn','error']",
  "window.addEventListener('error'",
  "window.addEventListener('unhandledrejection'",
  "node.textContent=lines.join('\\\\n')",
  "node.setAttribute('aria-live','polite')",
  'MAX_LINES=6',
  'MAX_CHARS=1800',
];

const missing = required.filter((needle) => !session.includes(needle));
if (missing.length) {
  console.error(`Lab runtime feedback audit failed: missing ${missing.join(', ')}`);
  process.exit(1);
}

if (!session.includes('previewRuntimeFeedback,\n    styleTag')) {
  console.error('Lab runtime feedback audit failed: runtime bridge must execute before learner preview styles/scripts.');
  process.exit(1);
}

if (session.includes('innerHTML=lines') || session.includes('innerHTML = lines')) {
  console.error('Lab runtime feedback audit failed: learner console output must render through textContent, never innerHTML.');
  process.exit(1);
}

console.log('Lab runtime feedback audit passed.');
