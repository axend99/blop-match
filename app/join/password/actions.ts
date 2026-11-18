'use server';

import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { getMyParticipant, getUser } from '@/lib/auth';
import { pickNickname } from '@/lib/game';
import { classifyWord } from '@/lib/guessCheck';
import { runMatchingFor } from '@/lib/matchingService';
import { validatePassword } from '@/lib/password';
import { createServiceClient } from '@/lib/supabase/service';

// Saves the v2 password once (it cannot be changed afterwards, so matches can rely on it), with
// the leaderboard choice and a random nickname, then fills the person's match slots: matching
// skips v2 people without a password.
export async function savePassword(input: string, showName: boolean): Promise<{ error?: 'invalid' | 'failed' }> {
  if (!(await getUser())) redirect('/login');
  const me = await getMyParticipant();
  if (!me) redirect('/join');
  if (me.password || !me.active) redirect('/me');

  const check = validatePassword(input);
  if (!check.ok) return { error: 'invalid' };

  const supabase = createServiceClient();
  // Hint for the matches (noun, verb…); a failed check just leaves it out.
  const kind = await classifyWord(check.value);
  // The nickname is unique: on a clash with someone saving at the same moment, pick again.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: taken } = await supabase.from('participants').select('nickname').not('nickname', 'is', null);
    const nickname = pickNickname(new Set((taken ?? []).map((p) => p.nickname as string)));
    const { error } = await supabase
      .from('participants')
      .update({
        password: check.value,
        password_kind: kind,
        nickname,
        leaderboard_show_name: showName === true,
        // v1 → v2: from now on they are matched (with v2 people only) and get e-mails again.
        ...(me.cohort === 'v1' ? { cohort: 'v2', upgraded_at: new Date().toISOString() } : {}),
      })
      .eq('id', me.id)
      .is('password', null);
    if (!error) {
      after(async () => {
        try {
          await runMatchingFor(me.id); // no-op while the profile is still being verified
        } catch (err) {
          console.error('[password] matching failed', err);
        }
      });
      redirect('/me');
    }
    if (error.code !== '23505') {
      console.error('[password] save failed', error);
      return { error: 'failed' };
    }
  }
  return { error: 'failed' };
}
