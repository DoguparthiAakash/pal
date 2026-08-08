import { z } from 'zod';

export const StorageConfigSchema = z.object({
  provider: z.enum(['supabase', 'local']).default('supabase'),
  supabaseUrl: z.string().optional(),
  supabaseAnonKey: z.string().optional(),
  supabaseServiceRoleKey: z.string().optional(),
});

export const VectorStoreConfigSchema = z.object({
  provider: z.enum(['supabase', 'chroma', 'faiss']).default('supabase'),
});

export const LLMConfigSchema = z.object({
  provider: z.enum(['groq', 'openai', 'ollama']).default('groq'),
  groqApiKey: z.string().optional(),
  openaiApiKey: z.string().optional(),
  ollamaBaseUrl: z.string().optional(),
  tavilyApiKey: z.string().optional(),
});

export const EmbeddingConfigSchema = z.object({
  provider: z.enum(['openai', 'ollama', 'mock']).default('openai'),
  openaiApiKey: z.string().optional(),
});

export const AuthConfigSchema = z.object({
  provider: z.enum(['supabase', 'dev']).default('supabase'),
});

export const RateLimiterConfigSchema = z.object({
  provider: z.enum(['upstash', 'local']).default('upstash'),
  upstashRedisRestUrl: z.string().optional(),
  upstashRedisRestToken: z.string().optional(),
});

export const ProvidersConfigSchema = z.object({
  storage: StorageConfigSchema,
  vectorStore: VectorStoreConfigSchema,
  llm: LLMConfigSchema,
  embedding: EmbeddingConfigSchema,
  auth: AuthConfigSchema,
  rateLimiter: RateLimiterConfigSchema,
});
export type ProvidersConfig = z.infer<typeof ProvidersConfigSchema>;
