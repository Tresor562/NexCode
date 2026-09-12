import fs from 'node:fs';

const source = fs.readFileSync('src/ui/ProjectPortfolioScreen.tsx', 'utf8');
const workspaceSource = fs.readFileSync('src/ui/ProjectWorkspaceScreen.tsx', 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`✗ ${message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`✓ ${message}`);
}

assert(
  source.includes('const projectDraft = state.projectDrafts[project.id];') &&
    source.includes('const hasWorkspace = Boolean(projectDraft);'),
  'project detail derives progression eligibility from the persisted project workspace',
);

assert(
  source.includes('function hasFreshProjectWork(draft?: LabDraft): boolean') &&
    source.includes('updatedAt > lastValidatedAt'),
  'project progression requires workspace work newer than the last validated milestone',
);

assert(
  source.includes('if (!projectDraft || progress >= 100 || !hasFreshWork) return;'),
  'project step mutation fails closed without fresh persisted workspace work',
);

assert(
  source.includes('onSaveProjectDraft(project, { ...projectDraft, lastValidatedAt: validatedAt });') &&
    source.includes('onProgress(project, nextProgress);'),
  'successful milestone validation consumes the current workspace evidence before advancing progress',
);

assert(
  source.includes('disabled={progress>=100 || !hasFreshWork}'),
  'project steps cannot advance before fresh workspace work has been saved',
);

assert(
  source.includes("label={progress>=100?'Construction terminée ✓':hasFreshWork?'Étape terminée':hasWorkspace?'Modifie le code pour continuer':'Coder avant de valider'}"),
  'the blocked progression state gives the learner an explicit next action',
);

assert(
  source.includes('Une même sauvegarde ne peut plus débloquer plusieurs étapes.'),
  'the project flow explains why every milestone needs fresh workspace evidence',
);

assert(
  source.includes('La progression et les récompenses doivent correspondre à du travail réel.'),
  'the project flow explains why progression is evidence-gated',
);

assert(
  workspaceSource.includes('save({ ...draft, activeFile: filename });') &&
    !workspaceSource.includes('save({ ...draft, activeFile: filename, updatedAt: new Date().toISOString() });'),
  'switching project files preserves the evidence timestamp instead of faking fresh learner work',
);

assert(
  workspaceSource.includes('files: { ...draft.files, [draft.activeFile]: value }, updatedAt: new Date().toISOString()'),
  'editing project content still records fresh workspace evidence',
);

assert(
  source.includes('if (!hasWorkspace || progress < 100 || !review.passed || existingProof) return;'),
  'portfolio proof creation rechecks every evidence prerequisite at the mutation boundary',
);

assert(
  source.includes('disabled={!hasWorkspace || !review.passed || progress < 100 || Boolean(existingProof)}'),
  'portfolio publishing stays blocked when its backing workspace is missing',
);

assert(
  source.includes('Le portfolio exige aussi un workspace sauvegardé'),
  'the portfolio review tells the learner how to repair missing workspace evidence',
);

if (process.exitCode) {
  throw new Error('Project workspace gating audit failed.');
}
