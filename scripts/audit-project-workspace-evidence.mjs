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
expect(evidence, /function meaningfulEvidenceText\([\s\S]*replace\(\/<!--\[\\s\\S\]\*\?-->\/g, ''\)[\s\S]*replace\(\/\\\/\\\*\[\\s\\S\]\*\?\\\*\\\//g, ''\)[\s\S]*filter\(\(line\) => !\/\^\\s\*\(\?:\\\/\\\/\|#\|--\)/, 'Workspace evidence must strip comment-only filler before measuring meaningful work.');
expect(evidence, /\.replace\(\/\\s\+\/g, ''\)/, 'Whitespace-only formatting must not inflate project evidence.');
expect(evidence, /function hasRequiredStarterFiles\([\s\S]*Object\.keys\(starter\)\.every\([\s\S]*canonicalText\(files\[filename\]\)\.trim\(\)\.length > 0/, 'Required starter files must remain present and non-empty before edits can count as project evidence.');
expect(evidence, /if \(!hasRequiredStarterFiles\(starter, draft\.files\)\) return 0;/, 'Deleting or emptying a starter file must fail closed instead of increasing the evidence score.');
expect(evidence, /const left = meaningfulEvidenceText\(before\);[\s\S]*const right = meaningfulEvidenceText\(after\);[\s\S]*if \(left === right\) return 0;/, 'Starter edits must be compared after filler normalization so comments and formatting alone earn no evidence.');
expect(evidence, /while \(prefix < shared && left\[prefix\] === right\[prefix\]\) prefix \+= 1;/, 'Workspace evidence must preserve a shared prefix instead of treating an insertion as edits to every shifted character.');
expect(evidence, /const maxSuffix = Math\.min\(leftRemaining, rightRemaining\);[\s\S]*suffix < maxSuffix[\s\S]*left\[left\.length - 1 - suffix\] === right\[right\.length - 1 - suffix\]/, 'Workspace evidence must preserve a shared suffix so localized edits remain localized.');
expect(evidence, /const removed = left\.length - prefix - suffix;[\s\S]*const added = right\.length - prefix - suffix;[\s\S]*return Math\.max\(removed, added\);/, 'Evidence must count the localized edit span rather than positional shift noise.');
expect(evidence, /const meaningfulContent = meaningfulEvidenceText\(content\);[\s\S]*Math\.min\(ADDED_FILE_EVIDENCE_CHARS, meaningfulContent\.length\)/, 'Added files must earn evidence only from meaningful non-filler content.');
expect(evidence, /changedCharacterEvidence\(starter\[filename\][\s\S]*content\)/, 'Starter edits must pass through the bounded edit-span evidence calculation.');
expect(evidence, /if \(!Number\.isInteger\(targetCompletedSteps\) \|\| targetCompletedSteps <= 0\) return false;/, 'Invalid target step counts must fail closed.');
expect(evidence, /targetCompletedSteps \* MIN_CHANGED_CHARS_PER_STEP/, 'Later project milestones must require progressively stronger workspace evidence.');
expect(evidence, /draft\.missionId && draft\.missionId !== `project:\$\{project\.id\}`/, 'A draft bound to another mission must never satisfy project evidence.');
expect(evidence, /for \(const \[filename, rawContent\] of Object\.entries\(draft\.files\)\)/, 'Evidence must be earned from files that still exist in the learner workspace.');
expect(evidence, /return score;\s*}\s*\n\s*export function hasProjectWorkspaceEvidence/, 'Missing canonical files must never receive deletion credit after evidence scoring.');

console.log('Project workspace evidence audit passed.');
