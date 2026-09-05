import type { GuidedProject } from '../data/curriculumCore';
import type { LabDraft } from '../lib/localState';

const MIN_CHANGED_CHARS_PER_STEP = 24;
const ADDED_FILE_EVIDENCE_CHARS = 48;
const NON_CODE_EVIDENCE_EXTENSIONS = new Set(['md', 'markdown', 'txt', 'rst']);
const HASH_COMMENT_EVIDENCE_EXTENSIONS = new Set(['py', 'rb', 'sh', 'bash', 'zsh', 'yml', 'yaml', 'toml', 'ini', 'cfg', 'conf']);

function canonicalText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\r\n/g, '\n') : '';
}

function meaningfulEvidenceText(value: unknown, filename = ''): string {
  const extension = filename.trim().toLowerCase().split('.').pop() ?? '';
  return canonicalText(value)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => {
      if (/^\s*\/\/(?:\s|$)/.test(line)) return false;
      if (extension === 'sql' && /^\s*--(?:\s|$)/.test(line)) return false;
      if (HASH_COMMENT_EVIDENCE_EXTENSIONS.has(extension) && /^\s*#(?:\s|$)/.test(line)) return false;
      return true;
    })
    .join('\n')
    .replace(/\s+/g, '');
}

function projectStarterFiles(project: GuidedProject): Record<string, string> {
  const tech = `${project.tech} ${project.track}`.toLowerCase();
  if (tech.includes('html') || tech.includes('css') || tech.includes('web')) return {
    'index.html': `<!doctype html>\n<html lang="fr">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1" />\n  <title>${project.title}</title>\n  <link rel="stylesheet" href="style.css" />\n</head>\n<body>\n  <main id="app">\n    <h1>${project.title}</h1>\n    <p>Commence ton projet ici.</p>\n  </main>\n  <script src="script.js"></script>\n</body>\n</html>`,
    'style.css': 'body {\n  font-family: system-ui, sans-serif;\n  margin: 0;\n  padding: 24px;\n  background: #0b1020;\n  color: #f7f8ff;\n}\n',
    'script.js': "const app = document.querySelector('#app');\nconsole.log('NexCode project ready', app);\n",
  };
  if (tech.includes('python')) return { 'main.py': `# ${project.title}\n\ndef main():\n    print("NexCode project ready")\n\nif __name__ == "__main__":\n    main()\n` };
  if (tech.includes('sql') || tech.includes('donnée')) return {
    'schema.sql': '-- Définis les tables du projet\nCREATE TABLE example (\n  id INTEGER PRIMARY KEY,\n  name TEXT NOT NULL\n);\n',
    'queries.sql': '-- Écris tes requêtes ici\nSELECT * FROM example;\n',
  };
  if (tech.includes('node') || tech.includes('api') || tech.includes('bot') || tech.includes('javascript')) return {
    'index.js': `// ${project.title}\nfunction main() {\n  console.log('NexCode project ready');\n}\n\nmain();\n`,
    'README.md': `# ${project.title}\n\n${project.description}\n`,
  };
  return { 'main.txt': `${project.title}\n\n${project.description}\n` };
}

function hasRequiredStarterFiles(starter: Record<string, string>, files: Record<string, unknown>): boolean {
  return Object.keys(starter).every((filename) => canonicalText(files[filename]).trim().length > 0);
}

function isConstructionEvidenceFile(filename: string, starter: Record<string, string>): boolean {
  const normalized = filename.trim().toLowerCase();
  const extension = normalized.includes('.') ? normalized.split('.').pop() ?? '' : '';
  if (!NON_CODE_EVIDENCE_EXTENSIONS.has(extension)) return true;

  // Documentation is useful, but it must not unlock coding milestones for a
  // workspace that already contains executable/source starter files. Pure-text
  // fallback projects remain scoreable so non-code curricula are not blocked.
  return !Object.keys(starter).some((starterFilename) => {
    const starterExtension = starterFilename.toLowerCase().split('.').pop() ?? '';
    return !NON_CODE_EVIDENCE_EXTENSIONS.has(starterExtension);
  });
}

