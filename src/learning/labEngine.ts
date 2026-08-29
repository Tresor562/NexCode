import { LabMission, Lesson } from '../data/curriculumCore';
import { LabDraft } from '../lib/localState';
import {
  canonicalWorkspacePath,
  isSensitiveWorkspaceFilename,
  restoreWorkspaceDraft,
  workspaceCollisionKey,
} from '../lib/workspaceSafety';

export type LabWorkspace = { mission: LabMission; draft: LabDraft };
export type LabValidation = {
  passed: boolean;
  passedCriteria: string[];
  missingCriteria: string[];
  feedback: string;
  checks: Array<{ id: string; label: string; passed: boolean; detail?: string }>;
};

function inferLanguage(lesson: Lesson): LabMission['language'] {
  const text = `${lesson.module} ${lesson.title}`.toLowerCase();
  if (text.includes('python')) return 'Python';
  if (text.includes('sql')) return 'SQL';
  if (text.includes('git')) return 'Git';
  if (text.includes('node') || text.includes('api')) return 'Node/API';
  if (text.includes('telegram') || text.includes('discord') || text.includes('whatsapp') || text.includes('bot')) return 'Bots';
  if (text.includes('html') || text.includes('css') || text.includes('web')) return 'HTML/CSS';
  return 'JavaScript';
}

function starterFilesFor(language: LabMission['language'], starterCode = ''): Record<string, string> {
  if (language === 'Python') return { 'main.py': starterCode };
  if (language === 'SQL') return { 'query.sql': starterCode };
  if (language === 'Git') return { 'commands.txt': starterCode };
  if (language === 'Node/API') return { 'server.js': starterCode, 'README.md': '# Mission API\n' };
  if (language === 'Bots') return { 'bot.js': starterCode, '.env.example': 'BOT_TOKEN=replace_me\n' };
  if (language === 'HTML/CSS') {
    return {
      'index.html': starterCode.includes('<') ? starterCode : '<main>\n  <h1>NexCode Lab</h1>\n</main>',
      'styles.css': 'body {\n  font-family: sans-serif;\n}\n',
      'script.js': '',
    };
  }
  return { 'main.js': starterCode };
}

function defaultInstructions(lesson: Lesson) {
  const kind = lesson.activityKind ?? 'learn';
  if (kind === 'lab') return `Reconstruis « ${lesson.title} » dans le Lab sans recopier mot pour mot, puis modifie le comportement.`;
  if (kind === 'checkpoint' || kind === 'boss') return `Résous une variante de « ${lesson.title} » sans reprendre la solution de la leçon.`;
  return `Reproduis l’idée de « ${lesson.title} », change une partie importante, observe le résultat puis explique pourquoi il change.`;
}

export function missionForLesson(lesson: Lesson): LabMission {
  if (lesson.labMission) return lesson.labMission;
  const language = inferLanguage(lesson);
  const starterFiles = starterFilesFor(language, lesson.example);
  return {
    id: `${lesson.id}.lab`,
    title: `Lab — ${lesson.title}`,
    instructions: defaultInstructions(lesson),
    language,
    starterCode: lesson.example,
    starterFiles,
    successCriteria: [
      'Le travail contient une modification volontaire par rapport au code de départ',
      'Le résultat démontre la notion étudiée avec une structure valide pour ce langage',
      'La solution ne contient pas de secret ou token réel en clair',
      'Le travail est suffisamment complet pour être relu et expliqué',
    ],
  };
}

function restoreStoredLabDraft(mission: LabMission, stored?: LabDraft): LabDraft | undefined {
  if (!stored) return undefined;
  const starterFiles = mission.starterFiles ?? starterFilesFor(mission.language, mission.starterCode ?? '');
  return restoreWorkspaceDraft({
    stored,
    expectedMissionId: mission.id,
    expectedLanguage: mission.language,
    fallbackFiles: starterFiles,
  }).draft;
}

