'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE, isAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { openReviewNow } from '@/lib/reviewService';
import { createServiceClient } from '@/lib/supabase/service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveFlag(formData: FormData): Promise<void> {
  if (!(await isAdmin())) return;
  const id = String(formData.get('id') ?? '');
  if (!UUID.test(id)) return;
  const { error } = await createServiceClient()
    .from('content_flags')
    .update({ resolved_at: new Date().toISOString() })
    .eq('id', id)
    .is('resolved_at', null);
  if (error) throw error;
  revalidatePath('/admin');
}

// "Abrir avaliação agora" (Participantes tab): opens one match's review for testers.
export async function openReview(formData: FormData): Promise<void> {
  if (!(await isAdmin())) return;
  const id = String(formData.get('matchId') ?? '');
  if (!UUID.test(id)) return;
  const sent = await openReviewNow(id);
  // The page shows how many e-mails went out (0: already asked, answered, inactive or no e-mail).
  (await cookies()).set('admin_notice', `Avaliação aberta · ${sent} ${sent === 1 ? 'e-mail enviado' : 'e-mails enviados'}`, {
    path: '/admin',
    maxAge: 60,
  });
  revalidatePath('/admin/participantes');
}

export async function adminSignOut(): Promise<void> {
  (await cookies()).set(ADMIN_COOKIE, '', { path: '/admin', maxAge: 0 });
  await (await createClient()).auth.signOut();
  redirect('/');
}
