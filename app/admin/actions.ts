'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE, isAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { openReviewNow } from '@/lib/reviewService';
import { parseEmailList } from '@/lib/invite';
import { sendInvitePreview, sendInvites } from '@/lib/inviteService';
import { saveSnapshot } from '@/lib/visitService';
import { sendWaitlistPreview } from '@/lib/waitlistService';
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

// Saves the visit funnel totals now, so /admin can compare before × after a change.
export async function funnelSnapshot(formData: FormData): Promise<void> {
  if (!(await isAdmin())) return;
  await saveSnapshot(String(formData.get('label') ?? ''));
  await notice('Fotografia do funil guardada: a partir de agora o painel compara antes × depois.');
  revalidatePath('/admin');
}

export async function waitlistPreview(): Promise<void> {
  if (!(await isAdmin())) return;
  const n = await sendWaitlistPreview();
  await notice(`E-mail de teste da lista de espera enviado (PT e EN) para ${n} ${n === 1 ? 'endereço' : 'endereços'} de admin.`);
  revalidatePath('/admin');
}

// Invitation to try BLOP Match for a list of waiting-list addresses (pasted in /admin).
export async function invite(formData: FormData): Promise<void> {
  if (!(await isAdmin())) return;
  if (formData.get('mode') === 'preview') {
    const ok = await sendInvitePreview();
    await notice(ok ? 'Convite de teste enviado aos admins.' : 'Não foi possível enviar o convite de teste.');
  } else if (formData.get('confirm')) {
    const { valid, invalid } = parseEmailList(String(formData.get('emails') ?? ''));
    if (valid.length === 0) {
      await notice(`Nenhum e-mail válido na lista.${invalid.length ? ` Ignorados: ${invalid.join(', ')}.` : ''}`);
      revalidatePath('/admin');
      return;
    }
    const r = await sendInvites(valid, Date.now() + 45_000);
    const parts = [`Convites enviados: ${r.sent}.`];
    if (r.skipped.invited) parts.push(`Já convidados antes: ${r.skipped.invited}.`);
    if (r.skipped.participant) parts.push(`Já participam: ${r.skipped.participant}.`);
    if (r.skipped.banned) parts.push(`Banidos: ${r.skipped.banned}.`);
    if (r.failed) parts.push(`Falharam: ${r.failed} (podes tentar de novo).`);
    if (r.remaining) parts.push(`Faltam ${r.remaining} por falta de tempo: carrega de novo.`);
    if (invalid.length) parts.push(`Ignorados (não parecem e-mails): ${invalid.join(', ')}.`);
    await notice(parts.join(' '));
  }
  revalidatePath('/admin');
}

export async function adminSignOut(): Promise<void> {
  (await cookies()).set(ADMIN_COOKIE, '', { path: '/admin', maxAge: 0 });
  await (await createClient()).auth.signOut();
  redirect('/');
}
