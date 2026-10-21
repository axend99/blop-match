import { createClient } from '@supabase/supabase-js';

// Service-role client for the test scripts (never used by the app). Some shells export the
// REST endpoint (…/rest/v1) as the URL, so it is trimmed to the project URL.
export function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
