import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/learning/labEngine.ts', import.meta.url), 'utf8');
const fail = (message) => { throw new Error(`[lab-file-lifecycle] ${message}`); };

if (!source.includes('export function renameLabFile')) fail('renameLabFile must remain exported.');
if (!source.includes('const existingFilename = resolveEditableLabFilename(draft, filename);')) fail('rename/remove must resolve filenames through the portable workspace policy.');
if (!source.includes('const safeNext = canonicalWorkspacePath(nextFilename);')) fail('renames must canonicalize their destination path.');
if (!source.includes('isSensitiveWorkspaceFilename(safeNext)')) fail('renames must reject sensitive destinations.');
if (!source.includes('workspaceCollisionKey(existing) === nextKey')) fail('renames must prevent case/Unicode portable collisions.');
if (!source.includes('draft.activeFile === existingFilename ? safeNext : draft.activeFile')) fail('renames must keep the active editor on the renamed file.');
if (!source.includes('if (names.length <= 1) return draft;')) fail('removal must preserve at least one editable file.');
if (!source.includes('delete files[existingFilename];')) fail('removal must delete the resolved canonical file rather than the untrusted request string.');
if (!source.includes('return invalidateLabValidation({ ...draft, files, activeFile')) fail('file lifecycle mutations must invalidate stale validation evidence.');

console.log('Lab file lifecycle audit passed.');
