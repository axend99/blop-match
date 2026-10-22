import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { approve, archiveReport, recheck } from '@/app/admin/actions';
import AdminNav from '@/components/admin/AdminNav';
import BanForm from '@/components/admin/BanForm';
import { isAdmin, isAdminEmail } from '@/lib/admin';
import { FLAG_CATEGORY, REPORT_REASON, flagField } from '@/lib/adminLabels';
import { loadAdminData } from '@/lib/adminData';
import { interestLabel } from '@/lib/i18n';

// Profiles held before matching (AI flagged something, or the check failed) and reports
// from participants. Approving runs matching and sends e-mails, hence the longer limit.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const metadata: Metadata = { title: 'BLOP Match · Verificação', robots: { index: false, follow: false } };

const when = (iso: string) => new Date(iso).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon', dateStyle: 'short', timeStyle: 'short' });

export default async function VerificationPage() {
  if (!(await isAdmin())) notFound();
  const notice = (await cookies()).get('admin_notice')?.value;
  const { seedCount, e2eCount, pendingCount, openReports, reports, allPeople, allFlags } = await loadAdminData('tudo');

  const open = reports.filter((r) => !r.resolved_at).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const reported = new Set(open.map((r) => r.reported_id));
  const held = [...allPeople.values()]
    .filter((p) => p.pending_review && !p.deleted_at && !p.is_seed)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  // Held because of the profile check (new profiles); people held only by a report are listed below.
  const profiles = held.filter((p) => !reported.has(p.id) || allFlags.some((f) => f.participant_id === p.id && !f.match_id && !f.resolved_at));
  const name = (id: string | null) => (id ? (allPeople.get(id)?.name ?? '—') : 'pessoa removida');

  return (
    <div className="relative left-1/2 w-[calc(100vw-2rem)] max-w-6xl -translate-x-1/2 space-y-6 text-midnight">
      <AdminNav tab="verificacao" mode="tudo" href={() => '/admin/verificacao'} seedCount={0} e2eCount={e2eCount} toReview={pendingCount + openReports} />
      {notice && <p className="rounded-2xl bg-lime/60 p-3 text-sm font-medium">{notice}</p>}
      {seedCount > 0 && <p className="text-xs text-midnight/50">Os participantes de seed nunca aparecem aqui.</p>}

      <section className="space-y-3 rounded-3xl bg-white p-4 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">Perfis por verificar ({profiles.length})</h2>
          <p className="text-sm text-midnight/60">
            Perfis novos em que a verificação automática marcou o nome ou os textos, ou falhou. Não recebem matches até serem
            aprovados. A pessoa não sabe que está em verificação.
          </p>
        </div>
        {profiles.length === 0 && <p className="text-sm text-midnight/60">Nada por verificar.</p>}
        <ul className="space-y-3">
          {profiles.map((p) => {
            const flags = allFlags.filter((f) => f.participant_id === p.id && !f.match_id && !f.resolved_at);
            return (
              <li key={p.id} className="space-y-2 rounded-2xl border border-midnight/10 p-3 text-sm">
                <p className="flex flex-wrap items-center gap-x-2">
                  <span className="text-base font-semibold">{p.name}</span>
                  <span className="text-midnight/60">
                    {p.email} · {p.age ?? p.age_range} · {p.city} · {when(p.created_at)}
                  </span>
                </p>
                <p className="break-words">
                  <span className="text-midnight/60">Quer falar sobre: </span>
                  {p.talk_about_code ? interestLabel(p.talk_about_code, 'pt') : (p.talk_about ?? '—')}
                </p>
                {Object.values(p.other_text ?? {}).length > 0 && (
                  <p className="break-words">
                    <span className="text-midnight/60">Outro: </span>
                    {Object.values(p.other_text).join(' · ')}
                  </p>
                )}
                {flags.length === 0 ? (
                  <p className="text-midnight/60">Sem resultado da verificação automática (ainda a correr ou não foi guardado).</p>
                ) : (
                  <ul className="space-y-1">
                    {flags.map((f) => (
                      <li key={f.id} className="rounded-xl bg-pink/30 p-2">
                        <b>{flagField(f.field)}</b> ·{' '}
                        {f.status === 'flagged' ? (FLAG_CATEGORY[f.category ?? ''] ?? f.category) : 'verificação falhou'}
                        <span className="block break-words">“{f.text}”</span>
                        {f.reason && <span className="block text-midnight/70">{f.reason}</span>}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap items-start gap-2">
                  <form action={approve}>
                    <input type="hidden" name="participantId" value={p.id} />
                    <button className="rounded-full bg-violet px-4 py-1.5 font-semibold text-white">Aprovar</button>
                  </form>
                  <form action={recheck}>
                    <input type="hidden" name="participantId" value={p.id} />
                    <button className="rounded-full border border-midnight/20 px-4 py-1.5 font-medium">Verificar de novo</button>
                  </form>
                  {!isAdminEmail(p.email ?? undefined) && <BanForm participantId={p.id} name={p.name} />}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3 rounded-3xl bg-white p-4 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">Denúncias por ver ({open.length})</h2>
          <p className="text-sm text-midnight/60">
            Feitas pelos participantes nos seus matches. A pessoa denunciada fica sem matches novos até a denúncia ser arquivada
            (e não houver outras pendências) ou ser banida. Nunca sabe quem a denunciou.
          </p>
        </div>
        {open.length === 0 && <p className="text-sm text-midnight/60">Nenhuma denúncia por ver.</p>}
        <ul className="space-y-3">
          {open.map((r) => (
            <li key={r.id} className="space-y-2 rounded-2xl border border-midnight/10 p-3 text-sm">
              <p>
                <b>{REPORT_REASON[r.reason] ?? r.reason}</b> · {when(r.created_at)}
              </p>
              <p>
                <span className="text-midnight/60">Denunciado: </span>
                <Link href={`/admin/participantes?dados=tudo&q=${encodeURIComponent(name(r.reported_id))}`} className="font-semibold text-violet underline">
                  {name(r.reported_id)}
                </Link>
                <span className="text-midnight/60"> · por </span>
                {name(r.reporter_id)}
              </p>
              {r.details && <p className="whitespace-pre-wrap break-words rounded-xl bg-paper p-2">{r.details}</p>}
              <div className="flex flex-wrap items-start gap-2">
                <form action={archiveReport}>
                  <input type="hidden" name="reportId" value={r.id} />
                  <button className="rounded-full border border-midnight/20 px-4 py-1.5 font-medium">Arquivar</button>
                </form>
                {r.reported_id && allPeople.get(r.reported_id) && <BanForm participantId={r.reported_id} name={name(r.reported_id)} />}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
