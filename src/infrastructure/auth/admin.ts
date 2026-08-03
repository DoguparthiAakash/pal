import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { config } from '@/config';

const supabaseUrl = config.supabase.url;
const supabaseKey = config.supabase.serviceRoleKey;

export const adminClient = createClient(supabaseUrl, supabaseKey);
