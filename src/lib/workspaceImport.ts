import { Directory, File } from 'expo-file-system';

const TEXT_EXTENSIONS = new Set([
  'html','htm','css','scss','sass','less','js','jsx','mjs','cjs','ts','tsx','json','py','sql','md','txt','xml','yaml','yml','toml','ini','sh','bash','ps1','java','kt','kts','c','h','cpp','hpp','cs','go','rs','php','rb','dart','swift','vue','svelte','graphql','gql','csv','gitignore','dockerfile',
]);
const IGNORED_DIRECTORIES = new Set([
  '.git','.hg','.svn','node_modules','vendor','dist','build','.next','.expo','.turbo','.cache','coverage','pods','deriveddata',
]);
const SENSITIVE_BASENAMES = new Set([
  '.env','.npmrc','.pypirc','.netrc','id_rsa','id_ed25519','credentials','credentials.json','service-account.json','service_account.json',
]);
const MAX_TEXT_BYTES = 1_500_000;
const MAX_TEXT_CHARS = 1_500_000;
const MAX_TOTAL_TEXT_CHARS = 5_000_000;
const MAX_FILES_PER_WORKSPACE = 300;
const MAX_DEPTH = 10;

export type WorkspaceImportResult = {
  files: Record<string, string>;
  imported: number;
  skipped: number;
  renamed: number;
};

function extension(name: string) {
  const lower = name.toLowerCase();
  if (lower === 'dockerfile' || lower === '.gitignore') return lower.replace(/^\./, '');
  const index = lower.lastIndexOf('.');
  return index >= 0 ? lower.slice(index + 1) : lower;
}

function isSensitiveName(name: string) {
  const lower = name.trim().toLowerCase();
  if (SENSITIVE_BASENAMES.has(lower)) return true;
  if (lower.startsWith('.env.')) return true;
  if (/\.(?:pem|key|p12|pfx|jks|keystore)$/i.test(lower)) return true;
  return false;
}

function isSafeSegment(name: string) {
  if (!name || name === '.' || name === '..') return false;
  if (name.includes('/') || name.includes('\\')) return false;
  return !/[\u0000-\u001f\u007f]/.test(name);
}

function canReadAsText(file: File) {
  const size = typeof file.size === 'number' ? file.size : 0;
  return size <= MAX_TEXT_BYTES && isSafeSegment(file.name) && !isSensitiveName(file.name) && TEXT_EXTENSIONS.has(extension(file.name));
}

function uniquePath(path: string, occupied: Set<string>) {
  if (!occupied.has(path)) return { path, renamed: false };
  const slash = path.lastIndexOf('/');
  const folder = slash >= 0 ? path.slice(0, slash + 1) : '';
  const name = slash >= 0 ? path.slice(slash + 1) : path;
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let counter = 2;
  while (occupied.has(`${folder}${stem} (${counter})${ext}`)) counter += 1;
  return { path: `${folder}${stem} (${counter})${ext}`, renamed: true };
}

async function readTextFile(file: File) {
  const text = await file.text();
  if (text.length > MAX_TEXT_CHARS || text.includes('\0')) return null;
  return text;
}

function workspaceUsage(existing: Record<string, string>) {
  const entries = Object.entries(existing);
  return {
    files: entries.length,
    chars: entries.reduce((total, [, content]) => total + (typeof content === 'string' ? content.length : 0), 0),
  };
}

export async function importFilesFromPhone(existing: Record<string, string>): Promise<WorkspaceImportResult> {
  const picked = await File.pickFileAsync({ multipleFiles: true });
  if (picked.canceled) return { files: existing, imported: 0, skipped: 0, renamed: 0 };
  const occupied = new Set(Object.keys(existing));
  const next = { ...existing };
  const usage = workspaceUsage(existing);
  let imported = 0;
  let skipped = 0;
  let renamed = 0;
  let workspaceChars = usage.chars;
  let workspaceFiles = usage.files;

  for (const file of picked.result) {
    if (workspaceFiles >= MAX_FILES_PER_WORKSPACE || workspaceChars >= MAX_TOTAL_TEXT_CHARS) {
      skipped += 1;
      continue;
    }
    if (!canReadAsText(file)) { skipped += 1; continue; }
    try {
      const text = await readTextFile(file);
      if (text === null || workspaceChars + text.length > MAX_TOTAL_TEXT_CHARS) { skipped += 1; continue; }
      const resolved = uniquePath(file.name, occupied);
      next[resolved.path] = text;
      occupied.add(resolved.path);
      workspaceChars += text.length;
      workspaceFiles += 1;
      imported += 1;
      if (resolved.renamed) renamed += 1;
    } catch {
      skipped += 1;
    }
  }
  return { files: next, imported, skipped, renamed };
}

export async function importFolderFromPhone(existing: Record<string, string>): Promise<WorkspaceImportResult> {
  const picker = Directory as unknown as { pickDirectoryAsync: () => Promise<Directory> };
  let root: Directory;
  try {
    root = await picker.pickDirectoryAsync();
  } catch {
    return { files: existing, imported: 0, skipped: 0, renamed: 0 };
  }
  const occupied = new Set(Object.keys(existing));
  const next = { ...existing };
  const usage = workspaceUsage(existing);
  let imported = 0;
  let skipped = 0;
  let renamed = 0;
  let workspaceChars = usage.chars;
  let workspaceFiles = usage.files;

  async function walk(directory: Directory, prefix: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH || workspaceFiles >= MAX_FILES_PER_WORKSPACE || workspaceChars >= MAX_TOTAL_TEXT_CHARS) return;
    const entries = directory.list();
    for (const entry of entries) {
      if (workspaceFiles >= MAX_FILES_PER_WORKSPACE || workspaceChars >= MAX_TOTAL_TEXT_CHARS) break;
      if (entry instanceof Directory) {
        if (!isSafeSegment(entry.name) || IGNORED_DIRECTORIES.has(entry.name.toLowerCase())) continue;
        await walk(entry, `${prefix}${entry.name}/`, depth + 1);
        continue;
      }
      if (!canReadAsText(entry)) { skipped += 1; continue; }
      try {
        const text = await readTextFile(entry);
        if (text === null || workspaceChars + text.length > MAX_TOTAL_TEXT_CHARS) { skipped += 1; continue; }
        const resolved = uniquePath(`${prefix}${entry.name}`, occupied);
        next[resolved.path] = text;
        occupied.add(resolved.path);
        workspaceChars += text.length;
        workspaceFiles += 1;
        imported += 1;
        if (resolved.renamed) renamed += 1;
      } catch {
        skipped += 1;
      }
    }
  }

  await walk(root, '', 0);
  return { files: next, imported, skipped, renamed };
}
