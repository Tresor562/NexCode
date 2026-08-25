export type PracticeLanguage = 'HTML/CSS' | 'JavaScript' | 'Python' | 'SQL';

function stripBlockComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

function stripJsComments(source: string) {
  return stripBlockComments(source).replace(/(^|[^:])\/\/.*$/gm, '$1 ');
}

function stripSqlComments(source: string) {
  return stripBlockComments(source).replace(/--.*$/gm, ' ');
}

function stripHtmlComments(source: string) {
  return source.replace(/<!--[\s\S]*?-->/g, ' ');
}

function stripPythonCommentLines(source: string) {
  return source.replace(/^\s*#.*$/gm, ' ');
}

export function checkPractice(language: PracticeLanguage, source: string): string {
  if (!source.trim()) return 'Écris une réponse avant de lancer la vérification.';

  if (language === 'HTML/CSS') {
    const visibleSource = stripHtmlComments(source);
    const hasMarkup = /<(h1|main|section|p|div|button)\b[^>]*>/i.test(visibleSource);
    const hasStyleBlock = /<style\b[^>]*>[\s\S]*?\{[\s\S]*?[a-z-]+\s*:[\s\S]*?\}[\s\S]*?<\/style\s*>/i.test(visibleSource);
    const hasInlineStyle = /\bstyle\s*=\s*(["'])[^"']*[a-z-]+\s*:[^"']*\1/i.test(visibleSource);
    return hasMarkup && (hasStyleBlock || hasInlineStyle)
      ? '✓ Structure Web détectée : HTML et style sont présents. Bien joué.'
      : 'Presque. Ajoute au moins une vraie balise HTML et une règle CSS pour valider cette pratique.';
  }

  if (language === 'Python') {
    const visibleSource = stripPythonCommentLines(source);
    const hasFunction = /\b(?:async\s+)?def\s+[A-Za-z_]\w*\s*\([^)]*\)\s*:/m.test(visibleSource);
    const hasReturn = /^\s+return\b/m.test(visibleSource);
    return hasFunction && hasReturn
      ? '✓ Structure Python valide : fonction + return détectés.'
      : 'À revoir : crée une fonction avec def puis renvoie une valeur avec return.';
  }

  if (language === 'SQL') {
    const normalized = stripSqlComments(source).toLowerCase().replace(/\s+/g, ' ').trim();
    const hasQueryStart = /^(select|with)\b/.test(normalized);
    const hasSelect = /\bselect\b/.test(normalized);
    const hasFrom = /\bfrom\s+[a-z_][\w$.]*/i.test(normalized);
    return hasQueryStart && hasSelect && hasFrom
      ? '✓ Requête SQL reconnue : SELECT et FROM sont présents.'
      : 'À revoir : commence par SELECT puis indique la table avec FROM.';
  }

  const visibleSource = stripJsComments(source);
  const hasDeclaration = /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*/.test(visibleSource);
  const hasOutput = /\bconsole\s*\.\s*log\s*\(/.test(visibleSource);
  return hasDeclaration && hasOutput
    ? '✓ Exercice JavaScript validé localement.'
    : 'À revoir : déclare une valeur puis affiche un résultat avec console.log.';
}
