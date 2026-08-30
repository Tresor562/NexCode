import { LabMission } from '../data/curriculumCore';
import { LabDraft } from '../lib/localState';

export type BehavioralTest = {
  id: string;
  label: string;
  hidden?: boolean;
  run: (draft: LabDraft) => boolean;
};

export type BehavioralSuiteResult = {
  passed: boolean;
  visible: Array<{ id: string; label: string; passed: boolean }>;
  hiddenPassed: number;
  hiddenTotal: number;
  hint?: string;
};

const secretPatterns = [
  /(?:bot[_-]?token|api[_-]?key|client[_-]?secret|private[_-]?key)\s*[=:]\s*["']?(?!replace|example|test|your|changeme)[A-Za-z0-9_\-.]{12,}/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];

function normalizeSource(content: string): string {
  return content
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n+$/g, '');
}

function hasMeaningfulStarterDelta(mission: LabMission, draft: LabDraft): boolean {
  const starterFiles = mission.starterFiles ?? {};
  const starterEntries = Object.entries(starterFiles);

  if (starterEntries.length) {
    const starterNames = new Set(starterEntries.map(([filename]) => filename));
    const changedStarterFile = starterEntries.some(([filename, starterContent]) => (
      normalizeSource(draft.files[filename] ?? '') !== normalizeSource(starterContent)
    ));
    if (changedStarterFile) return true;

    return Object.entries(draft.files).some(([filename, content]) => (
      !starterNames.has(filename) && normalizeSource(content).trim().length > 0
    ));
  }

  const starterCode = mission.starterCode;
  if (typeof starterCode === 'string' && starterCode.length) {
    const normalizedStarter = normalizeSource(starterCode);
    const substantiveFiles = Object.values(draft.files)
      .map(normalizeSource)
      .filter((content) => content.trim().length > 0);
    if (!substantiveFiles.length) return false;
    if (substantiveFiles.length === 1) return substantiveFiles[0] !== normalizedStarter;
    return substantiveFiles.some((content) => content !== normalizedStarter);
  }

  return Object.values(draft.files).join('\n').trim().length >= 60;
}

export function secretSafetyIssues(draft: LabDraft) {
  const issues: string[] = [];
  for (const [filename, content] of Object.entries(draft.files)) {
    for (const pattern of secretPatterns) {
      if (pattern.test(content)) issues.push(`${filename}: secret potentiel détecté`);
    }
  }
  return issues;
}

export function defaultBehavioralTests(mission: LabMission): BehavioralTest[] {
  const language = mission.language;
  const tests: BehavioralTest[] = [
    {
      id: 'no-real-secret',
      label: 'Aucun token, secret ou clé privée évident dans les fichiers',
      run: (draft) => secretSafetyIssues(draft).length === 0,
    },
    {
      id: 'non-empty-work',
      label: 'Le workspace contient un travail non vide et explicable',
      run: (draft) => Object.values(draft.files).some((content) => content.trim().length >= 20),
    },
    {
      id: 'starter-delta',
      label: 'Le travail contient une modification réelle par rapport au code de départ',
      hidden: true,
      run: (draft) => hasMeaningfulStarterDelta(mission, draft),
    },
  ];
  if (language === 'HTML/CSS') {
    tests.push(
      { id: 'html-structure', label: 'Le document contient une structure HTML', run: (draft) => /<\w+[^>]*>[\s\S]*<\/\w+>/i.test(draft.files['index.html'] ?? '') },
      { id: 'css-rule', label: 'Au moins une règle CSS est présente', run: (draft) => /[^{}]+\{[^}]+\}/.test(draft.files['styles.css'] ?? '') },
    );
  } else if (language === 'JavaScript') {
    tests.push({ id: 'js-logic', label: 'Le code contient une déclaration ou une fonction', run: (draft) => /\b(const|let|var|function|class)\b/.test(Object.values(draft.files).join('\n')) });
  } else if (language === 'Python') {
    tests.push({ id: 'py-statement', label: 'Le code contient une instruction Python structurée', run: (draft) => /^(\s*)(def|class|if|for|while|print|[A-Za-z_]\w*\s*=)/m.test(Object.values(draft.files).join('\n')) });
  } else if (language === 'SQL') {
    tests.push({ id: 'sql-operation', label: 'Une opération SQL cohérente est présente', run: (draft) => /\b(select|insert|update|delete|create)\b/i.test(Object.values(draft.files).join('\n')) });
  } else if (language === 'Git') {
    tests.push({ id: 'git-command', label: 'Au moins une commande Git pertinente est présente', run: (draft) => /^\s*git\s+(status|add|commit|branch|switch|merge|rebase|log|diff|restore|reset)\b/m.test(Object.values(draft.files).join('\n')) });
  } else if (language === 'Node/API') {
    tests.push({ id: 'api-shape', label: 'Le workspace contient une structure de serveur ou de route', run: (draft) => /(express|http|listen\s*\(|req\b|res\b|request|response)/i.test(Object.values(draft.files).join('\n')) });
  } else if (language === 'Bots') {
    tests.push({ id: 'bot-event', label: 'Le bot traite un événement, une commande ou un message', run: (draft) => /(message|update|interaction|command|handler|reply|send|client\.|bot\.)/i.test(Object.values(draft.files).join('\n')) });
  }
  return tests;
}

export function runBehavioralSuite(mission: LabMission, draft: LabDraft, attempts = 0): BehavioralSuiteResult {
  const tests = defaultBehavioralTests(mission);
  const results = tests.map((test) => ({ test, passed: test.run(draft) }));
  const visible = results.filter(({ test }) => !test.hidden).map(({ test, passed }) => ({ id: test.id, label: test.label, passed }));
  const hidden = results.filter(({ test }) => test.hidden);
  const failedVisible = visible.find((item) => !item.passed);
  const hint = attempts < 2 || !failedVisible
    ? undefined
    : `Indice : concentre-toi sur « ${failedVisible.label} » sans recopier une solution complète.`;
  return {
    passed: results.every((item) => item.passed),
    visible,
    hiddenPassed: hidden.filter((item) => item.passed).length,
    hiddenTotal: hidden.length,
    hint,
  };
}
