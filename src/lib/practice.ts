export type PracticeLanguage = 'JavaScript' | 'Python' | 'SQL';

export function checkPractice(language: PracticeLanguage, source: string): string {
  const normalized = source.toLowerCase().replace(/\s+/g, ' ').trim();

  if (language === 'Python') {
    const hasFunction = /def\s+\w+\s*\(/.test(source);
    const hasReturn = /\breturn\b/.test(source);
    return hasFunction && hasReturn
      ? '✓ Structure Python valide pour cet exercice : fonction + return détectés.'
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
