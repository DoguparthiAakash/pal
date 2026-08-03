import { buildConfig } from './build';

// Re-export types
export * from './errors';
export * from './runtime';
export * from './schemas/appSchema';
export * from './schemas/featureFlagsSchema';
export * from './schemas/providersSchema';
export * from './schemas/runtimeSchema';
export * from './build';

// The single, centralized configuration singleton
export const config = buildConfig();

// Lightweight startup banner (only logged once during initialization in dev/ci)
if (config.runtime.isDevelopment || config.runtime.isCI) {
  // Use a simple guard to avoid spamming the console on HMR in Next.js
  if (!(global as any).__CONFIG_BANNER_LOGGED) {
    (global as any).__CONFIG_BANNER_LOGGED = true;
    console.log('--------------------------------------------------');
    console.log(`🚀 PAL Starting... (Version: ${config.app.version})`);
    console.log(`🌍 Runtime: ${config.runtime.environment}`);
    console.log(`🔌 Storage: ${config.providers.storage.provider}`);
    console.log(`🧠 LLM: ${config.providers.llm.provider}`);
    console.log(`🔍 Vector: ${config.providers.vectorStore.provider}`);
    console.log('--------------------------------------------------');
  }
}
