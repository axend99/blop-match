import 'server-only';
import { isInviteCode, makeInviteCode } from '@/lib/game';
import { createServiceClient } from '@/lib/supabase/service';

// Invite a friend: the cookie set by /i/<code>, read when the friend creates their profile.
export const INVITE_COOKIE = 'blop_ref';

// The participant's invite code, created on first use (unique; a clash just draws again).
export async function ensureInviteCode(participantId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase.from('participants').select('invite_code').eq('id', participantId).maybeSingle();
  if (data?.invite_code) return data.invite_code;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeInviteCode();
    const { data: row, error } = await supabase
      .from('participants')
      .update({ invite_code: code })
      .eq('id', participantId)
      .is('invite_code', null)
      .select('invite_code')
      .maybeSingle();
    if (!error) {
      if (row?.invite_code) return row.invite_code;
      // Someone else (a parallel request) set it first: read it back.
      const { data: again } = await supabase.from('participants').select('invite_code').eq('id', participantId).maybeSingle();
      return again?.invite_code ?? null;
    }
    if (error.code !== '23505') {
      console.error('[invite] code not saved', error);
      return null;
    }
  }
  return null;
}

// Who invited a new participant: the owner of the code in the cookie (never themselves).
export async function inviterFor(code: string | undefined, selfUserId: string): Promise<string | null> {
  if (!code || !isInviteCode(code)) return null;
  const { data } = await createServiceClient()
    .from('participants')
    .select('id, user_id, deleted_at')
    .eq('invite_code', code)
    .maybeSingle();
  if (!data || data.deleted_at || data.user_id === selfUserId) return null;
  return data.id;
}
