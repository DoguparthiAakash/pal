import { createBrowserClient as createSSRClient } from '@supabase/ssr';
import { config } from '@/config';

let client: ReturnType<typeof createSSRClient> | undefined;

export function createBrowserClient() {
  if (client) return client;

  client = createSSRClient(
    config.supabase.url,
    config.supabase.anonKey
  );

  return client;
}
