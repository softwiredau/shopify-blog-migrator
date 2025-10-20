import * as parse5 from 'parse5';

/**
 * Splits HTML content into chunks while preserving valid, self-contained markup.
 * Uses HTML parsing to ensure opening and closing tags are balanced in each chunk.
 * Recursively splits oversized nodes to meet size limits.
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

    // If this single node exceeds maxChars, try to split it recursively
    if (nodeSize > maxChars) {
      // Flush current chunk if any
      if (currentChunk.length > 0) {
        chunks.push(serializeNodes(currentChunk));
        currentChunk = [];
        currentSize = 0;
      }

      // Try to recursively split this oversized node
      const subChunks = splitLargeNode(clonedNode, maxChars);
      chunks.push(...subChunks);
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
 * Recursively split a large node into smaller chunks by breaking on child boundaries
 */
function splitLargeNode(node, maxChars) {
  const nodeHtml = serializeNodes([node]);

  // If node has no children, we can't split it further - return as-is with warning
  if (!node.childNodes || node.childNodes.length === 0) {
    console.warn(`⚠️  Warning: Atomic HTML element exceeds MAX_BODY_CHARS (${nodeHtml.length} > ${maxChars})`);
    console.warn(`⚠️  This element cannot be split further. Consider increasing MAX_BODY_CHARS.`);
    console.warn(`⚠️  Element: ${node.nodeName || 'text'}`);
    return [nodeHtml];
  }

  // Element has children - split on child boundaries
  const chunks = [];
  let currentChildren = [];
  let currentSize = 0;

  // Calculate overhead of opening/closing tags
  const openingTag = nodeHtml.substring(0, nodeHtml.indexOf('>') + 1);
  const closingTag = `</${node.nodeName}>`;
  const tagOverhead = openingTag.length + closingTag.length;

  for (const child of node.childNodes) {
    const childHtml = parse5.serialize({ nodeName: 'div', childNodes: [child] })
      .replace(/^<div>/, '')
      .replace(/<\/div>$/, '');
    const childSize = childHtml.length;

    // Clone child to avoid mutation
    const clonedChildFragment = parse5.parseFragment(childHtml);
    const clonedChild = clonedChildFragment.childNodes[0];

    // If a single child exceeds limit, recursively split it
    if (tagOverhead + childSize > maxChars) {
      // Flush current children if any
      if (currentChildren.length > 0) {
        chunks.push(wrapInParentTag(node, currentChildren));
        currentChildren = [];
        currentSize = 0;
      }

      // Recursively split this oversized child
      const subChunks = splitLargeNode(clonedChild, maxChars);
      chunks.push(...subChunks);
      continue;
    }

    // If adding this child would exceed limit, flush current group
    if (tagOverhead + currentSize + childSize > maxChars && currentChildren.length > 0) {
      chunks.push(wrapInParentTag(node, currentChildren));
      currentChildren = [];
      currentSize = 0;
    }

    currentChildren.push(clonedChild);
    currentSize += childSize;
  }

  // Flush remaining children
  if (currentChildren.length > 0) {
    chunks.push(wrapInParentTag(node, currentChildren));
  }

  return chunks;
}

/**
 * Wrap child nodes in a parent tag (preserving attributes)
 */
function wrapInParentTag(parentNode, childNodes) {
  // Create a clone of parent with only the specified children
  const wrapper = {
    nodeName: parentNode.nodeName,
    tagName: parentNode.tagName,
    attrs: parentNode.attrs || [],
    childNodes: childNodes
  };

  return parse5.serialize({ nodeName: 'div', childNodes: [wrapper] })
    .replace(/^<div>/, '')
    .replace(/<\/div>$/, '');
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
