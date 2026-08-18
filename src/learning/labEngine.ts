import { LabMission, Lesson } from '../data/curriculumCore';
import { LabDraft } from '../lib/localState';

export type LabWorkspace = { mission: LabMission; draft: LabDraft };

function inferLanguage(lesson: Lesson): LabMission['language'] {
  const text = `${lesson.module} ${lesson.title}`.toLowerCase();
  if (text.includes('python')) return 'Python';
  if (text.includes('sql')) return 'SQL';
  if (text.includes('git')) return 'Git';
  if (text.includes('node') || text.includes('api')) return 'Node/API';
  if (text.includes('telegram') || text.includes('discord') || text.includes('whatsapp')) return 'Bots';
  if (text.includes('html') || text.includes('css') || text.includes('web')) return 'HTML/CSS';
  return 'JavaScript';
}

function filenameFor(language: LabMission['language']) {
  if (language === 'Python') return 'main.py';
  if (language === 'SQL') return 'query.sql';
  if (language === 'HTML/CSS') return 'index.html';
  if (language === 'Git') return 'commands.txt';
  return 'main.js';
}

export function missionForLesson(lesson: Lesson): LabMission {
  if (lesson.labMission) return lesson.labMission;
  const language = inferLanguage(lesson);
  return {
    id: `${lesson.id}.lab`,
    title: `Lab — ${lesson.title}`,
    instructions: 'Reproduis l’exemple, modifie une partie importante, observe le résultat puis explique la notion utilisée.',
    language,
    starterCode: lesson.example,
    successCriteria: [
      'Obtenir un résultat cohérent',
      'Modifier volontairement la solution',
      'Expliquer la notion travaillée',
    ],
  };
}

export function openLabWorkspace(lesson: Lesson, stored?: LabDraft): LabWorkspace {
  const mission = missionForLesson(lesson);
  const file = filenameFor(mission.language);
  return {
    mission,
    draft: stored ?? {
      missionId: mission.id,
      language: mission.language,
      files: { [file]: mission.starterCode ?? '' },
      activeFile: file,
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