export function openLabWorkspace(lesson: Lesson, stored?: LabDraft): LabWorkspace {
  const mission = missionForLesson(lesson);
  const starterFiles = mission.starterFiles ?? starterFilesFor(mission.language, mission.starterCode ?? '');
  const activeFile = Object.keys(starterFiles)[0] ?? 'main.txt';
  const restored = restoreStoredLabDraft(mission, stored);
  return {
    mission,
    draft: restored ?? {
      missionId: mission.id,
      language: mission.language,
      files: starterFiles,
      activeFile,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function invalidateLabValidation(draft: LabDraft): LabDraft {
  if (!draft.lastValidatedAt && !(draft.passedCriteria?.length)) return draft;
  return {
    ...draft,
    lastValidatedAt: undefined,
    passedCriteria: [],
    updatedAt: new Date().toISOString(),
  };
}

function resolveEditableLabFilename(draft: LabDraft, filename: string) {
  const safe = canonicalWorkspacePath(filename);
  if (!safe || isSensitiveWorkspaceFilename(safe)) return undefined;

  const collisionKey = workspaceCollisionKey(safe);
  return Object.keys(draft.files).find((existing) => workspaceCollisionKey(existing) === collisionKey);
}

function resolveWorkspaceFilename(files: Record<string, string>, filename: string) {
  const key = workspaceCollisionKey(filename);
  return Object.keys(files).find((existing) => workspaceCollisionKey(existing) === key);
}

export function updateLabFile(draft: LabDraft, filename: string, content: string): LabDraft {
  const existingFilename = resolveEditableLabFilename(draft, filename);
  if (!existingFilename) return draft;

  const changed = draft.files[existingFilename] !== content;
  const next = {
    ...draft,
    files: { ...draft.files, [existingFilename]: content },
    activeFile: existingFilename,
    updatedAt: new Date().toISOString(),
  };
  return changed ? invalidateLabValidation(next) : next;
}

export function addLabFile(draft: LabDraft, filename: string) {
  const safe = canonicalWorkspacePath(filename);
  if (!safe || isSensitiveWorkspaceFilename(safe)) return draft;

  const collisionKey = workspaceCollisionKey(safe);
  const collides = Object.keys(draft.files).some((existing) => workspaceCollisionKey(existing) === collisionKey);
  if (collides) return draft;

  return invalidateLabValidation({
    ...draft,
    files: { ...draft.files, [safe]: '' },
    activeFile: safe,
    updatedAt: new Date().toISOString(),
  });
}

export function renameLabFile(draft: LabDraft, filename: string, nextFilename: string) {
  const existingFilename = resolveEditableLabFilename(draft, filename);
  const safeNext = canonicalWorkspacePath(nextFilename);
  if (!existingFilename || !safeNext || isSensitiveWorkspaceFilename(safeNext)) return draft;

  const nextKey = workspaceCollisionKey(safeNext);
  const collision = Object.keys(draft.files).find(
    (existing) => existing !== existingFilename && workspaceCollisionKey(existing) === nextKey,
  );
  if (collision) return draft;
  if (existingFilename === safeNext) return draft;

  const files: Record<string, string> = {};
  for (const [name, content] of Object.entries(draft.files)) {
    files[name === existingFilename ? safeNext : name] = content;
  }

  return invalidateLabValidation({
    ...draft,
    files,
    activeFile: draft.activeFile === existingFilename ? safeNext : draft.activeFile,
    updatedAt: new Date().toISOString(),
  });
}

export function removeLabFile(draft: LabDraft, filename: string) {
  const names = Object.keys(draft.files);
  if (names.length <= 1) return draft;

  const existingFilename = resolveEditableLabFilename(draft, filename);
  if (!existingFilename) return draft;

  const files = { ...draft.files };
  delete files[existingFilename];
  const activeFile = draft.activeFile === existingFilename ? Object.keys(files)[0]! : draft.activeFile;
  return invalidateLabValidation({ ...draft, files, activeFile, updatedAt: new Date().toISOString() });
}

function containsLikelySecret(files: Record<string, string>) {
  if (Object.keys(files).some(isSensitiveWorkspaceFilename)) return true;
  const text = Object.values(files).join('\n');
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) return true;
  return /(bot[_-]?token|api[_-]?key|secret)\s*[=:]\s*["']?(?!replace|your|example|test|changeme)[A-Za-z0-9_-]{12,}/i.test(text);
}

function meaningfulChange(mission: LabMission, files: Record<string, string>) {
  const starterFiles = mission.starterFiles ?? starterFilesFor(mission.language, mission.starterCode ?? '');
  const normalized = (value: string) => value.replace(/\s+/g, ' ').trim();
  const starterNames = new Set(Object.keys(starterFiles));

  for (const [filename, content] of Object.entries(files)) {
    if (!starterNames.has(filename)) {
      if (normalized(content).length >= 3) return true;
      continue;
    }
    if (normalized(content) !== normalized(starterFiles[filename] ?? '')) return true;
  }

  return Object.keys(starterFiles).some((filename) => files[filename] === undefined);
}

function languageStructureCheck(language: LabMission['language'], files: Record<string, string>) {
  const joined = Object.values(files).join('\n');
  const lower = joined.toLowerCase();
  if (language === 'HTML/CSS') {
    const htmlPath = resolveWorkspaceFilename(files, 'index.html');
    const cssPath = resolveWorkspaceFilename(files, 'styles.css');
    const html = htmlPath ? files[htmlPath] ?? '' : joined;
    const css = cssPath ? files[cssPath] ?? '' : joined;
    return /<([a-z][\w-]*)(\s[^>]*)?>[\s\S]*<\/\1>/i.test(html) && /[.#]?[a-z][\w-]*\s*\{[^}]+\}/i.test(css);
  }
  if (language === 'JavaScript') {
    return /\b(const|let|var|function|class)\b/.test(joined) && /[;)}\]]/.test(joined);
  }
  if (language === 'Python') {
    const hasStatement = /^(\s*)(def|class|if|for|while|print|[a-zA-Z_]\w*\s*=)/m.test(joined);
    const suspiciousBraceStyle = /\b(def|if|for|while)\b[^\n]*\{/.test(joined);
    return hasStatement && !suspiciousBraceStyle;
  }
  if (language === 'SQL') {
    return /\b(select|insert|update|delete|create)\b/i.test(joined) && /\b(from|into|table|set)\b/i.test(joined);
  }
  if (language === 'Git') {
    return joined.split(/\r?\n/).some((line) => /^\s*git\s+(status|add|commit|branch|switch|checkout|merge|rebase|log|diff|restore|reset)\b/.test(line));
  }
  if (language === 'Node/API') {
    return /\b(require|import|export|async|function|const|let)\b/.test(joined) && /(http|express|request|response|req\b|res\b|listen\s*\()/i.test(joined);
  }
  if (language === 'Bots') {
    return /(message|update|interaction|command|handler|on\s*\(|bot\.|client\.|reply|send)/i.test(lower);
  }
  return joined.trim().length >= 20;
}

function completenessCheck(language: LabMission['language'], files: Record<string, string>) {
  const nonEmptyFiles = Object.entries(files).filter(([, value]) => value.trim().length > 0);
  if (language === 'HTML/CSS') {
    const hasHtml = nonEmptyFiles.some(([name]) => name.toLocaleLowerCase('en-US').normalize('NFC').endsWith('.html'));
    const hasCss = nonEmptyFiles.some(([name]) => name.toLocaleLowerCase('en-US').normalize('NFC').endsWith('.css'));
    return hasHtml && hasCss;
  }
  if (language === 'Node/API' || language === 'Bots') {
    return nonEmptyFiles.some(([name]) => /\.(js|ts)$/i.test(name.normalize('NFC')));
  }
  return nonEmptyFiles.length >= 1 && nonEmptyFiles.some(([, value]) => value.trim().length >= 20);
}

export function validateLabDraft(mission: LabMission, draft: LabDraft): LabValidation {
  const allText = Object.values(draft.files).join('\n').trim();
  const nonEmpty = allText.length >= 20;
  const modified = meaningfulChange(mission, draft.files);
  const structureValid = languageStructureCheck(mission.language, draft.files);
  const secretSafe = !containsLikelySecret(draft.files);
  const completeEnough = completenessCheck(mission.language, draft.files);

  const checks = [
    { id: 'modified', label: mission.successCriteria[0] ?? 'Modification réelle', passed: modified },
    { id: 'structure', label: mission.successCriteria[1] ?? 'Structure valide', passed: structureValid },
    { id: 'secret-safe', label: mission.successCriteria[2] ?? 'Aucun secret réel', passed: secretSafe },
    { id: 'complete', label: mission.successCriteria[3] ?? 'Travail suffisamment complet', passed: nonEmpty && completeEnough },
  ];

  const passedCriteria = checks.filter((item) => item.passed).map((item) => item.label);
  const missingCriteria = checks.filter((item) => !item.passed).map((item) => item.label);
  const passed = checks.every((item) => item.passed);

  return {
    passed,
    passedCriteria,
    missingCriteria,
    checks,
    feedback: passed
      ? 'Mission validée localement : modification réelle, structure cohérente, travail complet et aucun secret évident détecté.'
      : `À améliorer avant validation : ${missingCriteria.join(' • ')}`,
  };
}

export function stampLabValidation(draft: LabDraft, result: LabValidation): LabDraft {
  return {
    ...draft,
    lastValidatedAt: new Date().toISOString(),
    passedCriteria: result.passedCriteria,
    updatedAt: new Date().toISOString(),
  };
}
