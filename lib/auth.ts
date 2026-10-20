import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasSupabaseEnv } from '@/lib/supabase/env';

export type MyParticipant = { id: string; name: string; lang: string; active: boolean };

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
    .select('id, name, lang, active')
    .maybeSingle();
  return data;
}

// Navigation rule (SPEC §3): logged in without profile → /join; with profile → /me.
export async function redirectIfLoggedIn(): Promise<void> {
  const user = await getUser();
  if (!user) return;
  redirect((await getMyParticipant()) ? '/me' : '/join');
}
