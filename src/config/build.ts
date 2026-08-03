import { ConfigError } from './errors';
import { buildRuntimeInfo } from './runtime';
import { AppConfigSchema, AppConfig } from './schemas/appSchema';
import { FeatureFlagsSchema, FeatureFlags } from './schemas/featureFlagsSchema';
import { ProvidersConfigSchema, ProvidersConfig } from './schemas/providersSchema';
import { RuntimeInfo } from './schemas/runtimeSchema';

export type Config = {
  runtime: RuntimeInfo;
  app: AppConfig;
  flags: FeatureFlags;
  providers: ProvidersConfig;
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey: string;
  };
};

// Deep freeze utility
function deepFreeze<T extends object>(obj: T): T {
  Object.keys(obj).forEach(prop => {
    const value = (obj as any)[prop];
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  });
  return Object.freeze(obj);
}

export function buildConfig(envVars: NodeJS.ProcessEnv = process.env): Config {
  // 1. Build runtime info
  const runtime = buildRuntimeInfo(envVars);

  // 2. Parse basic schemas with Zod defaults
  // Precedence: Defaults -> Environment Variables
  const appResult = AppConfigSchema.safeParse({
    version: envVars.npm_package_version || '0.1.0',
    commitHash: envVars.VERCEL_GIT_COMMIT_SHA || 'unknown',
  });

  const flagsResult = FeatureFlagsSchema.safeParse({
    ENABLE_DEV_LOGIN: envVars.ENABLE_DEV_LOGIN === 'true',
    ENABLE_LOCAL_STORAGE: envVars.ENABLE_LOCAL_STORAGE === 'true',
    ENABLE_LOCAL_LLM: envVars.ENABLE_LOCAL_LLM === 'true',
    ENABLE_LOCAL_EMBEDDINGS: envVars.ENABLE_LOCAL_EMBEDDINGS === 'true',
    ENABLE_LOCAL_VECTOR_DB: envVars.ENABLE_LOCAL_VECTOR_DB === 'true',
    ENABLE_PROFILING: envVars.ENABLE_PROFILING === 'true',
    ENABLE_DEBUG_LOGGING: envVars.ENABLE_DEBUG_LOGGING === 'true',
    ENABLE_PERFORMANCE_METRICS: envVars.ENABLE_PERFORMANCE_METRICS === 'true',
    ENABLE_LOCAL_SUPABASE: envVars.ENABLE_LOCAL_SUPABASE === 'true',
  });

  const providersResult = ProvidersConfigSchema.safeParse({
    storage: {
      provider: envVars.STORAGE_PROVIDER || 'supabase',
      supabaseUrl: envVars.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      supabaseServiceRoleKey: envVars.SUPABASE_SERVICE_ROLE_KEY,
    },
    vectorStore: {
      provider: envVars.VECTOR_STORE_PROVIDER || 'supabase',
    },
    llm: {
      provider: envVars.LLM_PROVIDER || 'groq',
      groqApiKey: envVars.GROQ_API_KEY,
      openaiApiKey: envVars.OPENAI_API_KEY,
    },
    embedding: {
      provider: envVars.EMBEDDING_PROVIDER || 'mock',
      openaiApiKey: envVars.OPENAI_API_KEY,
    },
    auth: {
      provider: envVars.AUTH_PROVIDER || 'supabase',
    },
    rateLimiter: {
      provider: envVars.RATE_LIMITER_PROVIDER || 'local', // defaulting to local if upstash is not configured
      upstashRedisRestUrl: envVars.UPSTASH_REDIS_REST_URL,
      upstashRedisRestToken: envVars.UPSTASH_REDIS_REST_TOKEN,
    }
  });

  if (!appResult.success) throw new ConfigError('Invalid App Config', appResult.error.format());
  if (!flagsResult.success) throw new ConfigError('Invalid Feature Flags', flagsResult.error.format());
  if (!providersResult.success) throw new ConfigError('Invalid Provider Config', providersResult.error.format());

  const config = {
    runtime,
    app: appResult.data,
    flags: flagsResult.data,
    providers: providersResult.data,
    supabase: {
      url: providersResult.data.storage.supabaseUrl || (flagsResult.data.ENABLE_LOCAL_SUPABASE ? 'http://127.0.0.1:54321' : ''),
      anonKey: providersResult.data.storage.supabaseAnonKey || 'dummy',
      serviceRoleKey: providersResult.data.storage.supabaseServiceRoleKey || 'dummy',
    }
  };

  // Normalize URL
  if (config.supabase.url) {
    config.supabase.url = config.supabase.url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  }

  // 3. Runtime overrides and strict checks
  if (config.runtime.isProduction || config.runtime.isPreview) {
    // Force override all debug flags to false in production
    config.flags = {
      ENABLE_DEV_LOGIN: false,
      ENABLE_LOCAL_STORAGE: false,
      ENABLE_LOCAL_LLM: false,
      ENABLE_LOCAL_EMBEDDINGS: false,
      ENABLE_LOCAL_VECTOR_DB: false,
      ENABLE_PROFILING: false,
      ENABLE_DEBUG_LOGGING: false,
      ENABLE_PERFORMANCE_METRICS: false,
      ENABLE_LOCAL_SUPABASE: false,
    };

    // Force override providers to production defaults if somehow configured locally
    config.providers.storage.provider = 'supabase';
    config.providers.vectorStore.provider = 'supabase';
    config.providers.auth.provider = 'supabase';

    // Validate external keys exist
    if (!config.providers.storage.supabaseUrl) {
      throw new ConfigError('NEXT_PUBLIC_SUPABASE_URL is required in production');
    }
    if (!config.providers.storage.supabaseAnonKey) {
      throw new ConfigError('NEXT_PUBLIC_SUPABASE_ANON_KEY is required in production');
    }
    if (!config.providers.storage.supabaseServiceRoleKey) {
      throw new ConfigError('SUPABASE_SERVICE_ROLE_KEY is required in production');
    }
    if (config.providers.llm.provider === 'groq' && !config.providers.llm.groqApiKey) {
      throw new ConfigError('GROQ_API_KEY is required in production when using groq');
    }
  }

  // Validate URL restrictions
  if (!config.flags.ENABLE_LOCAL_SUPABASE) {
    if (config.supabase.url.includes('localhost') || config.supabase.url.includes('127.0.0.1')) {
      throw new ConfigError('Localhost Supabase URL is not allowed in production');
    }
  }

  // Diagnostics logging in dev
  if (config.runtime.isDevelopment && config.flags.ENABLE_DEBUG_LOGGING) {
    console.log(`[Config] Runtime: ${config.runtime.environment}`);
    console.log(`[Config] Supabase: ${config.supabase.url}`);
    console.log(`[Config] Auth Provider: ${config.providers.auth.provider}`);
  }

  // Preview environment overrides (similar to production but allows some flexibility)
  if (config.runtime.isPreview) {
    config.flags.ENABLE_DEV_LOGIN = false; // Never allow dev login in preview
  }

  // 4. Return deeply frozen configuration
  return deepFreeze(config);
}
