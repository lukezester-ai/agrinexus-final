import { createClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseUrl } from './supabase-config';

export const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey());
