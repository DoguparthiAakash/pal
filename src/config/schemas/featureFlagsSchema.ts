import { z } from 'zod';

export const FeatureFlagsSchema = z.object({
  ENABLE_DEV_LOGIN: z.boolean().default(false),
  ENABLE_LOCAL_STORAGE: z.boolean().default(false),
  ENABLE_LOCAL_LLM: z.boolean().default(false),
  ENABLE_LOCAL_EMBEDDINGS: z.boolean().default(false),
  ENABLE_LOCAL_VECTOR_DB: z.boolean().default(false),
  ENABLE_PROFILING: z.boolean().default(false),
  ENABLE_DEBUG_LOGGING: z.boolean().default(false),
  ENABLE_PERFORMANCE_METRICS: z.boolean().default(false),
});
export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;
