import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import { rehypeTocDropdown } from './src/plugins/rehype-toc-dropdown.mjs';

export default defineConfig({
    output: 'static',
    adapter: vercel(),
    markdown: {
        rehypePlugins: [rehypeTocDropdown],
    },
    integrations: [
        react(),
        tailwind({ applyBaseStyles: false }),
    ],
    vite: {
        optimizeDeps: {
            include: ['marked'],
        },
    },
});
