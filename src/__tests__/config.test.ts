import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildConfig } from '../config/build';
import { ConfigError } from '../config/errors';

describe('Configuration Builder', () => {
  it('builds development config correctly with defaults', () => {
    const env = { VERCEL_ENV: 'development', ENABLE_DEV_LOGIN: 'true' };
    const config = buildConfig(env as any);

    expect(config.runtime.isDevelopment).toBe(true);
    expect(config.flags.ENABLE_DEV_LOGIN).toBe(true);
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('enforces strict production checks (overriding debug flags)', () => {
    const env = { 
      VERCEL_ENV: 'production', 
      ENABLE_DEV_LOGIN: 'true',
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service',
      LLM_PROVIDER: 'groq',
      GROQ_API_KEY: 'gsk_123'
    };
    const config = buildConfig(env as any);

    expect(config.runtime.isProduction).toBe(true);
    // Even though env requested it, production strictly disables it
    expect(config.flags.ENABLE_DEV_LOGIN).toBe(false); 
  });

  it('throws ConfigError if production is missing GROQ key', () => {
    const env = { 
      VERCEL_ENV: 'production', 
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service',
      LLM_PROVIDER: 'groq'
      // missing GROQ_API_KEY
    };
    
    expect(() => buildConfig(env as any)).toThrow(ConfigError);
  });

  it('throws ConfigError if production is missing Supabase keys', () => {
    const env = { 
      VERCEL_ENV: 'production', 
      LLM_PROVIDER: 'groq',
      GROQ_API_KEY: 'gsk_123'
      // missing SUPABASE keys
    };
    
    expect(() => buildConfig(env as any)).toThrow(ConfigError);
  });

  it('normalizes Supabase URL by removing trailing /rest/v1 or /rest/v1/', () => {
    const env = { 
      VERCEL_ENV: 'production', 
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co/rest/v1/',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service',
      LLM_PROVIDER: 'groq',
      GROQ_API_KEY: 'gsk_123'
    };
    
    const config = buildConfig(env as any);
    expect(config.supabase.url).toBe('https://test.supabase.co');
  });

  it('rejects localhost Supabase URL in production without ENABLE_LOCAL_SUPABASE flag', () => {
    const env = { 
      VERCEL_ENV: 'production', 
      NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service',
      LLM_PROVIDER: 'groq',
      GROQ_API_KEY: 'gsk_123'
    };
    
    expect(() => buildConfig(env as any)).toThrow(ConfigError);
    expect(() => buildConfig(env as any)).toThrow(/Localhost Supabase URL is not allowed in production/);
  });

  it('allows localhost Supabase URL in development if ENABLE_LOCAL_SUPABASE is true', () => {
    const env = { 
      VERCEL_ENV: 'development', 
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service',
      LLM_PROVIDER: 'groq',
      GROQ_API_KEY: 'gsk_123',
      ENABLE_LOCAL_SUPABASE: 'true'
    };
    
    const config = buildConfig(env as any);
    expect(config.supabase.url).toBe('http://127.0.0.1:54321');
  });
});
