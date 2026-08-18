import { LabMission, Lesson } from '../data/curriculumCore';
import { LabDraft } from '../lib/localState';

export type LabWorkspace = { mission: LabMission; draft: LabDraft };
export type LabValidation = {
  passed: boolean;
  passedCriteria: string[];
  missingCriteria: string[];
  feedback: string;
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
      'Le résultat reste cohérent avec la notion étudiée',
      'La solution ne contient pas de secret ou token réel en clair',
      'Tu peux expliquer ce qui change et pourquoi',
    ],
  };
}

export function openLabWorkspace(lesson: Lesson, stored?: LabDraft): LabWorkspace {
  const mission = missionForLesson(lesson);
  const starterFiles = mission.starterFiles ?? starterFilesFor(mission.language, mission.starterCode ?? '');
  const activeFile = Object.keys(starterFiles)[0] ?? 'main.txt';
  return {
    mission,
    draft: stored ?? {
      missionId: mission.id,
      language: mission.language,
      files: starterFiles,
      activeFile,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function updateLabFile(draft: LabDraft, filename: string, content: string): LabDraft {
  return {
    ...draft,
    files: { ...draft.files, [filename]: content },
    activeFile: filename,
    updatedAt: new Date().toISOString(),
  };
}

export function addLabFile(draft: LabDraft, filename: string) {
  const safe = filename.trim().replace(/[^a-zA-Z0-9._-]/g, '-');
  if (!safe || draft.files[safe] !== undefined) return draft;
  return { ...draft, files: { ...draft.files, [safe]: '' }, activeFile: safe, updatedAt: new Date().toISOString() };
}

export function removeLabFile(draft: LabDraft, filename: string) {
  const names = Object.keys(draft.files);
  if (names.length <= 1 || draft.files[filename] === undefined) return draft;
  const files = { ...draft.files };
  delete files[filename];
  const activeFile = draft.activeFile === filename ? Object.keys(files)[0]! : draft.activeFile;
  return { ...draft, files, activeFile, updatedAt: new Date().toISOString() };
}

function containsLikelySecret(files: Record<string, string>) {
  const text = Object.values(files).join('\n');
  return /(bot[_-]?token|api[_-]?key|secret)\s*[=:]\s*["']?(?!replace|your|example|test)[A-Za-z0-9_-]{12,}/i.test(text);
}

export function validateLabDraft(mission: LabMission, draft: LabDraft): LabValidation {
  const allText = Object.values(draft.files).join('\n').trim();
  const nonEmpty = allText.length >= 12;
  const modified = mission.starterCode ? !allText.includes(mission.starterCode.trim()) || allText.length !== mission.starterCode.trim().length : nonEmpty;
  const secretSafe = !containsLikelySecret(draft.files);
  const criteriaChecks = [nonEmpty, modified, secretSafe, nonEmpty];
  const passedCriteria = mission.successCriteria.filter((_, index) => criteriaChecks[index] ?? nonEmpty);
  const missingCriteria = mission.successCriteria.filter((_, index) => !(criteriaChecks[index] ?? nonEmpty));
  const passed = missingCriteria.length === 0;
  return {
    passed,
    passedCriteria,
    missingCriteria,
    feedback: passed
      ? 'Mission prête pour la revue : le travail est modifié, non vide et ne contient pas de secret évident.'
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
