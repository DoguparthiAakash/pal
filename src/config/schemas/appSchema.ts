import { z } from 'zod';

export const AppConfigSchema = z.object({
  version: z.string().default('0.1.0'),
  commitHash: z.string().default('unknown'),
  buildTime: z.string().default(new Date().toISOString()),
  rag: z.object({
    defaultChunkSize: z.number().default(400),
    defaultChunkOverlap: z.number().default(60),
    defaultTopK: z.number().default(15),
    defaultSimilarityThreshold: z.number().default(0.7),
  }).default({
    defaultChunkSize: 400,
    defaultChunkOverlap: 60,
    defaultTopK: 15,
    defaultSimilarityThreshold: 0.7,
  }),
  rateLimits: z.object({
    chat: z.object({
      limit: z.number().default(100),
      windowSeconds: z.number().default(3600),
    }).default({ limit: 100, windowSeconds: 3600 }),
    ingest: z.object({
      limit: z.number().default(20),
      windowSeconds: z.number().default(3600),
    }).default({ limit: 20, windowSeconds: 3600 }),
  }).default({
    chat: { limit: 100, windowSeconds: 3600 },
    ingest: { limit: 20, windowSeconds: 3600 }
  }),
});
export type AppConfig = z.infer<typeof AppConfigSchema>;
