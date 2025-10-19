export function splitBody(bodyHtml, maxChars) {
  if (!bodyHtml || bodyHtml.length <= maxChars) return [bodyHtml];
  const chunks = [];
  let i = 0;
  while (i < bodyHtml.length) {
    chunks.push(bodyHtml.slice(i, i + maxChars));
    i += maxChars;
  }
  return chunks;
}

export function rewriteDomains(html, fromDomain, toDomain) {
  if (!fromDomain || !toDomain || !html) return html;
  return html.replaceAll(fromDomain, toDomain);
}

export function partTitle(base, part, fmt) {
  return `${base}${fmt.replace('{n}', String(part))}`;
}

export function externalIdFor(sourceArticleId) {
  return `migrated:article:${sourceArticleId}`;
}

export function matchesPattern(text, pattern) {
  if (!pattern) return true;
  // Convert wildcard pattern to regex
  // Escape special regex chars except *
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  // Replace * with .* for wildcard matching
  const regexPattern = '^' + escaped.replace(/\*/g, '.*') + '$';
  const regex = new RegExp(regexPattern, 'i'); // case-insensitive
  return regex.test(text);
}
