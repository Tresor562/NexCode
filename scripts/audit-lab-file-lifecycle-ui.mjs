import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/ui/LabWorkspaceScreen.tsx', import.meta.url), 'utf8');
const fail = (message) => { throw new Error(`[lab-file-lifecycle-ui] ${message}`); };

for (const symbol of ['addLabFile', 'renameLabFile', 'removeLabFile']) {
  if (!source.includes(symbol)) fail(`Lab UI must use ${symbol}.`);
}
if (!source.includes('function commitFileEdit()')) fail('Lab UI must expose a single guarded create/rename commit path.');
if (!source.includes('function deleteFile(filename: string)')) fail('Lab UI must expose guarded file deletion.');
if (!source.includes('next === draft')) fail('Rejected lifecycle mutations must be surfaced instead of pretending they succeeded.');
if (!source.includes('setValidated(false)')) fail('Lifecycle mutations must clear UI validation state.');
if (!source.includes('accessibilityLabel={`Renommer ${filename}`}')) fail('Rename controls must stay discoverable to assistive technology.');
if (!source.includes('accessibilityLabel={`Supprimer ${filename}`}')) fail('Delete controls must stay discoverable to assistive technology.');
if (!source.includes('Chemins imbriqués acceptés.')) fail('The file editor must explain portable nested-path behavior.');
if (!source.includes('Le Lab doit conserver au moins un fichier éditable.')) fail('The UI must explain the last-file deletion guard.');

console.log('Lab file lifecycle UI audit passed.');
