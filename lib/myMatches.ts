import 'server-only';
import { createClient } from '@/lib/supabase/server';

// What a participant may see about their matches (get_my_matches): never type, score or email.
export type MyMatch = {
  match_id: string;
  created_at: string;
  other_name: string;
  other_whatsapp: string | null;
  other_instagram: string | null;
  shared_items: string[];
  reviewed_by_me: boolean;
  other_deleted: boolean;
  other_age_range: string | null;
  other_age: number | null;
  other_city: string | null;
  other_interests: string[];
  other_talk_about: string | null;
  other_talk_about_code: string | null;
};

export async function getMyMatches(): Promise<MyMatch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_my_matches');
  if (error) throw error;
  return (data ?? []) as MyMatch[];
}
