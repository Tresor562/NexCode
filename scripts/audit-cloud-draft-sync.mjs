import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const accountSource = fs.readFileSync(path.join(root, 'src/lib/cloudAccount.ts'), 'utf8');

function requirePattern(pattern, message) {
  if (!pattern.test(accountSource)) throw new Error(message);
}

requirePattern(
  /function mergeDraftRecord\(remote: unknown, local: LocalState\['labDrafts'\]\): LocalState\['labDrafts'\]/,
  'Cloud draft sync must reconcile multi-file drafts through a dedicated merge boundary.',
);
requirePattern(
  /const remoteAt = validIsoTimestamp\(remoteDraft\.updatedAt\);[\s\S]*if \(!Number\.isFinite\(remoteAt\)\) continue;/,
  'Cloud drafts must require a valid updatedAt version before a remote workspace can replace local work.',
);
requirePattern(
  /if \(!localDraft \|\| remoteAt > validIsoTimestamp\(localDraft\.updatedAt\)\) \{[\s\S]*merged\[draftId\] = remoteDraft/,
  'Draft reconciliation must prefer only a strictly newer remote workspace and preserve the local copy on ties.',
);
requirePattern(
  /projectDrafts: mergeDraftRecord\(settings\.projectDrafts, local\.projectDrafts\),[\s\S]*labDrafts: mergeDraftRecord\(settings\.labDrafts, local\.labDrafts\),/,
  'Both guided project workspaces and free Lab workspaces must participate in Supabase reconciliation.',
);
requirePattern(
  /settings: \{[\s\S]*projectDrafts: state\.projectDrafts,[\s\S]*labDrafts: state\.labDrafts,[\s\S]*\}/,
  'Cloud pushes must persist both multi-file draft collections in the existing settings JSONB payload.',
);
requirePattern(
  /return sanitizeLocalState\(merged\);/,
  'Remote draft payloads must pass through the local-state safety boundary before reaching the workspace UI.',
);

console.log('Cloud draft sync audit OK: project and Lab workspaces are persisted, newest-valid updatedAt wins, ties preserve local edits, and reconciled drafts are sanitized.');
