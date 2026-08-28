import type { LabDraft } from './localState';

const SENSITIVE_BASENAMES = new Set([
  '.env',
  '.npmrc',
  '.pypirc',
  '.netrc',
  'id_rsa',
  'id_ed25519',
  'credentials',
  'credentials.json',
  'service-account.json',
  'service_account.json',
]);

const MAX_RESTORED_FILE_CHARS = 1_500_000;
const MAX_RESTORED_WORKSPACE_CHARS = 5_000_000;
const MAX_RESTORED_FILES = 300;

function canonicalWorkspacePath(path: string): string | null {
  const normalized = path.trim().replace(/\\/g, '/').normalize('NFC');
  if (!normalized || normalized.startsWith('/') || normalized.includes('\0')) return null;
  const segments = normalized.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..' || /[\u0000-\u001f\u007f]/.test(segment))) return null;
  return normalized;
}

function workspaceCollisionKey(path: string): string {
  return path.normalize('NFC').toLocaleLowerCase('en-US');
}

export function isSensitiveWorkspaceFilename(path: string): boolean {
  const normalized = path.trim().replace(/\\/g, '/').normalize('NFC').toLowerCase();
  const basename = normalized.split('/').pop() ?? normalized;
  if (basename === '.env.example') return false;
  if (SENSITIVE_BASENAMES.has(basename)) return true;
  if (basename.startsWith('.env.')) return true;
  return /\.(?:pem|key|p12|pfx|jks|keystore)$/.test(basename);
}

function validIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function validTextContent(value: string): boolean {
  return !value.includes('\0');
}

function validValidationMetadata(stored: LabDraft): boolean {
  const hasValidationTimestamp = stored.lastValidatedAt !== undefined;
  const hasCriteria = stored.passedCriteria !== undefined;
  if (!hasValidationTimestamp && !hasCriteria) return true;
  if (!validIsoDate(stored.lastValidatedAt) || !Array.isArray(stored.passedCriteria)) return false;
  return stored.passedCriteria.every((criterion) => typeof criterion === 'string' && criterion.trim().length > 0);
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
  const fallbackNames = Object.keys(fallbackFiles);
  const fallbackActive = fallbackNames[0] ?? 'main.txt';
  const fresh = (): LabDraft => ({
    missionId: expectedMissionId,
    language: expectedLanguage,
    files: fallbackFiles,
    activeFile: fallbackActive,
    updatedAt: new Date().toISOString(),
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
  if (!validIsoDate(stored.updatedAt)) repaired = true;
  if (!validValidationMetadata(stored)) repaired = true;

  return {
    repaired,
    draft: {
      ...stored,
      missionId: expectedMissionId,
      language: expectedLanguage,
      files,
      activeFile,
      updatedAt: repaired || !validIsoDate(stored.updatedAt) ? new Date().toISOString() : stored.updatedAt,
      lastValidatedAt: repaired ? undefined : stored.lastValidatedAt,
      passedCriteria: repaired ? [] : stored.passedCriteria,
    },
  };
}
