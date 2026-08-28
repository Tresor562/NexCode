import fs from 'node:fs';

const source = fs.readFileSync('src/ui/ProjectPortfolioScreen.tsx', 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`✗ ${message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`✓ ${message}`);
}

assert(
  source.includes("const hasWorkspace = Boolean(state.projectDrafts[project.id]);"),
  'project detail derives progression eligibility from a persisted workspace',
);

assert(
  source.includes("disabled={progress>=100 || !hasWorkspace}"),
  'project steps cannot advance before a workspace has been saved',
);

assert(
  source.includes("label={progress>=100?'Construction terminée ✓':hasWorkspace?'Étape terminée':'Coder avant de valider'}"),
  'the blocked progression state gives the learner an explicit next action',
);

assert(
  source.includes('La progression et les récompenses doivent correspondre à du travail réel.'),
  'the project flow explains why progression is evidence-gated',
);

assert(
  source.includes('onPress={() => onProgress(project, nextProgress)}'),
  'workspace gating preserves the existing step progression callback',
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