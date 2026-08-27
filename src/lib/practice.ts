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

const pythonFunctionPattern = /^\s*(?:async\s+)?def\s+[A-Za-z_]\w*\s*\([^)]*\)\s*:\s*$/;
const pythonClassPattern = /^\s*class\s+[A-Za-z_]\w*\b[^:]*:\s*$/;

function pythonTopLevelOrMethodDefinitions(lines: string[]) {
  const definitions = new Set<number>();
  const scopeStack: Array<{ indent: number; kind: 'function' | 'class' | 'other' }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined || !line.trim()) continue;

    const indent = leadingIndent(line);
    let currentScope = scopeStack.at(-1);
    while (currentScope && indent <= currentScope.indent) {
      scopeStack.pop();
      currentScope = scopeStack.at(-1);
    }

    const isFunction = pythonFunctionPattern.test(line);
    const isClass = pythonClassPattern.test(line);
    if (isFunction && !scopeStack.some((scope) => scope.kind === 'function')) definitions.add(index);

    if (/\:\s*$/.test(line)) {
      scopeStack.push({ indent, kind: isFunction ? 'function' : isClass ? 'class' : 'other' });
    }
  }

  return definitions;
}

function pythonHasFunctionReturning(source: string) {
  const lines = source.split('\n');
  const eligibleDefinitions = pythonTopLevelOrMethodDefinitions(lines);

  for (const functionIndex of eligibleDefinitions) {
    const definition = lines[functionIndex];
    if (definition === undefined) continue;

    const functionIndent = leadingIndent(definition);
    let nestedBlockIndent: number | null = null;

    for (let index = functionIndex + 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (line === undefined || !line.trim()) continue;

      const indent = leadingIndent(line);
      if (indent <= functionIndent) break;

      if (nestedBlockIndent !== null) {
        if (indent > nestedBlockIndent) continue;
        nestedBlockIndent = null;
      }

      if (pythonFunctionPattern.test(line) || pythonClassPattern.test(line)) {
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitTopLevelJsDeclarators(source: string) {
  const parts: string[] = [];
  let start = 0;
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') parenDepth += 1;
    else if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
    else if (char === '[') bracketDepth += 1;
    else if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    else if (char === '{') braceDepth += 1;
    else if (char === '}') braceDepth = Math.max(0, braceDepth - 1);
    else if (char === ',' && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
      parts.push(source.slice(start, index));
      start = index + 1;
    }
  }

  parts.push(source.slice(start));
  return parts;
}

function jsDeclaredNames(source: string) {
  const names = new Set<string>();

  for (const declaration of source.matchAll(/\b(?:const|let|var)\s+([^;\n]+)/g)) {
    const declarators = splitTopLevelJsDeclarators(declaration[1] ?? '');
    for (const declarator of declarators) {
      const name = declarator.match(/^\s*([A-Za-z_$][\w$]*)\s*(?:=|$)/)?.[1];
      if (name) names.add(name);
    }
  }

  return [...names];
}

function jsOutputUsesDeclaredValue(source: string) {
  const declaredNames = jsDeclaredNames(source);
  if (!declaredNames.length) return false;

  const outputCalls = [...source.matchAll(/\bconsole\s*\.\s*log\s*\(([^)]*)\)/g)];
  return outputCalls.some((call) => {
    const args = call[1] ?? '';
    return declaredNames.some((name) => new RegExp(`(^|[^\\w$])${escapeRegExp(name)}(?![\\w$])`).test(args));
  });
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
  return jsOutputUsesDeclaredValue(visibleSource)
    ? '✓ Exercice JavaScript validé localement : ta valeur déclarée est utilisée dans la sortie.'
    : 'À revoir : déclare une valeur puis utilise-la dans console.log.';
}