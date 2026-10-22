import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasSupabaseEnv } from '@/lib/supabase/env';

export type MyParticipant = { id: string; name: string; lang: string; active: boolean; interests: string[]; instagram: string | null };

export async function getUser() {
  if (!hasSupabaseEnv()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Reads the caller's own row through RLS.
export async function getMyParticipant(): Promise<MyParticipant | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('participants')
    .select('id, name, lang, active, interests, instagram')
    .maybeSingle();
  return data;
}

// Navigation rule (SPEC §3): logged in without profile → /join; with profile → /me.
// `next`: a safe /me/... path to go to instead of /me (e.g. a report link from an e-mail).
export async function redirectIfLoggedIn(next?: string | null): Promise<void> {
  const user = await getUser();
  if (!user) return;
  redirect((await getMyParticipant()) ? (next ?? '/me') : '/join');
}
