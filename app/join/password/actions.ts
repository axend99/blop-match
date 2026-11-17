'use server';

import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { getMyParticipant, getUser } from '@/lib/auth';
import { runMatchingFor } from '@/lib/matchingService';
import { validatePassword } from '@/lib/password';
import { createServiceClient } from '@/lib/supabase/service';

// Saves the v2 password once (it cannot be changed afterwards, so matches can rely on it), then
// fills the person's match slots: matching skips v2 people without a password.
export async function savePassword(input: string): Promise<{ error?: 'invalid' | 'failed' }> {
  if (!(await getUser())) redirect('/login');
  const me = await getMyParticipant();
  if (!me) redirect('/join');
  if (me.cohort !== 'v2' || me.password) redirect('/me');

  const check = validatePassword(input);
  if (!check.ok) return { error: 'invalid' };

  const { error } = await createServiceClient()
    .from('participants')
    .update({ password: check.value })
    .eq('id', me.id)
    .is('password', null);
  if (error) {
    console.error('[password] save failed', error);
    return { error: 'failed' };
  }

  after(async () => {
    try {
      await runMatchingFor(me.id); // no-op while the profile is still being verified
    } catch (err) {
      console.error('[password] matching failed', err);
    }
  });
  redirect('/me');
}
