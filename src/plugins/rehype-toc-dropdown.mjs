/**
 * Rehype Plugin to transform "Conteúdo do post..." into a compact, discrete Tecnoblog-style dropdown card.
 * Starts closed by default, with discrete setinha + mostrar/ocultar indicator.
 * Provides 0 CLS, max Core Web Vitals performance, and 100% SEO indexability.
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

            // Summary node (header line matching Tecnoblog compact card bar)
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
                    // DETALHE VISUAL: Barra azul pílula (|) removida a pedido para design mais limpo.
                    // Para reativar, inclua: { type: 'element', tagName: 'span', properties: { className: ['w-1', 'h-3.5', 'bg-[#2222D3]', 'rounded-full', 'inline-block'] } },
                    {
                      type: 'element',
                      tagName: 'span',
                      properties: {
                        className: ['text-xs', 'sm:text-sm', 'font-extrabold', 'uppercase', 'tracking-wider', 'text-[#0B0F19]'],
                        style: 'font-family: var(--font-heading);'
                      },
                      children: [{ type: 'text', value: textContent }]
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

            // Container for list content
            const tocContentNode = {
              type: 'element',
              tagName: 'div',
              properties: {
                className: ['toc-content', 'px-3.5', 'sm:px-4', 'py-3', 'border-t', 'border-slate-200/70', 'bg-white', 'text-xs', 'sm:text-sm']
              },
              children: [listNode]
            };

            // Details element - discrete Tecnoblog style card box
            const detailsNode = {
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
