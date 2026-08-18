export type PracticeLanguage = 'HTML/CSS' | 'JavaScript' | 'Python' | 'SQL';

export function checkPractice(language: PracticeLanguage, source: string): string {
  const normalized = source.toLowerCase().replace(/\s+/g, ' ').trim();

  if (!source.trim()) return 'Écris une réponse avant de lancer la vérification.';

  if (language === 'HTML/CSS') {
    const hasMarkup = /<(h1|main|section|p|div|button)[\s>]/i.test(source);
    const hasStyle = /<style[\s>]/i.test(source) || /style\s*=|\{\s*[a-z-]+\s*:/i.test(source);
    return hasMarkup && hasStyle
      ? '✓ Structure Web détectée : HTML et style sont présents. Bien joué.'
      : 'Presque. Ajoute au moins une vraie balise HTML et une règle CSS pour valider cette pratique.';
  }

  if (language === 'Python') {
    const hasFunction = /def\s+\w+\s*\(/.test(source);
    const hasReturn = /\breturn\b/.test(source);
    return hasFunction && hasReturn
      ? '✓ Structure Python valide : fonction + return détectés.'
      : 'À revoir : crée une fonction avec def puis renvoie une valeur avec return.';
  }

  if (language === 'SQL') {
    const hasSelect = normalized.startsWith('select ');
    const hasFrom = normalized.includes(' from ');
    return hasSelect && hasFrom
      ? '✓ Requête SQL reconnue : SELECT et FROM sont présents.'
      : 'À revoir : commence par SELECT puis indique la table avec FROM.';
  }

  const hasDeclaration = /\b(const|let|var)\b/.test(source);
  const hasOutput = source.includes('console.log');
  return hasDeclaration && hasOutput
    ? '✓ Exercice JavaScript validé localement.'
    : 'À revoir : déclare une valeur puis affiche un résultat avec console.log.';
}
