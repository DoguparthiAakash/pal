# Configuration Guide

PAL uses a centralized, deeply frozen configuration object that strictly validates environment variables on startup. Application code **must never** read `process.env` directly. Always import `config` from `src/config`.

## 1. Feature Flags
These can be enabled locally but are strictly overridden to `false` in production.

- `ENABLE_DEV_LOGIN`: Skips Supabase OAuth and auto-logs in with a dummy user.
- `ENABLE_LOCAL_STORAGE`: Bypasses Supabase Storage for local `/tmp` storage.
- `ENABLE_LOCAL_LLM`: Routes LLM calls to Ollama.
- `ENABLE_LOCAL_EMBEDDINGS`: Routes embedding calls to Ollama.
- `ENABLE_LOCAL_VECTOR_DB`: Uses Faiss or Chroma instead of Supabase pgvector.
- `ENABLE_PROFILING`: Enables performance profiling.
- `ENABLE_DEBUG_LOGGING`: Increases log verbosity.
- `ENABLE_PERFORMANCE_METRICS`: Reports metrics to Observability layer.

## 2. Provider Environment Variables
Provider settings control which backend implementations the Application Services use.

### Storage Provider
- `STORAGE_PROVIDER`: `supabase` | `local` (Default: `supabase`)
- `NEXT_PUBLIC_SUPABASE_URL`: Required for supabase.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Required for supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: Required for backend supabase.

### LLM Provider
- `LLM_PROVIDER`: `groq` | `openai` | `ollama` (Default: `groq`)
- `GROQ_API_KEY`: Required if provider is `groq`.
- `OPENAI_API_KEY`: Required if provider is `openai`.

### Vector Store Provider
- `VECTOR_STORE_PROVIDER`: `supabase` | `chroma` | `faiss` (Default: `supabase`)

### Rate Limiter
- `RATE_LIMITER_PROVIDER`: `upstash` | `local` (Default: `upstash`)
- `UPSTASH_REDIS_REST_URL`: Required if using Upstash.
- `UPSTASH_REDIS_REST_TOKEN`: Required if using Upstash.

## 3. Strict Production Mode
If `VERCEL_ENV` or `NODE_ENV` is set to `production`:
1. All feature flags are completely ignored and hardcoded to `false`.
2. Missing API keys for the configured providers instantly throw a `ConfigError` preventing the application from starting and returning 500.
