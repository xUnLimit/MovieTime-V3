import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/platform/supabase/database.types';

let supabaseClient: SupabaseClient<Database> | null = null;

export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (supabaseClient) return supabaseClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  if (!serviceRole) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY (server-side only)');

  supabaseClient = createClient<Database>(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  });
  return supabaseClient;
}
