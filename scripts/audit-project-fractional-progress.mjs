import fs from 'node:fs';

const enginePath = new URL('../src/learning/projectProgressEngine.ts', import.meta.url);
const source = fs.readFileSync(enginePath, 'utf8');

const safePercentBody = source.match(/function safePercent\(value: unknown\): number \{([\s\S]*?)\n\}/)?.[1] ?? '';
if (!safePercentBody) {
  throw new Error('Could not isolate safePercent project progress normalization.');
}

if (!/Math\.floor\(value\)/.test(safePercentBody)) {
  throw new Error('Fractional project progress must floor before milestone accounting.');
}

if (/Math\.round\(value\)/.test(safePercentBody)) {
  throw new Error('Fractional project progress must never round up into an unearned construction milestone.');
}

if (!/Math\.max\(0,\s*Math\.min\(100,\s*Math\.floor\(value\)\)\)/.test(safePercentBody)) {
  throw new Error('Project progress normalization must remain bounded to the canonical 0–100 range after flooring.');
}

console.log('Fractional project progress audit passed.');
