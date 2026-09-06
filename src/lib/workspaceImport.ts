import { Directory, File } from 'expo-file-system';
import {
  canonicalWorkspacePath,
  containsLikelyWorkspaceSecret,
  isSensitiveWorkspaceFilename,
  workspaceCollisionKey,
} from './workspaceSafety';

const TEXT_EXTENSIONS = new Set([
  'html','htm','css','scss','sass','less','js','jsx','mjs','cjs','ts','tsx','json','py','sql','md','txt','xml','yaml','yml','toml','ini','sh','bash','ps1','java','kt','kts','c','h','cpp','hpp','cs','go','rs','php','rb','dart','swift','vue','svelte','graphql','gql','csv','gitignore','dockerfile',
]);
const IGNORED_DIRECTORIES = new Set([
  '.git','.hg','.svn','node_modules','vendor','dist','build','.next','.expo','.turbo','.cache','coverage','pods','deriveddata',
]);
const SENSITIVE_DIRECTORIES = new Set([
  '.ssh','.aws','.gnupg','.azure','.kube','.docker','.gcloud',
]);
const MAX_TEXT_BYTES = 1_500_000;
const MAX_TEXT_CHARS = 1_500_000;
const MAX_TOTAL_TEXT_CHARS = 5_000_000;
const MAX_FILES_PER_WORKSPACE = 300;
const MAX_DEPTH = 10;
const MAX_COLLISION_RENAMES = 10_000;

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

function isSafeSegment(name: string) {
  if (!name || name === '.' || name === '..') return false;
  if (name.includes('/') || name.includes('\\')) return false;
  return !/[\u0000-\u001f\u007f]/.test(name);
}

function shouldSkipDirectory(name: string) {
  if (!isSafeSegment(name)) return true;
  const normalized = name.toLowerCase();
  return IGNORED_DIRECTORIES.has(normalized) || SENSITIVE_DIRECTORIES.has(normalized);
}

function canReadAsText(file: File) {
  const size = typeof file.size === 'number' ? file.size : 0;
  return size <= MAX_TEXT_BYTES && isSafeSegment(file.name) && !isSensitiveWorkspaceFilename(file.name) && TEXT_EXTENSIONS.has(extension(file.name));
}

function occupiedWorkspaceKeys(existing: Record<string, string>) {
  const occupied = new Set<string>();
  for (const rawPath of Object.keys(existing)) {
    const canonical = canonicalWorkspacePath(rawPath);
    if (canonical) occupied.add(workspaceCollisionKey(canonical));
  }
  return occupied;
}

function uniquePath(path: string, occupied: Set<string>) {
  const canonical = canonicalWorkspacePath(path);
  if (!canonical) return null;
  if (!occupied.has(workspaceCollisionKey(canonical))) return { path: canonical, renamed: canonical !== path };
  const slash = canonical.lastIndexOf('/');
  const folder = slash >= 0 ? canonical.slice(0, slash + 1) : '';
  const name = slash >= 0 ? canonical.slice(slash + 1) : canonical;
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';

  for (let counter = 2; counter <= MAX_COLLISION_RENAMES; counter += 1) {
    const suffix = ` (${counter})`;
    let candidateStem = stem;
    let candidate = canonicalWorkspacePath(`${folder}${candidateStem}${suffix}${ext}`);

    // A source path can sit exactly on the portable path/segment boundary. Adding
    // a collision suffix must never create a filename that the workspace would
    // later reject on restore. Trim only the stem, preserving folder and extension,
    // until the canonical policy accepts the renamed import.
    while (!candidate && candidateStem.length > 1) {
      candidateStem = candidateStem.slice(0, -1);
      candidate = canonicalWorkspacePath(`${folder}${candidateStem}${suffix}${ext}`);
    }

    if (!candidate) return null;
    if (!occupied.has(workspaceCollisionKey(candidate))) return { path: candidate, renamed: true };
  }

  return null;
}

async function readTextFile(file: File) {
  const text = await file.text();
  if (text.length > MAX_TEXT_CHARS || text.includes('\0') || containsLikelyWorkspaceSecret(text)) return null;
  return text;
}

function workspaceUsage(existing: Record<string, string>) {
  const entries = Object.entries(existing);
  return {
    files: entries.length,
    chars: entries.reduce((total, [, content]) => total + (typeof content === 'string' ? content.length : 0), 0),
  };
}

function safeDirectoryEntries(directory: Directory): Array<Directory | File> | null {
  try {
    return directory.list();
  } catch {
    // Android document providers can revoke access or fail on a single nested
    // directory while the rest of the selected project remains readable. Treat
    // that subtree as skipped instead of rejecting the entire project import and
    // discarding files that were already read successfully.
    return null;
  }
}

export async function importFilesFromPhone(existing: Record<string, string>): Promise<WorkspaceImportResult> {
  const picked = await File.pickFileAsync({ multipleFiles: true });
  if (picked.canceled) return { files: existing, imported: 0, skipped: 0, renamed: 0 };
  const occupied = occupiedWorkspaceKeys(existing);
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
      if (!resolved) { skipped += 1; continue; }
      next[resolved.path] = text;
      occupied.add(workspaceCollisionKey(resolved.path));
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
  if (shouldSkipDirectory(root.name)) {
    return { files: existing, imported: 0, skipped: 1, renamed: 0 };
  }
  const occupied = occupiedWorkspaceKeys(existing);
  const next = { ...existing };
  const usage = workspaceUsage(existing);
  let imported = 0;
  let skipped = 0;
  let renamed = 0;
  let workspaceChars = usage.chars;
  let workspaceFiles = usage.files;

  async function walk(directory: Directory, prefix: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH || workspaceFiles >= MAX_FILES_PER_WORKSPACE || workspaceChars >= MAX_TOTAL_TEXT_CHARS) return;
    const entries = safeDirectoryEntries(directory);
    if (!entries) {
      skipped += 1;
      return;
    }
    for (const entry of entries) {
      if (workspaceFiles >= MAX_FILES_PER_WORKSPACE || workspaceChars >= MAX_TOTAL_TEXT_CHARS) break;
      if (entry instanceof Directory) {
        if (shouldSkipDirectory(entry.name)) continue;
        await walk(entry, `${prefix}${entry.name}/`, depth + 1);
        continue;
      }
      if (!canReadAsText(entry)) { skipped += 1; continue; }
      try {
        const text = await readTextFile(entry);
        if (text === null || workspaceChars + text.length > MAX_TOTAL_TEXT_CHARS) { skipped += 1; continue; }
        const resolved = uniquePath(`${prefix}${entry.name}`, occupied);
        if (!resolved) { skipped += 1; continue; }
        next[resolved.path] = text;
        occupied.add(workspaceCollisionKey(resolved.path));
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
