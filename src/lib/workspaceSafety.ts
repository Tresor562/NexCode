import type { LabDraft } from './localState';

const SENSITIVE_BASENAMES = new Set([
  '.env',
  '.npmrc',
  '.pypirc',
  '.netrc',
  '.git-credentials',
  '.yarnrc.yml',
  'pip.conf',
  'pip.ini',
  'auth.json',
  '.dockerconfigjson',
  'application_default_credentials.json',
  'id_rsa',
  'id_ed25519',
  'credentials',
  'credentials.json',
  'service-account.json',
  'service_account.json',
]);

const LIKELY_SECRET_PATTERNS = [
  /(?:bot[_-]?token|api[_-]?key|client[_-]?secret|private[_-]?key)\s*[=:]\s*["']?(?!replace|example|test|your|changeme)[A-Za-z0-9_\-.]{12,}/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\b(?:sk_live|rk_live)_[A-Za-z0-9]{16,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  /\b\d{6,12}:[A-Za-z0-9_-]{30,}\b/,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /\bAIza[0-9A-Za-z_-]{35}\b/,
];

const WINDOWS_RESERVED_BASENAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const WINDOWS_INVALID_SEGMENT_CHARS = /[<>:"|?*]/;
const UNSAFE_INVISIBLE_PATH_CHARS = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/;
const MAX_WORKSPACE_PATH_CHARS = 240;
const MAX_WORKSPACE_SEGMENT_CHARS = 120;
const MAX_WORKSPACE_DEPTH = 12;
const MAX_RESTORED_FILE_CHARS = 1_500_000;
const MAX_RESTORED_WORKSPACE_CHARS = 5_000_000;
const MAX_RESTORED_FILES = 300;
const MAX_VALIDATION_CRITERIA = 100;
const MAX_VALIDATION_CRITERION_CHARS = 240;
const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;

function portableWorkspaceSegment(segment: string): boolean {
  return Boolean(segment)
    && segment.length <= MAX_WORKSPACE_SEGMENT_CHARS
    && segment !== '.'
    && segment !== '..'
    && !/[\u0000-\u001f\u007f]/.test(segment)
    && !UNSAFE_INVISIBLE_PATH_CHARS.test(segment)
    && !WINDOWS_INVALID_SEGMENT_CHARS.test(segment)
    && !/[. ]$/.test(segment)
    && !WINDOWS_RESERVED_BASENAME.test(segment);
}

export function canonicalWorkspacePath(path: string): string | null {
  const normalized = path.trim().replace(/\\/g, '/').normalize('NFC');
  if (!normalized || normalized.length > MAX_WORKSPACE_PATH_CHARS || normalized.startsWith('/') || normalized.includes('\0')) return null;
  const segments = normalized.split('/');
  if (segments.length > MAX_WORKSPACE_DEPTH || segments.some((segment) => !portableWorkspaceSegment(segment))) return null;
  return normalized;
}

export function workspaceCollisionKey(path: string): string {
  return path.normalize('NFC').toLocaleLowerCase('en-US');
}

export function isSensitiveWorkspaceFilename(path: string): boolean {
  const normalized = path.trim().replace(/\\/g, '/').normalize('NFC').toLowerCase();
  const basename = normalized.split('/').pop() ?? normalized;
  if (basename === '.env.example') return false;
  if (SENSITIVE_BASENAMES.has(basename)) return true;
  if (basename.startsWith('.env.')) return true;
  if (/^(?:firebase|google|gcp)[-_].*(?:admin|credential|service[-_]?account).*\.json$/i.test(basename)) return true;
  if (/^(?:id_rsa|id_ed25519)(?:\..+)?$/i.test(basename)) return true;
  return /\.(?:pem|key|p12|pfx|jks|keystore)$/.test(basename);
}

export function containsLikelyWorkspaceSecret(content: string): boolean {
  return LIKELY_SECRET_PATTERNS.some((pattern) => pattern.test(content));
}

function validIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function plausibleIsoDate(value: unknown, nowMs: number): value is string {
  if (!validIsoDate(value)) return false;
  return Date.parse(value) <= nowMs + MAX_FUTURE_CLOCK_SKEW_MS;
}

function validTextContent(value: string): boolean {
  return !value.includes('\0');
}

function validValidationMetadata(stored: LabDraft, nowMs: number): boolean {
  const hasValidationTimestamp = stored.lastValidatedAt !== undefined;
  const hasCriteria = stored.passedCriteria !== undefined;
  if (!hasValidationTimestamp && !hasCriteria) return true;
  if (!plausibleIsoDate(stored.lastValidatedAt, nowMs) || !Array.isArray(stored.passedCriteria)) return false;
  if (!validIsoDate(stored.updatedAt) || Date.parse(stored.lastValidatedAt) < Date.parse(stored.updatedAt)) return false;
  if (stored.passedCriteria.length > MAX_VALIDATION_CRITERIA) return false;
  return stored.passedCriteria.every((criterion) => {
    if (typeof criterion !== 'string') return false;
    const normalized = criterion.trim();
    return normalized.length > 0 && normalized.length <= MAX_VALIDATION_CRITERION_CHARS;
  });
}

export function restoreWorkspaceDraft({
  stored,
  expectedMissionId,
  expectedLanguage,
  fallbackFiles,
}: {
  stored?: LabDraft;
  expectedMissionId: string;
  expectedLanguage: string;
  fallbackFiles: Record<string, string>;
}): { draft: LabDraft; repaired: boolean } {
  const now = new Date();
  const nowMs = now.getTime();
  const fallbackNames = Object.keys(fallbackFiles);
  const fallbackActive = fallbackNames[0] ?? 'main.txt';
  const fresh = (): LabDraft => ({
    missionId: expectedMissionId,
    language: expectedLanguage,
    files: fallbackFiles,
    activeFile: fallbackActive,
    updatedAt: now.toISOString(),
  });

  if (!stored || (stored.missionId && stored.missionId !== expectedMissionId)) {
    return { draft: fresh(), repaired: Boolean(stored) };
  }

  const source = stored.files && typeof stored.files === 'object' && !Array.isArray(stored.files) ? stored.files : {};
  const files: Record<string, string> = {};
  const collisionKeys = new Set<string>();
  let totalChars = 0;
  let repaired = false;

  for (const [rawName, rawContent] of Object.entries(source).slice(0, MAX_RESTORED_FILES)) {
    const normalizedName = canonicalWorkspacePath(rawName);
    if (
      typeof rawContent !== 'string'
      || !normalizedName
      || isSensitiveWorkspaceFilename(normalizedName)
      || !validTextContent(rawContent)
      || containsLikelyWorkspaceSecret(rawContent)
    ) {
      repaired = true;
      continue;
    }
    if (rawContent.length > MAX_RESTORED_FILE_CHARS || totalChars + rawContent.length > MAX_RESTORED_WORKSPACE_CHARS) {
      repaired = true;
      continue;
    }
    const collisionKey = workspaceCollisionKey(normalizedName);
    if (collisionKeys.has(collisionKey)) {
      repaired = true;
      continue;
    }
    if (normalizedName !== rawName) repaired = true;
    collisionKeys.add(collisionKey);
    files[normalizedName] = rawContent;
    totalChars += rawContent.length;
  }

  if (Object.keys(source).length > MAX_RESTORED_FILES) repaired = true;
  const filenames = Object.keys(files);
  if (!filenames.length) return { draft: fresh(), repaired: true };

  const normalizedActiveFile = typeof stored.activeFile === 'string' ? canonicalWorkspacePath(stored.activeFile) : null;
  const activeFileKey = normalizedActiveFile ? workspaceCollisionKey(normalizedActiveFile) : null;
  const activeFile = activeFileKey
    ? filenames.find((filename) => workspaceCollisionKey(filename) === activeFileKey) ?? filenames[0]!
    : filenames[0]!;
  if (activeFile !== stored.activeFile) repaired = true;
  if (stored.language !== expectedLanguage || stored.missionId !== expectedMissionId) repaired = true;
  if (!plausibleIsoDate(stored.updatedAt, nowMs)) repaired = true;
  if (!validValidationMetadata(stored, nowMs)) repaired = true;

  return {
    repaired,
    draft: {
      ...stored,
      missionId: expectedMissionId,
      language: expectedLanguage,
      files,
      activeFile,
      updatedAt: repaired || !plausibleIsoDate(stored.updatedAt, nowMs) ? now.toISOString() : stored.updatedAt,
      lastValidatedAt: repaired ? undefined : stored.lastValidatedAt,
      passedCriteria: repaired ? [] : stored.passedCriteria,
    },
  };
}
