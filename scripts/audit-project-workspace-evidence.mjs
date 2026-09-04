import fs from 'node:fs';

const engine = fs.readFileSync(new URL('../src/learning/projectProgressEngine.ts', import.meta.url), 'utf8');
const evidence = fs.readFileSync(new URL('../src/learning/projectWorkspaceEvidence.ts', import.meta.url), 'utf8');

function expect(source, pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}

function expectIncludes(source, snippets, message) {
  if (!snippets.every((snippet) => source.includes(snippet))) throw new Error(message);
}

expect(engine, /import \{ hasProjectWorkspaceEvidence \} from '\.\/projectWorkspaceEvidence';/, 'Project progression must use the shared workspace-evidence boundary.');
expect(engine, /newlyCompletedSteps\s*>\s*0\s*&&\s*!hasProjectWorkspaceEvidence\([\s\S]*?state\.projectDrafts\[registeredProject\.id\][\s\S]*?nextSteps[\s\S]*?\)\) return state;/, 'New project steps must fail closed when the workspace lacks enough real code delta.');
expect(engine, /if \(!hasProjectWorkspaceEvidence\(project, state\.projectDrafts\[project\.id\], finalStepCount\)\) return state;/, 'Portfolio rewards must re-check final workspace evidence instead of trusting stored progress alone.');
expect(evidence, /const MIN_CHANGED_CHARS_PER_STEP\s*=\s*24/, 'Workspace evidence must grow with every claimed construction step.');
expect(evidence, /projectStarterFiles\(project: GuidedProject\)/, 'Workspace evidence must compare against the canonical project starter shape.');
expectIncludes(
  evidence,
  [
    ".replace(/<!--[\\s\\S]*?-->/g, '')",
    ".replace(/\\/\\*[\\s\\S]*?\\*\\//g, '')",
    ".filter((line) => !/^\\s*(?:\\/\\/|#|--)(?:\\s|$)/.test(line))",
  ],
  'Workspace evidence must strip comment-only filler before measuring meaningful work.',
);
expect(evidence, /\.replace\(\/\\s\+\/g, ''\)/, 'Whitespace-only formatting must not inflate project evidence.');
expect(evidence, /function hasRequiredStarterFiles\([\s\S]*Object\.keys\(starter\)\.every\([\s\S]*canonicalText\(files\[filename\]\)\.trim\(\)\.length > 0/, 'Required starter files must remain present and non-empty before edits can count as project evidence.');
expect(evidence, /if \(!hasRequiredStarterFiles\(starter, draft\.files\)\) return 0;/, 'Deleting or emptying a starter file must fail closed instead of increasing the evidence score.');
expect(evidence, /const NON_CODE_EVIDENCE_EXTENSIONS = new Set\(\['md', 'markdown', 'txt', 'rst'\]\)/, 'Coding projects must identify documentation-only file extensions explicitly.');
expect(evidence, /function isConstructionEvidenceFile\(filename: string, starter: Record<string, string>\)/, 'Workspace evidence must distinguish source construction from documentation edits.');
expect(evidence, /return !Object\.keys\(starter\)\.some\([\s\S]*!NON_CODE_EVIDENCE_EXTENSIONS\.has\(starterExtension\)/, 'Documentation may only count when the project has no source-code starter files.');
expect(evidence, /if \(!content\.trim\(\) \|\| !isConstructionEvidenceFile\(filename, starter\)\) continue;/, 'Documentation-only edits must not unlock coding project milestones.');
expect(evidence, /function addedFileConstructionEvidence\([\s\S]*const meaningfulContent = meaningfulEvidenceText\(content\);[\s\S]*if \(!meaningfulContent\) return 0;/, 'Added-file evidence must ignore empty or filler-only content.');
expect(evidence, /const noveltyAgainstClosestStarter = Math\.min\([\s\S]*Object\.values\(starter\)\.map\(\(starterContent\) => changedCharacterEvidence\(starterContent, content\)\)/, 'Added files must be scored against the closest starter so near-copies only earn their genuinely new delta.');
expect(evidence, /Math\.min\(ADDED_FILE_EVIDENCE_CHARS, meaningfulContent\.length, noveltyAgainstClosestStarter\)/, 'Added-file evidence must be capped by both meaningful length and novelty versus starter code.');
expect(evidence, /const left = meaningfulEvidenceText\(before\);[\s\S]*const right = meaningfulEvidenceText\(after\);[\s\S]*if \(left === right\) return 0;/, 'Starter edits must be compared after filler normalization so comments and formatting alone earn no evidence.');
expect(evidence, /while \(prefix < shared && left\[prefix\] === right\[prefix\]\) prefix \+= 1;/, 'Workspace evidence must preserve a shared prefix instead of treating an insertion as edits to every shifted character.');
expect(evidence, /const maxSuffix = Math\.min\(leftRemaining, rightRemaining\);[\s\S]*suffix < maxSuffix[\s\S]*left\[left\.length - 1 - suffix\] === right\[right\.length - 1 - suffix\]/, 'Workspace evidence must preserve a shared suffix so localized edits remain localized.');
expect(evidence, /const added = right\.length - prefix - suffix;[\s\S]*return Math\.max\(0, added\);/, 'Evidence must count meaningful learner additions without rewarding destructive starter-code deletion.');
expect(evidence, /score \+= addedFileConstructionEvidence\(starter, content\);/, 'New files must pass through novelty-aware construction evidence scoring.');
expect(evidence, /changedCharacterEvidence\(starter\[filename\][\s\S]*content\)/, 'Starter edits must pass through the bounded edit-span evidence calculation.');
expect(evidence, /if \(!Number\.isInteger\(targetCompletedSteps\) \|\| targetCompletedSteps <= 0\) return false;/, 'Invalid target step counts must fail closed.');
expect(evidence, /targetCompletedSteps \* MIN_CHANGED_CHARS_PER_STEP/, 'Later project milestones must require progressively stronger workspace evidence.');
expect(evidence, /draft\.missionId && draft\.missionId !== `project:\$\{project\.id\}`/, 'A draft bound to another mission must never satisfy project evidence.');
expect(evidence, /for \(const \[filename, rawContent\] of Object\.entries\(draft\.files\)\)/, 'Evidence must be earned from files that still exist in the learner workspace.');
expect(evidence, /return score;\s*}\s*\n\s*export function hasProjectWorkspaceEvidence/, 'Missing canonical files must never receive deletion credit after evidence scoring.');

console.log('Project workspace evidence audit passed.');
