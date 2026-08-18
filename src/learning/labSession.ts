import { Lesson } from '../data/curriculumCore';
import { LabDraft } from '../lib/localState';
import { LabWorkspace, openLabWorkspace, validateLabDraft } from './labEngine';

export type LabReturnTarget = {
  courseId: string;
  lessonId: string;
  source: 'lesson' | 'practice' | 'checkpoint' | 'project';
};

export type LabSession = {
  id: string;
  workspace: LabWorkspace;
  returnTarget: LabReturnTarget;
  openedAt: string;
  lastAutosaveAt?: string;
  runCount: number;
  lastRunFeedback?: string;
};

export function startLabSession(courseId: string, lesson: Lesson, stored?: LabDraft, now = new Date()): LabSession {
  return {
    id: `${courseId}:${lesson.id}:${now.getTime()}`,
    workspace: openLabWorkspace(lesson, stored),
    returnTarget: {
      courseId,
      lessonId: lesson.id,
      source: lesson.activityKind === 'checkpoint' || lesson.activityKind === 'boss' ? 'checkpoint' : 'lesson',
    },
    openedAt: now.toISOString(),
    runCount: 0,
  };
}

export function autosaveLabSession(session: LabSession, draft: LabDraft, now = new Date()): LabSession {
  return {
    ...session,
    workspace: { ...session.workspace, draft: { ...draft, updatedAt: now.toISOString() } },
    lastAutosaveAt: now.toISOString(),
  };
}

export function runLabValidation(session: LabSession) {
  const result = validateLabDraft(session.workspace.mission, session.workspace.draft);
  return {
    session: {
      ...session,
      runCount: session.runCount + 1,
      lastRunFeedback: result.feedback,
    },
    result,
  };
}

export function labSessionCanReturn(session: LabSession) {
  return validateLabDraft(session.workspace.mission, session.workspace.draft).passed;
}

export function webPreviewDocument(draft: LabDraft) {
  const html = draft.files['index.html'] ?? '<main></main>';
  const css = draft.files['styles.css'] ?? '';
  const js = draft.files['script.js'] ?? '';
  return `${html}\n<style>${css}</style>\n<script>${js}<\/script>`;
}

export function labConsoleLines(feedback: string, passed: boolean) {
  return [
    passed ? '✓ Mission validée localement.' : '• Mission encore incomplète.',
    feedback,
    passed ? 'Retourne au cours et explique ce que tu as modifié.' : 'Corrige un critère, relance, puis compare le résultat.',
  ];
}
