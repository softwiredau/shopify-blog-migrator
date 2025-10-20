import * as parse5 from 'parse5';

/**
 * Splits HTML content into chunks while preserving valid, self-contained markup.
 * Uses HTML parsing to ensure opening and closing tags are balanced in each chunk.
 */
export function splitBody(bodyHtml, maxChars) {
  if (!bodyHtml || bodyHtml.length <= maxChars) return [bodyHtml];

  // Parse HTML into a DOM tree
  let document;
  try {
    document = parse5.parse(bodyHtml);
  } catch (e) {
    console.warn(`⚠️  Warning: Failed to parse HTML (${e.message}). Returning as single chunk.`);
    return [bodyHtml];
  }

  // Extract body content (parse5 creates html>head>body structure)
  const htmlNode = document.childNodes.find(n => n.nodeName === 'html');
  const bodyNode = htmlNode?.childNodes?.find(n => n.nodeName === 'body');

  if (!bodyNode || !bodyNode.childNodes) {
    // No valid body structure, return as-is
    return [bodyHtml];
  }

  const chunks = [];
  let currentChunk = [];
  let currentSize = 0;

  // Process top-level nodes - clone each to avoid mutation during serialization
  for (const node of bodyNode.childNodes) {
    // Serialize to HTML and re-parse to create a deep clone
    const nodeHtml = parse5.serialize({ nodeName: 'div', childNodes: [node] })
      .replace(/^<div>/, '')
      .replace(/<\/div>$/, '');
    const nodeSize = nodeHtml.length;

    // Clone the node by parsing its HTML
    const clonedFragment = parse5.parseFragment(nodeHtml);
    const clonedNode = clonedFragment.childNodes[0];

    // If this single node exceeds maxChars, we have a problem
    if (nodeSize > maxChars) {
      // Flush current chunk if any
      if (currentChunk.length > 0) {
        chunks.push(serializeNodes(currentChunk));
        currentChunk = [];
        currentSize = 0;
      }

      console.warn(`⚠️  Warning: Single HTML element exceeds MAX_BODY_CHARS (${nodeSize} > ${maxChars})`);
      console.warn(`⚠️  This element will be included as-is. Consider increasing MAX_BODY_CHARS.`);
      chunks.push(nodeHtml);
      continue;
    }

    // If adding this node would exceed limit, flush current chunk
    if (currentSize + nodeSize > maxChars && currentChunk.length > 0) {
      chunks.push(serializeNodes(currentChunk));
      currentChunk = [];
      currentSize = 0;
    }

    // Add cloned node to current chunk to avoid mutation
    currentChunk.push(clonedNode);
    currentSize += nodeSize;
  }

  // Flush remaining chunk
  if (currentChunk.length > 0) {
    chunks.push(serializeNodes(currentChunk));
  }

  return chunks.length > 0 ? chunks : [bodyHtml];
}

/**
 * Serialize an array of parse5 nodes to HTML string
 */
function serializeNodes(nodes) {
  const fragment = {
    nodeName: '#document-fragment',
    childNodes: nodes
  };
  return parse5.serialize(fragment);
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
