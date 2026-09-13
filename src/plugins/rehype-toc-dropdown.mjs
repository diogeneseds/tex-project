/**
 * Rehype Plugin to transform "Conteúdo do post..." into a discrete inline TOC dropdown.
 * Starts closed by default, with discrete setinha + mostrar/ocultar indicator.
 * Matches original post H2 styling (blue bar + heading font) with 0 CLS & 100% SEO.
 */

export function rehypeTocDropdown() {
  return (tree) => {
    if (!tree || !tree.children) return;

    for (let i = 0; i < tree.children.length; i++) {
      const node = tree.children[i];

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

            // Summary node (header line matching post h2 style)
            const summaryNode = {
              type: 'element',
              tagName: 'summary',
              properties: {
                className: ['toc-summary']
              },
              children: [
                {
                  type: 'element',
                  tagName: 'span',
                  properties: {
                    className: ['toc-title-text']
                  },
                  children: [{ type: 'text', value: textContent }]
                },
                {
                  type: 'element',
                  tagName: 'div',
                  properties: { className: ['toc-toggle-btn'] },
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
                        className: ['toc-chevron'],
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

            // Container for list content
            const tocContentNode = {
              type: 'element',
              tagName: 'div',
              properties: {
                className: ['toc-content']
              },
              children: [listNode]
            };

            // Details element - discrete container
            const detailsNode = {
              type: 'element',
              tagName: 'details',
              properties: {
                className: ['toc-dropdown']
              },
              children: [summaryNode, tocContentNode]
            };

            // Replace H2 and listNode with detailsNode
            tree.children.splice(i, listIndex - i + 1, detailsNode);
          }
        }
      }
    }
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
