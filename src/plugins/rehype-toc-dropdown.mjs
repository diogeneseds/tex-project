/**
 * Rehype Plugin to transform shortcodes like [toc], [ez-toc] or "Conteúdo do post..."
 * into a compact, discrete Tecnoblog-style dropdown card.
 * Starts closed by default, with discrete setinha + mostrar/ocultar indicator.
 * Provides 0 CLS, max Core Web Vitals performance, and 100% SEO indexability.
 */

export function rehypeTocDropdown() {
  return (tree) => {
    if (!tree || !tree.children) return;

    // First, ensure all H2 and H3 elements in the article have unique IDs for anchor links
    const headings = [];
    collectHeadings(tree, headings);

    const usedIds = new Set();
    const headingItems = [];

    for (const headingNode of headings) {
      const text = getNodeText(headingNode).trim();
      if (!text) continue;

      let id = headingNode.properties?.id;
      if (!id) {
        const baseId = slugify(text) || 'secao';
        id = baseId;
        let count = 1;
        while (usedIds.has(id)) {
          id = `${baseId}-${count++}`;
        }
        headingNode.properties = headingNode.properties || {};
        headingNode.properties.id = id;
      }
      usedIds.add(id);

      headingItems.push({
        tagName: headingNode.tagName,
        text,
        id
      });
    }

    // Search for shortcode nodes [toc], [ez-toc], etc. or existing H2 + list structure
    for (let i = 0; i < tree.children.length; i++) {
      const node = tree.children[i];

      // Check if node is a shortcode [toc] or [ez-toc]
      if (isTocShortcodeNode(node)) {
        if (headingItems.length > 0) {
          const listNode = buildTocListAST(headingItems);
          const detailsNode = createTocDetailsNode(listNode, 'Conteúdo do post');
          tree.children[i] = detailsNode;
        } else {
          // If no headings found, remove the shortcode node
          tree.children.splice(i, 1);
          i--;
        }
        continue;
      }

      // Check for legacy manual format: <h2>Conteúdo do post</h2> followed by <ol> or <ul>
      if (node.type === 'element' && (node.tagName === 'h2' || node.tagName === 'h3')) {
        const textContent = getNodeText(node).trim();
        const lowerText = textContent.toLowerCase();

        if (
          lowerText.includes('conteúdo do post') ||
          lowerText.includes('conteudo do post') ||
          lowerText.includes('sumário do post') ||
          lowerText.includes('sumario do post') ||
          lowerText === 'índice' ||
          lowerText === 'indice'
        ) {
          // Find the next element node in children
          let listIndex = -1;
          for (let j = i + 1; j < tree.children.length; j++) {
            const nextNode = tree.children[j];
            if (nextNode.type === 'element') {
              if (nextNode.tagName === 'ol' || nextNode.tagName === 'ul') {
                listIndex = j;
              }
              break;
            }
          }

          if (listIndex !== -1) {
            const listNode = tree.children[listIndex];
            const detailsNode = createTocDetailsNode(listNode, textContent);

            // Replace H2 and listNode with detailsNode
            tree.children.splice(i, listIndex - i + 1, detailsNode);
          }
        }
      }
    }
  };
}

function isTocShortcodeNode(node) {
  if (!node) return false;
  const text = getNodeText(node).trim().toLowerCase();
  const cleaned = text.replace(/\\/g, ''); // handle escaped \[ez-toc\]
  return cleaned === '[toc]' || cleaned === '[ez-toc]' || cleaned === '<!-- toc -->';
}

