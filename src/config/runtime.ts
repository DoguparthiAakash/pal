import { RuntimeEnvironment, RuntimeInfo } from './schemas/runtimeSchema';

export function detectRuntimeEnvironment(envVars: NodeJS.ProcessEnv = process.env): RuntimeEnvironment {
  if (envVars.CI) return 'ci';
  if (envVars.NODE_ENV === 'test') return 'test';
  
  if (envVars.VERCEL_ENV === 'production') return 'production';
  if (envVars.VERCEL_ENV === 'preview') return 'preview';
  if (envVars.VERCEL_ENV === 'development') return 'development';
  
  if (envVars.NODE_ENV === 'production') return 'production';
  return 'development';
}

export function buildRuntimeInfo(envVars: NodeJS.ProcessEnv = process.env): RuntimeInfo {
  const env = detectRuntimeEnvironment(envVars);
  return {
    environment: env,
    isServerless: !!envVars.VERCEL,
    isDevelopment: env === 'development',
    isPreview: env === 'preview',
    isProduction: env === 'production',
    isTest: env === 'test',
    isCI: env === 'ci'
  };
}
