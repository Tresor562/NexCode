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
  if (draft.files[existingFilename] === content) return draft;

  const next = {
    ...draft,
    files: { ...draft.files, [existingFilename]: content },
    activeFile: existingFilename,
    updatedAt: new Date().toISOString(),
  };
  return invalidateLabValidation(next);
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

function meaningfulEvidenceSource(content: string) {
  return content
    .replace(/\r\n?/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*(?:\/\/|#|--)(?:\s|$)/.test(line))
    .join('\n')
    .replace(/\s+/g, '');
}

function meaningfulChange(mission: LabMission, files: Record<string, string>) {
  const starterFiles = mission.starterFiles ?? starterFilesFor(mission.language, mission.starterCode ?? '');
  const filesByKey = new Map(
    Object.entries(files).map(([filename, content]) => [workspaceCollisionKey(filename), content]),
  );

  // Starter destruction must never satisfy the Lab learning-evidence gate.
  for (const [filename, starterContent] of Object.entries(starterFiles)) {
    const content = filesByKey.get(workspaceCollisionKey(filename));
    if (content === undefined) return false;
    if (meaningfulEvidenceSource(starterContent).length > 0 && meaningfulEvidenceSource(content).length === 0) return false;
  }

  for (const [filename, content] of Object.entries(files)) {
    const starterFilename = Object.keys(starterFiles).find(
      (candidate) => workspaceCollisionKey(candidate) === workspaceCollisionKey(filename),
    );
    if (!starterFilename) {
      // Adding a placeholder file such as "x" is not learning evidence. Require a
      // small but non-trivial body of executable/markup content before an added
      // file can unlock a Lab milestone on its own.
      if (meaningfulEvidenceSource(content).length >= 12) return true;
      continue;
    }
    if (meaningfulEvidenceSource(content) !== meaningfulEvidenceSource(starterFiles[starterFilename] ?? '')) return true;
  }

  return false;
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

function successCriteriaChecks(mission: LabMission, files: Record<string, string>) {
  const criteria = mission.successCriteria ?? [];
  if (!criteria.length) return [];
  return criteria.map((criterion, index) => {
    const lower = criterion.toLowerCase();
    let passed = true;
    if (lower.includes('modification') || lower.includes('départ') || lower.includes('starter')) passed = meaningfulChange(mission, files);
    else if (lower.includes('structure') || lower.includes('langage')) passed = languageStructureCheck(mission.language, files);
    else if (lower.includes('secret') || lower.includes('token')) passed = !containsLikelySecret(files);
    else if (lower.includes('complet') || lower.includes('relire') || lower.includes('expliqu')) passed = completenessCheck(mission.language, files);
    return { id: `criterion-${index + 1}`, label: criterion, passed };
  });
}

export function validateLabDraft(mission: LabMission, draft: LabDraft): LabValidation {
  const checks = [
    { id: 'mission', label: 'Mission correcte', passed: draft.missionId === mission.id },
    { id: 'language', label: 'Langage correct', passed: draft.language === mission.language },
    { id: 'secret', label: 'Aucun secret évident', passed: !containsLikelySecret(draft.files) },
    { id: 'structure', label: 'Structure cohérente', passed: languageStructureCheck(mission.language, draft.files) },
    { id: 'complete', label: 'Travail suffisamment complet', passed: completenessCheck(mission.language, draft.files) },
    ...successCriteriaChecks(mission, draft.files),
  ];
  const passedCriteria = checks.filter((check) => check.passed).map((check) => check.label);
  const missingCriteria = checks.filter((check) => !check.passed).map((check) => check.label);
  const passed = missingCriteria.length === 0;
  return {
    passed,
    passedCriteria,
    missingCriteria,
    feedback: passed
      ? 'Mission validée. Tu peux retourner au parcours et expliquer ce que tu as changé.'
      : `À corriger : ${missingCriteria.slice(0, 2).join(' · ')}`,
    checks,
  };
}

export function stampLabValidation(draft: LabDraft, result: LabValidation, now = new Date()): LabDraft {
  const validDate = Number.isFinite(now.getTime()) ? now : new Date();
  const validatedAt = validDate.toISOString();
  const missionCriteria = result.checks
    .filter((check) => check.id.startsWith('criterion-') && check.passed)
    .map((check) => check.label);
  return {
    ...draft,
    lastValidatedAt: validatedAt,
    passedCriteria: missionCriteria.length ? missionCriteria : [...result.passedCriteria],
    updatedAt: validatedAt,
  };
}