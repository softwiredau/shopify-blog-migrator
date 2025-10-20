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

  // If node has no children, we can't split it further
  if (!node.childNodes || node.childNodes.length === 0) {
    // Check if this is a text node
    if (node.nodeName === '#text') {
      console.warn(`⚠️  Warning: Text content exceeds MAX_BODY_CHARS (${nodeHtml.length} > ${maxChars})`);
      console.warn(`⚠️  Text will be split at character boundaries. Formatting may be affected.`);
      // Split text into chunks at word boundaries if possible
      return splitTextContent(node.value, maxChars);
    }

    // Empty or self-closing element that's too large
    console.warn(`⚠️  Warning: Atomic HTML element exceeds MAX_BODY_CHARS (${nodeHtml.length} > ${maxChars})`);
    console.warn(`⚠️  This element cannot be split further. Consider increasing MAX_BODY_CHARS.`);
    console.warn(`⚠️  Element: ${node.nodeName}`);
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

    // If a single child exceeds limit, handle specially
    if (tagOverhead + childSize > maxChars) {
      // Flush current children if any
      if (currentChildren.length > 0) {
        const isFirstChunkSoFar = chunks.length === 0;
        chunks.push(wrapInParentTag(node, currentChildren, isFirstChunkSoFar));
        currentChildren = [];
        currentSize = 0;
      }

      // Special handling for text nodes - split and wrap each chunk
      if (clonedChild.nodeName === '#text') {
        const textChunks = splitTextContent(clonedChild.value, maxChars - tagOverhead);
        for (let i = 0; i < textChunks.length; i++) {
          const textNode = { nodeName: '#text', value: textChunks[i] };
          const isFirstChunkSoFar = chunks.length === 0;
          chunks.push(wrapInParentTag(node, [textNode], isFirstChunkSoFar));
        }
      } else {
        // Recursively split this oversized element
        const subChunks = splitLargeNode(clonedChild, maxChars);
        // Wrap each subchunk in the parent tag to preserve structure
        for (let i = 0; i < subChunks.length; i++) {
          const fragment = parse5.parseFragment(subChunks[i]);
          const isFirstChunkSoFar = chunks.length === 0;
          chunks.push(wrapInParentTag(node, fragment.childNodes, isFirstChunkSoFar));
        }
      }
      continue;
    }

    // If adding this child would exceed limit, flush current group
    if (tagOverhead + currentSize + childSize > maxChars && currentChildren.length > 0) {
      const isFirstChunkSoFar = chunks.length === 0;
      chunks.push(wrapInParentTag(node, currentChildren, isFirstChunkSoFar));
      currentChildren = [];
      currentSize = 0;
    }

    currentChildren.push(clonedChild);
    currentSize += childSize;
  }

  // Flush remaining children
  if (currentChildren.length > 0) {
    const isFirstChunkSoFar = chunks.length === 0;
    chunks.push(wrapInParentTag(node, currentChildren, isFirstChunkSoFar));
  }

  return chunks;
}

/**
 * Split text content into chunks, preferring word boundaries
 */
function splitTextContent(text, maxChars) {
  if (!text || text.length <= maxChars) return [text];

  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      chunks.push(remaining);
      break;
    }

    // Try to split at a word boundary
    let splitPoint = maxChars;
    const searchText = remaining.substring(0, maxChars);

    // Look for last space/newline before limit
    const lastSpace = Math.max(
      searchText.lastIndexOf(' '),
      searchText.lastIndexOf('\n'),
      searchText.lastIndexOf('\t')
    );

    if (lastSpace > maxChars * 0.7) { // Only use word boundary if it's reasonably close
      splitPoint = lastSpace + 1; // Include the space in the previous chunk
    }

    chunks.push(remaining.substring(0, splitPoint));
    remaining = remaining.substring(splitPoint);
  }

  return chunks;
}

/**
 * Wrap child nodes in a parent tag (preserving attributes)
 * @param {Object} parentNode - The parent node to replicate
 * @param {Array} childNodes - Child nodes to wrap
 * @param {boolean} isFirstChunk - Whether this is the first chunk (keeps unique IDs)
 */
function wrapInParentTag(parentNode, childNodes, isFirstChunk = true) {
  // Attributes that must be unique and should only appear in first chunk
  const uniqueAttrNames = new Set([
    'id',
    'data-bloggle-section-id',
    'data-component-id',
    'data-section-id',
    'data-block-id'
  ]);

  // Filter attributes based on whether this is the first chunk
  let filteredAttrs = parentNode.attrs || [];
  if (!isFirstChunk) {
    // For subsequent chunks, remove unique identifier attributes
    filteredAttrs = filteredAttrs.filter(attr => !uniqueAttrNames.has(attr.name));
  }

  // Create a clone of parent with filtered attributes and specified children
  const wrapper = {
    nodeName: parentNode.nodeName,
    tagName: parentNode.tagName,
    attrs: filteredAttrs,
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
