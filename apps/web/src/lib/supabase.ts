import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseAnonKey, getSupabaseUrl } from './supabase-config';

export const supabase = createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
