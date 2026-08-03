import { createClient } from '@supabase/supabase-js';

import { config } from '@/config';

const supabaseUrl = config.providers.storage.supabaseUrl || 'http://127.0.0.1:54321';
const supabaseKey = config.providers.storage.supabaseServiceRoleKey || 'dummy'; // Using service role key for backend operations

export const supabase = createClient(supabaseUrl, supabaseKey);
