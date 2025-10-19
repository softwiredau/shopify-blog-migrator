/**
 * Splits HTML content into chunks while preserving tag boundaries.
 * Splits on block-level elements to maintain valid markup.
 */
export function splitBody(bodyHtml, maxChars) {
  if (!bodyHtml || bodyHtml.length <= maxChars) return [bodyHtml];

  // Block-level tags where we can safely split
  const blockTags = ['</div>', '</p>', '</section>', '</article>', '</h1>', '</h2>', '</h3>', '</h4>', '</h5>', '</h6>', '</ul>', '</ol>', '</li>', '</blockquote>', '</pre>', '</table>', '</tr>', '</td>', '</th>', '</figure>', '</header>', '</footer>', '</main>', '</aside>', '</nav>'];

  const chunks = [];
  let remaining = bodyHtml;

  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      chunks.push(remaining);
      break;
    }

    // Find the best split point within maxChars
    let splitPoint = maxChars;
    let bestSplit = -1;

    // Look backwards from maxChars to find a block-level closing tag
    const searchText = remaining.substring(0, maxChars);
    for (const tag of blockTags) {
      const lastIndex = searchText.lastIndexOf(tag);
      if (lastIndex > bestSplit) {
        bestSplit = lastIndex + tag.length;
      }
    }

    // If no block tag found, try to at least split at a tag boundary
    if (bestSplit === -1) {
      const lastTagClose = searchText.lastIndexOf('>');
      if (lastTagClose > maxChars * 0.5) { // Only use if reasonably close to maxChars
        bestSplit = lastTagClose + 1;
      } else {
        // Last resort: split at maxChars but warn
        console.warn(`⚠️  Warning: Splitting HTML at character boundary (no safe tag found within ${maxChars} chars)`);
        bestSplit = maxChars;
      }
    }

    chunks.push(remaining.substring(0, bestSplit));
    remaining = remaining.substring(bestSplit);
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
