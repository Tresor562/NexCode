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

function safePath(path: string): boolean {
  const normalized = path.trim().replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || normalized.includes('\0')) return false;
  const segments = normalized.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..' || /[\u0000-\u001f\u007f]/.test(segment))) return false;
  return true;
}

export function isSensitiveWorkspaceFilename(path: string): boolean {
  const normalized = path.trim().replace(/\\/g, '/').toLowerCase();
  const basename = normalized.split('/').pop() ?? normalized;
  if (basename === '.env.example') return false;
  if (SENSITIVE_BASENAMES.has(basename)) return true;
  if (basename.startsWith('.env.')) return true;
  return /\.(?:pem|key|p12|pfx|jks|keystore)$/.test(basename);
}

function validIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
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
  let totalChars = 0;
  let repaired = false;

  for (const [rawName, rawContent] of Object.entries(source).slice(0, MAX_RESTORED_FILES)) {
    if (typeof rawContent !== 'string' || !safePath(rawName) || isSensitiveWorkspaceFilename(rawName)) {
      repaired = true;
      continue;
    }
    if (rawContent.length > MAX_RESTORED_FILE_CHARS || totalChars + rawContent.length > MAX_RESTORED_WORKSPACE_CHARS) {
      repaired = true;
      continue;
    }
    files[rawName] = rawContent;
    totalChars += rawContent.length;
  }

  if (Object.keys(source).length > MAX_RESTORED_FILES) repaired = true;
  const filenames = Object.keys(files);
  if (!filenames.length) return { draft: fresh(), repaired: true };

  const activeFile = filenames.includes(stored.activeFile) ? stored.activeFile : filenames[0]!;
  if (activeFile !== stored.activeFile) repaired = true;
  if (stored.language !== expectedLanguage || stored.missionId !== expectedMissionId) repaired = true;
  if (!validIsoDate(stored.updatedAt)) repaired = true;

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
