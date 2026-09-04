import { Lesson } from '../data/curriculumCore';
import { LabDraft } from '../lib/localState';
import { workspaceCollisionKey } from '../lib/workspaceSafety';
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

function labReturnSource(lesson: Lesson): LabReturnTarget['source'] {
  if (lesson.activityKind === 'project') return 'project';
  if (lesson.activityKind === 'checkpoint' || lesson.activityKind === 'boss') return 'checkpoint';
  if (lesson.activityKind === 'practice' || lesson.activityKind === 'review') return 'practice';
  return 'lesson';
}

function safeSessionDate(value: Date) {
  return Number.isFinite(value.getTime()) ? value : new Date();
}

function draftTimestamp(value: string | undefined) {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function incomingDraftIsStale(incoming: LabDraft, current: LabDraft) {
  const currentTimestamp = draftTimestamp(current.updatedAt);
  if (currentTimestamp === undefined) return false;
  const incomingTimestamp = draftTimestamp(incoming.updatedAt);
  return incomingTimestamp === undefined || incomingTimestamp < currentTimestamp;
}

function snapshotLabDraft(draft: LabDraft, updatedAt: string): LabDraft {
  return {
    ...draft,
    files: { ...draft.files },
    passedCriteria: draft.passedCriteria ? [...draft.passedCriteria] : undefined,
    updatedAt,
  };
}

export function startLabSession(courseId: string, lesson: Lesson, stored?: LabDraft, now = new Date()): LabSession {
  const sessionDate = safeSessionDate(now);
  return {
    id: `${courseId}:${lesson.id}:${sessionDate.getTime()}`,
    workspace: openLabWorkspace(lesson, stored),
    returnTarget: {
      courseId,
      lessonId: lesson.id,
      source: labReturnSource(lesson),
    },
    openedAt: sessionDate.toISOString(),
    runCount: 0,
  };
}

export function autosaveLabSession(session: LabSession, draft: LabDraft, now = new Date()): LabSession {
  if (incomingDraftIsStale(draft, session.workspace.draft)) return session;
  const savedAt = safeSessionDate(now).toISOString();
  return {
    ...session,
    workspace: { ...session.workspace, draft: snapshotLabDraft(draft, savedAt) },
    lastAutosaveAt: savedAt,
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

function escapeHtmlAttribute(source: string) {
  return source.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function previewAttribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function optionalPreviewAttribute(tag: string, name: 'media' | 'type') {
  const value = previewAttribute(tag, name)?.trim();
  return value ? ` ${name}="${escapeHtmlAttribute(value)}"` : '';
}

function normalizePreviewAssetPath(rawReference: string, sourcePath?: string) {
  const trimmed = rawReference.trim();
  if (!trimmed || /^(?:[a-z][a-z\d+.-]*:|\/\/|\/|#)/i.test(trimmed)) return undefined;

  const withoutQuery = trimmed.split(/[?#]/, 1)[0] ?? '';
  let decoded = withoutQuery;
  try {
    decoded = decodeURIComponent(withoutQuery);
  } catch {
    return undefined;
  }

  const sourceSegments = sourcePath?.replace(/\\/g, '/').split('/').slice(0, -1).filter(Boolean) ?? [];
  const segments = decoded.replace(/\\/g, '/').split('/');
  const normalized: string[] = [...sourceSegments];
  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (!normalized.length) return undefined;
      normalized.pop();
      continue;
    }
    normalized.push(segment);
  }
  return normalized.join('/');
}

function resolvePreviewWorkspaceFile(draft: LabDraft, normalizedPath: string) {
  const collisionKey = workspaceCollisionKey(normalizedPath);
  return Object.keys(draft.files).find((filename) => workspaceCollisionKey(filename) === collisionKey);
}

function svgPreviewDataUri(source: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
}

function inlineLocalSvgCssUrls(source: string, draft: LabDraft, stylesheetPath: string) {
  return source.replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"\s][^)]*))\s*\)/gi, (match, doubleQuoted, singleQuoted, bare) => {
    const reference = String(doubleQuoted ?? singleQuoted ?? bare ?? '').trim();
    const normalizedPath = normalizePreviewAssetPath(reference, stylesheetPath);
    if (!normalizedPath || !normalizedPath.toLowerCase().endsWith('.svg')) return match;
    const path = resolvePreviewWorkspaceFile(draft, normalizedPath);
    if (!path) return match;
    const svg = draft.files[path];
    if (svg === undefined) return match;
    return `url("${svgPreviewDataUri(svg)}")`;
  });
}

function inlineLocalPreviewImages(document: string, draft: LabDraft) {
  return document.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = previewAttribute(tag, 'src');
    if (!src) return tag;
    const normalizedPath = normalizePreviewAssetPath(src);
    if (!normalizedPath || !normalizedPath.toLowerCase().endsWith('.svg')) return tag;
    const path = resolvePreviewWorkspaceFile(draft, normalizedPath);
    if (!path) return tag;
    const source = draft.files[path];
    if (source === undefined) return tag;
    const dataUri = escapeHtmlAttribute(svgPreviewDataUri(source));
    return tag.replace(/(\bsrc\s*=\s*)(?:"[^"]*"|'[^']*'|[^\s>]+)/i, `$1"${dataUri}"`);
  });
}

function inlineLocalPreviewAssets(document: string, draft: LabDraft) {
  const inlinedStyles = new Set<string>();
  const inlinedScripts = new Set<string>();

  let output = inlineLocalPreviewImages(document, draft);
  output = output.replace(/<link\b[^>]*>/gi, (tag) => {
    const rel = previewAttribute(tag, 'rel')?.toLowerCase().split(/\s+/) ?? [];
    const href = previewAttribute(tag, 'href');
    if (!href || !rel.includes('stylesheet')) return tag;
    const normalizedPath = normalizePreviewAssetPath(href);
    if (!normalizedPath || !normalizedPath.toLowerCase().endsWith('.css')) return tag;
    const path = resolvePreviewWorkspaceFile(draft, normalizedPath);
    if (!path) return tag;
    const source = draft.files[path];
    if (source === undefined) return tag;
    inlinedStyles.add(path);
    const mediaAttribute = optionalPreviewAttribute(tag, 'media');
    const previewCss = inlineLocalSvgCssUrls(source, draft, path);
    return `<style data-nexcode-source="${escapeHtmlAttribute(path)}"${mediaAttribute}>${escapeInlineClosingTag(previewCss, 'style')}</style>`;
  });

  output = output.replace(/<script\b[^>]*\bsrc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)[^>]*>\s*<\/script>/gi, (tag) => {
    const src = previewAttribute(tag, 'src');
    if (!src) return tag;
    const normalizedPath = normalizePreviewAssetPath(src);
    if (!normalizedPath || !normalizedPath.toLowerCase().endsWith('.js')) return tag;
    const path = resolvePreviewWorkspaceFile(draft, normalizedPath);
    if (!path) return tag;
    const source = draft.files[path];
    if (source === undefined) return tag;
    inlinedScripts.add(path);
    const typeAttribute = optionalPreviewAttribute(tag, 'type');
    return `<script data-nexcode-source="${escapeHtmlAttribute(path)}"${typeAttribute}>${escapeInlineClosingTag(source, 'script')}<\/script>`;
  });

  return { document: output, inlinedStyles, inlinedScripts };
}

function injectAfterOpeningTag(document: string, tagName: 'html' | 'head', fragment: string) {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>`, 'i');
  const match = document.match(pattern);
  if (!match || match.index === undefined) return document;
  const end = match.index + match[0].length;
  return `${document.slice(0, end)}\n${fragment}${document.slice(end)}`;
}

function injectBeforeClosingTag(document: string, closingTag: '</body>' | '</html>', fragment: string) {
  const index = document.toLowerCase().lastIndexOf(closingTag);
  if (index < 0) return `${document}\n${fragment}`;
  return `${document.slice(0, index)}${fragment}\n${document.slice(index)}`;
}

const previewContentSecurityPolicy = [
  "default-src 'none'",
  "img-src data: blob:",
  "media-src data: blob:",
  "style-src 'unsafe-inline'",
  "script-src 'unsafe-inline'",
  "connect-src 'none'",
  "font-src data:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const previewRuntimeFeedback = `<style data-nexcode-runtime-feedback>
#nexcode-runtime-feedback{position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483647;display:none;max-height:34vh;overflow:auto;padding:10px 12px;border-radius:12px;background:rgba(11,16,32,.94);color:#f7f8ff;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;box-shadow:0 8px 28px rgba(0,0,0,.32);white-space:pre-wrap;word-break:break-word}
#nexcode-runtime-feedback[data-level="warn"]{border:1px solid rgba(250,204,21,.55)}
#nexcode-runtime-feedback[data-level="error"]{border:1px solid rgba(248,113,113,.7)}
<\/style>
<script data-nexcode-runtime-feedback>(function(){
  var MAX_LINES=6, MAX_CHARS=1800, lines=[], worst='log';
  function safe(value){try{if(typeof value==='string')return value;if(value instanceof Error)return value.name+': '+value.message;var json=JSON.stringify(value);return typeof json==='string'?json:String(value)}catch(_){try{return String(value)}catch(__){return '[valeur illisible]'}}}
  function rank(level){return level==='error'?3:level==='warn'?2:1}
  function render(){var node=document.getElementById('nexcode-runtime-feedback');if(!node)return;node.textContent=lines.join('\\n').slice(-MAX_CHARS);node.dataset.level=worst;node.style.display=lines.length?'block':'none'}
  function push(level,args){var text=Array.prototype.map.call(args,safe).join(' ').slice(0,500);if(!text)return;lines.push((level==='error'?'✕ ':level==='warn'?'⚠ ':'› ')+text);if(lines.length>MAX_LINES)lines=lines.slice(-MAX_LINES);if(rank(level)>rank(worst))worst=level;render()}
  ['log','info','warn','error'].forEach(function(level){var original=console[level]&&console[level].bind(console);console[level]=function(){push(level,arguments);if(original)original.apply(console,arguments)}});
  window.addEventListener('error',function(event){push('error',[event.message||'Erreur JavaScript'])});
  window.addEventListener('unhandledrejection',function(event){push('error',['Promise rejetée',event.reason])});
  document.addEventListener('DOMContentLoaded',function(){if(document.getElementById('nexcode-runtime-feedback'))return;var node=document.createElement('div');node.id='nexcode-runtime-feedback';node.setAttribute('role','status');node.setAttribute('aria-live','polite');document.body.appendChild(node);render()});
})();<\/script>`;

function previewHeadMarkup(styleTag: string) {
  return [
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    `<meta http-equiv="Content-Security-Policy" content="${previewContentSecurityPolicy}">`,
    previewRuntimeFeedback,
    styleTag,
  ].filter(Boolean).join('\n');
}

export function webPreviewDocument(draft: LabDraft) {
  const entryPath = resolvePreviewWorkspaceFile(draft, 'index.html');
  const sourceHtml = (entryPath ? draft.files[entryPath] : undefined)?.trim() || '<main></main>';
  const inlined = inlineLocalPreviewAssets(sourceHtml, draft);
  const fallbackCssPath = resolvePreviewWorkspaceFile(draft, 'styles.css');
  const fallbackJsPath = resolvePreviewWorkspaceFile(draft, 'script.js');
  const fallbackCss = fallbackCssPath && !inlined.inlinedStyles.has(fallbackCssPath) ? (draft.files[fallbackCssPath] ?? '') : '';
  const fallbackJs = fallbackJsPath && !inlined.inlinedScripts.has(fallbackJsPath) ? (draft.files[fallbackJsPath] ?? '') : '';
  const styleTag = fallbackCssPath && fallbackCss
    ? `<style data-nexcode-source="${escapeHtmlAttribute(fallbackCssPath)}">${escapeInlineClosingTag(inlineLocalSvgCssUrls(fallbackCss, draft, fallbackCssPath), 'style')}</style>`
    : '';
  const scriptTag = fallbackJsPath && fallbackJs
    ? `<script data-nexcode-source="${escapeHtmlAttribute(fallbackJsPath)}">${escapeInlineClosingTag(fallbackJs, 'script')}<\/script>`
    : '';
  const headMarkup = previewHeadMarkup(styleTag);

  let document: string;
  if (/<html\b/i.test(inlined.document)) {
    document = /<head\b/i.test(inlined.document)
      ? injectAfterOpeningTag(inlined.document, 'head', headMarkup)
      : injectAfterOpeningTag(inlined.document, 'html', `<head>\n${headMarkup}\n</head>`);
  } else {
    document = `<!doctype html>\n<html>\n<head>\n${headMarkup}\n</head>\n<body>\n${inlined.document}\n</body>\n</html>`;
  }

  if (!scriptTag) return document;
  return document.toLowerCase().includes('</body>')
    ? injectBeforeClosingTag(document, '</body>', scriptTag)
    : injectBeforeClosingTag(document, '</html>', scriptTag);
}

export function labConsoleLines(feedback: string, passed: boolean) {
  return [
    passed ? '✓ Mission validée localement.' : '• Mission encore incomplète.',
    feedback,
    passed ? 'Retourne au cours et explique ce que tu as modifié.' : 'Corrige un critère, relance, puis compare le résultat.',
  ];
}
