import fs from 'node:fs';

const engine = fs.readFileSync(new URL('../src/learning/projectProgressEngine.ts', import.meta.url), 'utf8');
const evidence = fs.readFileSync(new URL('../src/learning/projectWorkspaceEvidence.ts', import.meta.url), 'utf8');

function expect(source, pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}

expect(engine, /import \{ hasProjectWorkspaceEvidence \} from '\.\/projectWorkspaceEvidence';/, 'Project progression must use the shared workspace-evidence boundary.');
expect(engine, /newlyCompletedSteps\s*>\s*0\s*&&\s*!hasProjectWorkspaceEvidence\([\s\S]*?state\.projectDrafts\[registeredProject\.id\][\s\S]*?nextSteps[\s\S]*?\)\) return state;/, 'New project steps must fail closed when the workspace lacks enough real code delta.');
expect(engine, /if \(!hasProjectWorkspaceEvidence\(project, state\.projectDrafts\[project\.id\], finalStepCount\)\) return state;/, 'Portfolio rewards must re-check final workspace evidence instead of trusting stored progress alone.');
expect(evidence, /const MIN_CHANGED_CHARS_PER_STEP\s*=\s*24/, 'Workspace evidence must grow with every claimed construction step.');
expect(evidence, /projectStarterFiles\(project: GuidedProject\)/, 'Workspace evidence must compare against the canonical project starter shape.');
expect(evidence, /changedCharacterEvidence\(starter\[filename\][\s\S]*content\)/, 'Untouched starter files must not count as construction evidence.');
expect(evidence, /if \(!Number\.isInteger\(targetCompletedSteps\) \|\| targetCompletedSteps <= 0\) return false;/, 'Invalid target step counts must fail closed.');
expect(evidence, /targetCompletedSteps \* MIN_CHANGED_CHARS_PER_STEP/, 'Later project milestones must require progressively stronger workspace evidence.');
expect(evidence, /draft\.missionId && draft\.missionId !== `project:\$\{project\.id\}`/, 'A draft bound to another mission must never satisfy project evidence.');

console.log('Project workspace evidence audit passed.');