function changedCharacterEvidence(before: string, after: string, filename: string): number {
  const left = meaningfulEvidenceText(before, filename);
  const right = meaningfulEvidenceText(after, filename);
  if (left === right) return 0;

  let prefix = 0;
  const shared = Math.min(left.length, right.length);
  while (prefix < shared && left[prefix] === right[prefix]) prefix += 1;

  let suffix = 0;
  const leftRemaining = left.length - prefix;
  const rightRemaining = right.length - prefix;
  const maxSuffix = Math.min(leftRemaining, rightRemaining);
  while (
    suffix < maxSuffix
    && left[left.length - 1 - suffix] === right[right.length - 1 - suffix]
  ) suffix += 1;

  const added = right.length - prefix - suffix;
  // Deleting starter code is not construction evidence. Replacements still earn
  // credit for the meaningful content actually introduced by the learner.
  return Math.max(0, added);
}

function addedFileConstructionEvidence(starter: Record<string, string>, filename: string, content: string): number {
  const meaningfulContent = meaningfulEvidenceText(content, filename);
  if (!meaningfulContent) return 0;

  // A copied starter with one token appended must only earn credit for that new
  // token, not for the copied body. Use the closest canonical starter as the
  // novelty ceiling for newly added files.
  const noveltyAgainstClosestStarter = Math.min(
    meaningfulContent.length,
    ...Object.values(starter).map((starterContent) => changedCharacterEvidence(starterContent, content, filename)),
  );

  return Math.min(ADDED_FILE_EVIDENCE_CHARS, meaningfulContent.length, noveltyAgainstClosestStarter);
}

export function projectWorkspaceEvidenceScore(project: GuidedProject, draft: LabDraft | undefined): number {
  if (!draft || !draft.files || typeof draft.files !== 'object') return 0;
  if (draft.missionId && draft.missionId !== `project:${project.id}`) return 0;

  const starter = projectStarterFiles(project);
  if (!hasRequiredStarterFiles(starter, draft.files)) return 0;

  let score = 0;
  const creditedConstructionFingerprints = new Set<string>();

  // Score starter edits first and dedupe them against each other. Reusing the
  // same normalized learner construction in two canonical files must not make
  // one piece of work satisfy multiple milestones. These fingerprints also seed
  // the boundary used by newly added files below.
  for (const [filename, starterContent] of Object.entries(starter)) {
    const content = canonicalText(draft.files[filename]);
    if (!content.trim() || !isConstructionEvidenceFile(filename, starter)) continue;
    const earnedEvidence = changedCharacterEvidence(starterContent, content, filename);
    if (earnedEvidence <= 0) continue;
    const evidenceFingerprint = meaningfulEvidenceText(content, filename);
    if (!evidenceFingerprint || creditedConstructionFingerprints.has(evidenceFingerprint)) continue;
    creditedConstructionFingerprints.add(evidenceFingerprint);
    score += earnedEvidence;
  }

  for (const [filename, rawContent] of Object.entries(draft.files)) {
    if (filename in starter) continue;
    const content = canonicalText(rawContent);
    if (!content.trim() || !isConstructionEvidenceFile(filename, starter)) continue;
    const evidenceFingerprint = meaningfulEvidenceText(content, filename);
    if (!evidenceFingerprint || creditedConstructionFingerprints.has(evidenceFingerprint)) continue;
    creditedConstructionFingerprints.add(evidenceFingerprint);
    score += addedFileConstructionEvidence(starter, filename, content);
  }
  return score;
}

export function hasProjectWorkspaceEvidence(project: GuidedProject, draft: LabDraft | undefined, targetCompletedSteps: number): boolean {
  if (!Number.isInteger(targetCompletedSteps) || targetCompletedSteps <= 0) return false;
  const required = targetCompletedSteps * MIN_CHANGED_CHARS_PER_STEP;
  return projectWorkspaceEvidenceScore(project, draft) >= required;
}