function collectHeadings(parent, headings) {
  if (!parent || !parent.children) return;
  for (const child of parent.children) {
    if (child.type === 'element') {
      if (child.tagName === 'h2' || child.tagName === 'h3') {
        const text = getNodeText(child).trim();
        const lower = text.toLowerCase();
        if (
          !lower.includes('conteúdo do post') &&
          !lower.includes('conteudo do post') &&
          !lower.includes('sumário do post') &&
          !lower.includes('sumario do post') &&
          lower !== 'índice' &&
          lower !== 'indice'
        ) {
          headings.push(child);
        }
      } else if (child.tagName !== 'details') {
        collectHeadings(child, headings);
      }
    }
  }
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function buildTocListAST(items) {
  const rootOlChildren = [];
  let currentH2Li = null;
  let currentSubOl = null;

  items.forEach(item => {
    const aNode = {
      type: 'element',
      tagName: 'a',
      properties: { href: `#${item.id}` },
      children: [{ type: 'text', value: item.text }]
    };

    if (item.tagName === 'h2') {
      currentH2Li = {
        type: 'element',
        tagName: 'li',
        properties: {},
        children: [aNode]
      };
      rootOlChildren.push(currentH2Li);
      currentSubOl = null;
    } else if (item.tagName === 'h3') {
      if (!currentH2Li) {
        currentH2Li = {
          type: 'element',
          tagName: 'li',
          properties: {},
          children: [aNode]
        };
        rootOlChildren.push(currentH2Li);
      } else {
        if (!currentSubOl) {
          currentSubOl = {
            type: 'element',
            tagName: 'ol',
            properties: { className: ['pl-4', 'mt-1', 'space-y-1'] },
            children: []
          };
          currentH2Li.children.push(currentSubOl);
        }
        currentSubOl.children.push({
          type: 'element',
          tagName: 'li',
          properties: {},
          children: [aNode]
        });
      }
    }
  });

  return {
    type: 'element',
    tagName: 'ol',
    properties: { className: ['space-y-1.5'] },
    children: rootOlChildren
  };
}

function createTocDetailsNode(listNode, titleText = 'Conteúdo do post') {
  const summaryNode = {
    type: 'element',
    tagName: 'summary',
    properties: {
      className: [
        'flex', 'items-center', 'justify-between', 'px-3.5', 'sm:px-4', 'py-2.5',
        'cursor-pointer', 'select-none', 'font-bold', 'text-[#0B0F19]',
        'hover:bg-slate-100/90', 'transition-colors'
      ]
    },
    children: [
      {
        type: 'element',
        tagName: 'div',
        properties: { className: ['flex', 'items-center', 'gap-2'] },
        children: [
          {
            type: 'element',
            tagName: 'span',
            properties: {
              className: ['text-xs', 'sm:text-sm', 'font-extrabold', 'uppercase', 'tracking-wider', 'text-[#0B0F19]'],
              style: 'font-family: var(--font-heading);'
            },
            children: [{ type: 'text', value: titleText }]
          }
        ]
      },
      {
        type: 'element',
        tagName: 'div',
        properties: { className: ['flex', 'items-center', 'gap-1.5', 'text-[11px]', 'sm:text-xs', 'font-semibold', 'text-slate-500'] },
        children: [
          {
            type: 'element',
            tagName: 'span',
            properties: { className: ['toc-status-text'] }
          },
          {
            type: 'element',
            tagName: 'svg',
            properties: {
              className: ['toc-chevron', 'w-3.5', 'h-3.5', 'transition-transform', 'duration-200', 'text-slate-500', 'stroke-[2.5]'],
              viewBox: '0 0 24 24',
              fill: 'none',
              stroke: 'currentColor'
            },
            children: [
              {
                type: 'element',
                tagName: 'path',
                properties: {
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                  d: 'M19 9l-7 7-7-7'
                }
              }
            ]
          }
        ]
      }
    ]
  };

  const tocContentNode = {
    type: 'element',
    tagName: 'div',
    properties: {
      className: ['toc-content', 'px-3.5', 'sm:px-4', 'py-3', 'border-t', 'border-slate-200/70', 'bg-white', 'text-xs', 'sm:text-sm']
    },
    children: [listNode]
  };

  return {
    type: 'element',
    tagName: 'details',
    properties: {
      className: [
        'toc-dropdown', 'my-4', 'rounded-xl', 'border', 'border-slate-200/80',
        'bg-slate-50/90', 'overflow-hidden', 'transition-all'
      ]
    },
    children: [summaryNode, tocContentNode]
  };
}

function getNodeText(node) {
  if (!node) return '';
  if (node.type === 'text') return node.value || '';
  if (node.children && Array.isArray(node.children)) {
    return node.children.map(getNodeText).join('');
  }
  return '';
}

