# Objetivo
Seu objetivo é construir e manter o projeto gabaritando o Core Web Vitals (100/100 no PageSpeed Insights, Mobile e Desktop), com carregamento instantâneo, SEO técnico impecável e otimização focada em motores generativos (GEO).

## Tecnologia
 - Astro.js
 - Tailwind CSS
 - TypeScript

## Orientações
 - Utilize  fontes locais, caso as fontes sejam do Google,  faça o  download para usarmos localmente. Coloque as fontes nativas do navegador como fallback.
 - Sempre utilize a nossa identidade visual para definir as cores e fontes do blog. a Identidade visual fica na pasta: /home/diogenes/tex-project/identidade-visual.
 - O layout já está pronto e bem parecido com o tecmundo, garanta 100/100 no core web vitals e seja responsivo para mobile. Evite mudanças bruscas no layout
 
## Diretrizes de Performance e Core Web Vitals
* **Controle Estrito de Scripts (TBT Zero):** Requisições externas como Google Analytics e GTM devem rodar fora da thread principal usando `@astrojs/partytown`.
* **Lazy Load por Interação:** Widgets de UI e scripts pesados (como o AdOpt LGPD) só podem ser injetados via Vanilla JS baseados na interação real do usuário (`scroll`, `mousemove`, `touchstart`). Nunca bloqueie a renderização inicial.
* **Hidratação Cirúrgica:** Componentes interativos não devem usar `client:load` no topo da página. Opte sempre por `client:idle` ou `client:visible`.
* **Imagens e LCP:** Use exclusivamente o componente nativo `<Image/>` do Astro para forçar formatos WebP/AVIF. A imagem de capa (Hero) exige `loading="eager"` e `fetchpriority="high"`. Mídias abaixo da dobra usam `loading="lazy"`. Crie fallbacks para imagens quebradas.
* **Tipografia e Assets:** Evite requisições externas de fontes (use no máximo 2-3 fontes locais ou padrão do sistema, como sans-serif/serif). Hospede todas as imagens do site localmente.
* **CSS:** Utilize exclusivamente classes utilitárias do Tailwind CSS. Remova qualquer script ou código CSS não utilizado.

## Acessibilidade e UI
* **Contraste Seguro:** Priorize fundos escuros com letras claras, ou fundos claros com letras escuras (visando a saúde ocular). Substitua tons de cinza muito claros por cinzas escuros para manter a legibilidade.
* **Rotas Protegidas:** Isole o backend e a área administrativa. Usuários não autenticados tentando acessar áreas sensíveis devem sofrer redirecionamento imediato para a página de login.

## SEO Técnico e Rastreamento
* **Integridade:** Verifique ativamente e elimine links quebrados (erros 404).
* **Requisições Externas Permitidas:** Apenas Google Analytics, Google Tag Manager, Google Search Console e AdOpt LGPD estão autorizados, seguindo estritamente as regras de injeção isolada descritas na Seção 1.

## GEO (Generative Engine Optimization)
* **Semântica HTML5 Estrita:** Encapsule o conteúdo rigidamente usando `<article>`, `<main>`, `<aside>`, e `<time>` para facilitar a varredura por inteligências artificiais.
* **Schema Markup (JSON-LD):** Injete marcação de dados estruturados do Google em todas as páginas. Use o schema `Article` para postagens padrão e `HowTo` ou `FAQPage` para tutoriais técnicos.
* **Estrutura Evergreen (Answer Target):** Para conteúdos práticos de desenvolvimento, programação ou bancos de dados, crie respostas diretas e concisas nos primeiros parágrafos, seguidas do detalhamento técnico profundo. As IAs precisam extrair a solução exata rapidamente antes de processar o resto do tutorial.