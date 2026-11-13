'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getMyParticipant, getUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { createClient } from '@/lib/supabase/server';
import { deleteParticipantData } from '@/lib/deleteParticipant';

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

// "Delete my data" (at the end of /about, next to "Leave the study"): anonymises the caller's own
// profile, deletes their login and signs them out.
export async function deleteMyData(): Promise<{ ok: boolean }> {
  const user = await getUser();
  if (!user) redirect('/login');
  const me = await getMyParticipant();
  if (!me) redirect('/join');
  if (!(await deleteParticipantData(me.id, user.id))) return { ok: false };
  await (await createClient()).auth.signOut();
  redirect('/?deleted=1');
}
