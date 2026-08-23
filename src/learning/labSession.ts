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

function escapeInlineClosingTag(source: string, tagName: 'script' | 'style') {
  return source.replace(new RegExp(`</${tagName}`, 'gi'), `<\\/${tagName}`);
}

function injectBeforeClosingTag(document: string, closingTag: '</head>' | '</body>', fragment: string) {
  const index = document.toLowerCase().lastIndexOf(closingTag);
  if (index < 0) return `${document}\n${fragment}`;
  return `${document.slice(0, index)}${fragment}\n${document.slice(index)}`;
}

export function webPreviewDocument(draft: LabDraft) {
  const html = draft.files['index.html']?.trim() || '<main></main>';
  const css = draft.files['styles.css'] ?? '';
  const js = draft.files['script.js'] ?? '';
  const styleTag = `<style>${escapeInlineClosingTag(css, 'style')}</style>`;
  const scriptTag = `<script>${escapeInlineClosingTag(js, 'script')}<\/script>`;

  const withStyles = html.toLowerCase().includes('</head>')
    ? injectBeforeClosingTag(html, '</head>', styleTag)
    : html.toLowerCase().includes('</body>')
      ? injectBeforeClosingTag(html, '</body>', styleTag)
      : `${html}\n${styleTag}`;

  return injectBeforeClosingTag(withStyles, '</body>', scriptTag);
}

export function labConsoleLines(feedback: string, passed: boolean) {
  return [
    passed ? '✓ Mission validée localement.' : '• Mission encore incomplète.',
    feedback,
    passed ? 'Retourne au cours et explique ce que tu as modifié.' : 'Corrige un critère, relance, puis compare le résultat.',
  ];
}
