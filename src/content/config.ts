import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
    type: 'content',
    schema: ({ image }) => z.object({
        title: z.string(),
        description: z.string().optional().default(''),
        pubDate: z.coerce.date(),
        updatedDate: z.coerce.date().optional(),
        heroImage: z.union([image(), z.string()]).optional(),
        category: z.string().optional(),
        tags: z.array(z.string()).optional().default([]),
        author: z.string().optional().default('Equipe TecExtreme'),
    }),
});

export const collections = { blog };
