import { createClient } from '@supabase/supabase-js';

import { config } from '@/config';

const supabaseUrl = config.providers.storage.supabaseUrl || 'http://127.0.0.1:54321';
const supabaseAnonKey = config.providers.storage.supabaseAnonKey || 'dummy';

export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
