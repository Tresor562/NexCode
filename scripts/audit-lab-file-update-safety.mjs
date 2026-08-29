import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const enginePath = path.join(root, 'src/learning/labEngine.ts');
const source = fs.readFileSync(enginePath, 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  source.includes('function resolveEditableLabFilename'),
  'Lab file updates must resolve an existing canonical workspace filename before writing.',
);
assert(
  source.includes('canonicalWorkspacePath(filename)'),
  'Lab file updates must canonicalize the requested workspace path.',
);
assert(
  source.includes('isSensitiveWorkspaceFilename(safe)'),
  'Lab file updates must reject sensitive workspace filenames.',
);
assert(
  source.includes('workspaceCollisionKey(existing) === collisionKey'),
  'Lab file updates must resolve portable case/Unicode-equivalent filenames consistently.',
);
assert(
  source.includes('const existingFilename = resolveEditableLabFilename(draft, filename);') &&
    source.includes('if (!existingFilename) return draft;'),
  'updateLabFile must refuse unknown filenames instead of implicitly creating files.',
);
assert(
  source.includes('files: { ...draft.files, [existingFilename]: content }') &&
    source.includes('activeFile: existingFilename'),
  'updateLabFile must write only to the resolved existing workspace filename.',
);

const updateBody = source.match(/export function updateLabFile[\s\S]*?\n}\n\nexport function addLabFile/)?.[0] ?? '';
assert(
  !updateBody.includes('[filename]: content'),
  'updateLabFile must never write directly under the untrusted requested filename.',
);

console.log('✓ Lab file update safety audit passed');
