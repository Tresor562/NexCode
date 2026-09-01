import type { GuidedProject } from '../data/curriculumCore';
import type { LabDraft } from '../lib/localState';

const MIN_CHANGED_CHARS_PER_STEP = 24;
const ADDED_FILE_EVIDENCE_CHARS = 48;

function canonicalText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\r\n/g, '\n') : '';
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

function changedCharacterEvidence(before: string, after: string): number {
  const left = canonicalText(before);
  const right = canonicalText(after);
  const shared = Math.min(left.length, right.length);
  let changed = Math.abs(left.length - right.length);
  for (let index = 0; index < shared; index += 1) {
    if (left[index] !== right[index]) changed += 1;
  }
  return changed;
}

export function projectWorkspaceEvidenceScore(project: GuidedProject, draft: LabDraft | undefined): number {
  if (!draft || !draft.files || typeof draft.files !== 'object') return 0;
  if (draft.missionId && draft.missionId !== `project:${project.id}`) return 0;

  const starter = projectStarterFiles(project);
  if (!hasRequiredStarterFiles(starter, draft.files)) return 0;

  let score = 0;
  for (const [filename, rawContent] of Object.entries(draft.files)) {
    const content = canonicalText(rawContent);
    if (!content.trim()) continue;
    if (!(filename in starter)) {
      score += Math.min(ADDED_FILE_EVIDENCE_CHARS, content.length);
      continue;
    }
    score += changedCharacterEvidence(starter[filename] ?? '', content);
  }
  return score;
}

export function hasProjectWorkspaceEvidence(project: GuidedProject, draft: LabDraft | undefined, targetCompletedSteps: number): boolean {
  if (!Number.isInteger(targetCompletedSteps) || targetCompletedSteps <= 0) return false;
  const required = targetCompletedSteps * MIN_CHANGED_CHARS_PER_STEP;
  return projectWorkspaceEvidenceScore(project, draft) >= required;
}
