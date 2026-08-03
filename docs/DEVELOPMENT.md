# Development Mode

PAL's local development mode exists *strictly* to emulate the production Vercel environment. There are no "development-only" business logic branches. Instead, environment behavior is controlled purely through Dependency Injection and Configuration.

## Local Providers
Developers can opt to use local infrastructure to save costs and work offline. This is done by changing variables in `.env.local`:

- `STORAGE_PROVIDER=local` (Uses `LocalStorageProvider` writing to `.local_storage/`)
- `LLM_PROVIDER=ollama` (Uses `OllamaLLMProvider` connecting to `http://localhost:11434`)
- `EMBEDDING_PROVIDER=ollama` (Uses `OllamaEmbeddingProvider`)

The `ProviderRegistry` reads this configuration and injects the corresponding class into the `RequestContext`.

## Feature Flags
Certain tools are only available during development and are heavily guarded:

- `ENABLE_DEV_LOGIN`: Intercepts auth to inject a mock `developer@local` user (Never exposed in production).
- `ENABLE_DEBUG_PANEL`: Enables a React UI dashboard at `/dev/dashboard` showing memory usage and latency.
- `ENABLE_PROFILING`: Dumps trace spans to the console.

If `NODE_ENV === 'production'`, the config module strictly overrides these to `false`, guaranteeing production safety.
