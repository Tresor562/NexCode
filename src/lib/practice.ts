export type PracticeLanguage = 'HTML/CSS' | 'JavaScript' | 'Python' | 'SQL';

function maskQuotedStrings(source: string, quotes: string[], doubledQuote = false) {
  let output = '';
  let index = 0;

  while (index < source.length) {
    const quote = quotes.find((candidate) => source.startsWith(candidate, index));
    if (!quote) {
      output += source[index];
      index += 1;
      continue;
    }

    output += ' '.repeat(quote.length);
    index += quote.length;

    while (index < source.length) {
      if (source[index] === '\n') {
        output += '\n';
        index += 1;
        continue;
      }

      if (source[index] === '\\' && quote.length === 1) {
        output += ' ';
        index += 1;
        if (index < source.length) {
          output += source[index] === '\n' ? '\n' : ' ';
          index += 1;
        }
        continue;
      }

      if (source.startsWith(quote, index)) {
        if (doubledQuote && quote.length === 1 && source.startsWith(quote + quote, index)) {
          output += '  ';
          index += 2;
          continue;
        }
        output += ' '.repeat(quote.length);
        index += quote.length;
        break;
      }

      output += ' ';
      index += 1;
    }
  }

  return output;
}

function stripBlockComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
}

function stripJsComments(source: string) {
  const stringsMasked = maskQuotedStrings(source, ['"', "'", '`']);
  return stripBlockComments(stringsMasked).replace(/\/\/.*$/gm, ' ');
}

function stripSqlComments(source: string) {
  const stringsMasked = maskQuotedStrings(source, ["'"], true);
  return stripBlockComments(stringsMasked).replace(/--.*$/gm, ' ');
}

function stripHtmlComments(source: string) {
  return source.replace(/<!--[\s\S]*?-->/g, ' ');
}

function stripPythonCommentsAndStrings(source: string) {
  const stringsMasked = maskQuotedStrings(source, ["'''", '\"\"\"', "'", '"']);
  return stringsMasked.replace(/#.*$/gm, ' ');
}

function leadingIndent(line: string) {
  const prefix = line.match(/^[\t ]*/)?.[0] ?? '';
  return [...prefix].reduce((total, char) => total + (char === '\t' ? 4 : 1), 0);
}

function pythonHasFunctionReturning(source: string) {
  const lines = source.split('\n');

  for (let functionIndex = 0; functionIndex < lines.length; functionIndex += 1) {
    const definition = lines[functionIndex];
    if (!/^\s*(?:async\s+)?def\s+[A-Za-z_]\w*\s*\([^)]*\)\s*:\s*$/.test(definition)) continue;

    const functionIndent = leadingIndent(definition);
    let nestedBlockIndent: number | null = null;

    for (let index = functionIndex + 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (!line.trim()) continue;

      const indent = leadingIndent(line);
      if (indent <= functionIndent) break;

      if (nestedBlockIndent !== null) {
        if (indent > nestedBlockIndent) continue;
        nestedBlockIndent = null;
      }

      if (/^\s*(?:async\s+)?def\s+[A-Za-z_]\w*\s*\([^)]*\)\s*:\s*$/.test(line) || /^\s*class\s+[A-Za-z_]\w*\b[^:]*:\s*$/.test(line)) {
        nestedBlockIndent = indent;
        continue;
      }

      if (/^\s*return\b/.test(line)) return true;
    }
  }

  return false;
}

function hasCssDeclaration(source: string) {
  return /(?:^|[;{])\s*(?:--[\w-]+|[a-z-]+)\s*:\s*[^;{}]+/i.test(stripBlockComments(source));
}

function htmlHasRealMarkup(source: string) {
  const withoutEmbeddedCode = source
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, ' ');
  return /<(h1|main|section|p|div|button)\b[^>]*>/i.test(withoutEmbeddedCode);
}

function htmlHasRealCss(source: string) {
  const styleBlocks = [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)];
  if (styleBlocks.some((match) => hasCssDeclaration(match[1] ?? ''))) return true;

  const inlineStyles = [...source.matchAll(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/gi)];
  return inlineStyles.some((match) => hasCssDeclaration(match[2] ?? ''));
}

export function checkPractice(language: PracticeLanguage, source: string): string {
  if (!source.trim()) return 'Écris une réponse avant de lancer la vérification.';

  if (language === 'HTML/CSS') {
    const visibleSource = stripHtmlComments(source);
    const hasMarkup = htmlHasRealMarkup(visibleSource);
    const hasCss = htmlHasRealCss(visibleSource);
    return hasMarkup && hasCss
      ? '✓ Structure Web détectée : HTML et style sont présents. Bien joué.'
      : 'Presque. Ajoute au moins une vraie balise HTML et une règle CSS pour valider cette pratique.';
  }

  if (language === 'Python') {
    const visibleSource = stripPythonCommentsAndStrings(source);
    return pythonHasFunctionReturning(visibleSource)
      ? '✓ Structure Python valide : fonction + return détectés.'
      : 'À revoir : crée une fonction avec def puis renvoie une valeur avec return.';
  }

  if (language === 'SQL') {
    const normalized = stripSqlComments(source).toLowerCase().replace(/\s+/g, ' ').trim();
    const hasQueryStart = /^(select|with)\b/.test(normalized);
    const hasSelect = /\bselect\b/.test(normalized);
    const hasFrom = /\bfrom\s+(?:[a-z_][\w$]*\.)*[a-z_][\w$]*/i.test(normalized);
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
