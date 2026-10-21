'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getMyParticipant, getUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';

// "Leave the study" (at the end of /about): deactivates the caller's own profile (no new matches).
export async function leaveStudy(): Promise<{ ok: boolean }> {
  if (!(await getUser())) redirect('/login');
  const me = await getMyParticipant();
  if (!me) redirect('/join');
  if (me.active) {
    const { error } = await createServiceClient().from('participants').update({ active: false }).eq('id', me.id);
    if (error) {
      console.error('[me] leave failed', error);
      return { ok: false };
    }
  }
  revalidatePath('/me');
  revalidatePath('/about');
  return { ok: true };
}
