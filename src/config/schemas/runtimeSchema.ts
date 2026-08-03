import { z } from 'zod';

export const RuntimeEnvSchema = z.enum(['development', 'preview', 'production', 'test', 'ci']);
export type RuntimeEnvironment = z.infer<typeof RuntimeEnvSchema>;

export const RuntimeInfoSchema = z.object({
  environment: RuntimeEnvSchema,
  isServerless: z.boolean(),
  isDevelopment: z.boolean(),
  isPreview: z.boolean(),
  isProduction: z.boolean(),
  isTest: z.boolean(),
  isCI: z.boolean(),
});
export type RuntimeInfo = z.infer<typeof RuntimeInfoSchema>;
