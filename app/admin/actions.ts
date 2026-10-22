'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE, isAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { openReviewNow } from '@/lib/reviewService';
import { approveProfile, banParticipant, dismissReport, recheckProfile, type ResumeResult } from '@/lib/verification';
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

// A short message for the next admin page view (60 s).
async function notice(text: string) {
  (await cookies()).set('admin_notice', text, { path: '/admin', maxAge: 60 });
}

const RESUME: Record<ResumeResult | 'flagged' | 'error', string> = {
  resumed: 'Aprovado: entrou no matching.',
  held: 'Continua pausado: há uma denúncia aberta ou alertas por ver.',
  unchanged: 'Nada a fazer (já estava aprovado ou já não existe).',
  flagged: 'A verificação voltou a marcar o perfil: continua pendente.',
  error: 'A verificação automática falhou outra vez: continua pendente.',
};

function idFrom(formData: FormData, key: string): string | null {
  const id = String(formData.get(key) ?? '');
  return UUID.test(id) ? id : null;
}

export async function approve(formData: FormData): Promise<void> {
  if (!(await isAdmin())) return;
  const id = idFrom(formData, 'participantId');
  if (!id) return;
  await notice(RESUME[await approveProfile(id)]);
  revalidatePath('/admin', 'layout');
}

export async function recheck(formData: FormData): Promise<void> {
  if (!(await isAdmin())) return;
  const id = idFrom(formData, 'participantId');
  if (!id) return;
  await notice(RESUME[await recheckProfile(id)]);
  revalidatePath('/admin', 'layout');
}

export async function archiveReport(formData: FormData): Promise<void> {
  if (!(await isAdmin())) return;
  const id = idFrom(formData, 'reportId');
  if (!id) return;
  const result = await dismissReport(id);
  await notice(result === 'resumed' ? 'Denúncia arquivada: a pessoa voltou ao matching.' : result === 'held' ? 'Denúncia arquivada: a pessoa continua pausada (há outras pendências).' : 'Denúncia arquivada.');
  revalidatePath('/admin', 'layout');
}

// Needs the confirmation box ticked (checked here too, not only in the HTML).
export async function ban(formData: FormData): Promise<void> {
  if (!(await isAdmin())) return;
  const id = idFrom(formData, 'participantId');
  if (!id || formData.get('confirm') !== 'yes') {
    await notice('Para banir, marque a caixa de confirmação.');
    revalidatePath('/admin', 'layout');
    return;
  }
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 200);
  const done = await banParticipant(id, reason);
  await notice(done ? 'Conta banida: e-mail bloqueado e dados removidos.' : 'Não é possível banir esta conta (admin, seed ou já removida).');
  revalidatePath('/admin', 'layout');
}

export async function adminSignOut(): Promise<void> {
  (await cookies()).set(ADMIN_COOKIE, '', { path: '/admin', maxAge: 0 });
  await (await createClient()).auth.signOut();
  redirect('/');
}
