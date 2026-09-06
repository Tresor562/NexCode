import { readFileSync } from 'node:fs';

const safetySource = readFileSync(new URL('../src/lib/workspaceSafety.ts', import.meta.url), 'utf8');
const behavioralSource = readFileSync(new URL('../src/learning/labBehavioralTests.ts', import.meta.url), 'utf8');

const requiredGuards = [
  {
    label: 'GitHub token signatures',
    needle: '/\\bgh[pousr]_[A-Za-z0-9]{20,}\\b/',
  },
  {
    label: 'Stripe live key signatures',
    needle: '/\\b(?:sk_live|rk_live)_[A-Za-z0-9]{16,}\\b/',
  },
  {
    label: 'Slack token signatures',
    needle: '/\\bxox[baprs]-[A-Za-z0-9-]{20,}\\b/',
  },
  {
    label: 'Telegram bot token signatures',
    needle: '/\\b\\d{6,12}:[A-Za-z0-9_-]{30,}\\b/',
  },
  {
    label: 'AWS access key signatures',
    needle: '/\\b(?:AKIA|ASIA)[A-Z0-9]{16}\\b/',
  },
  {
    label: 'Google API key signatures',
    needle: '/\\bAIza[0-9A-Za-z_-]{35}\\b/',
  },
];

for (const guard of requiredGuards) {
  if (!safetySource.includes(guard.needle)) {
    throw new Error(`Lab secret safety audit failed: missing ${guard.label}.`);
  }
}

if (!safetySource.includes('export function containsLikelyWorkspaceSecret')) {
  throw new Error('Lab secret safety audit failed: shared workspace secret guard is missing.');
}

if (!behavioralSource.includes("id: 'no-real-secret'")) {
  throw new Error('Lab secret safety audit failed: no-real-secret behavioral gate is missing.');
}

if (!behavioralSource.includes('containsLikelyWorkspaceSecret(content)')) {
  throw new Error('Lab secret safety audit failed: behavioral validation must reuse the shared workspace secret guard.');
}

if (!behavioralSource.includes('run: (draft) => secretSafetyIssues(draft).length === 0')) {
  throw new Error('Lab secret safety audit failed: secret scanner no longer blocks behavioral validation.');
}

if (!behavioralSource.includes('for (const [filename, content] of Object.entries(draft.files))')) {
  throw new Error('Lab secret safety audit failed: scanner must inspect every workspace file.');
}

console.log('Lab secret safety audit passed.');
