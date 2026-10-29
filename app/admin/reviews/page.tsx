import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import AdminNav from '@/components/admin/AdminNav';
import { isAdmin } from '@/lib/admin';
import { loadAdminData, type AdminReview } from '@/lib/adminData';
import pt from '@/lib/i18n/pt';
import { dataMode, type DataMode } from '@/lib/stats';

// Every review one by one: who answered, about whom, and every answer (admin, in Portuguese).
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'BLOP Match · Reviews', robots: { index: false, follow: false } };

const R = pt.review;
const when = (iso: string) => new Date(iso).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon', dateStyle: 'short', timeStyle: 'short' });
const yesNo = (v: boolean | null | undefined) => (v == null ? '—' : v ? 'Sim' : 'Não');
const pick = (options: Record<string, string>, v: string | null | undefined) => (v ? (options[v] ?? v) : '—');

// The questions this person was actually asked (the form branches on contacted / talked).
function answers(r: AdminReview): [string, string][] {
  const rows: [string, string][] = [
    [R.contacted, yesNo(r.contacted)],
    [R.interest, `${r.interest_1_7}/7`],
  ];
  if (!r.contacted) rows.push([R.whyNot, pick(R.whyNotOptions, r.why_not)]);
  else {
    rows.push([R.whoFirst, pick(R.whoFirstOptions, r.who_first)], [R.comfort, `${r.comfort_1_7 ?? '—'}/7`], [R.talked, yesNo(r.talked)]);
    if (r.talked)
      rows.push(
        [R.flow, `${r.flow_1_7}/7`],
        [R.commonGround, `${r.common_ground_1_7}/7`],
        [R.satisfaction, `${r.satisfaction_1_7}/7`],
        [R.meetAgain, `${r.meet_again_1_7}/7`],
        [R.met, pick(R.metOptions, r.met)],
      );
  }
  if (r.ig_follow) rows.push([R.igFollow, pick(R.igFollowOptions, r.ig_follow)]);
  rows.push(
    [R.likesConcept, yesNo(r.likes_concept)],
    [R.bestFor, pick(R.bestForOptions, r.best_for)],
    [R.personality, pick(R.personalityOptions, r.personality)],
    ['Festa só para pessoas do BLOP?', pick(R.partyOptions, r.party_interest)],
  );
  return rows;
}

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ dados?: string; q?: string; grupo?: string }> }) {
  if (!(await isAdmin())) notFound();
  const { dados, q = '', grupo } = await searchParams;
  const mode = dataMode(dados);
  const { reviews, matchById, personById, seedCount, e2eCount, pendingCount, openReports } = await loadAdminData(mode);

  const query = q.trim().toLowerCase();
  const name = (id: string | undefined) => (id ? (personById.get(id)?.name ?? '—') : '—');
  const items = reviews
    .flatMap((r) => {
      const m = matchById.get(r.match_id);
      if (!m) return [];
      const aboutId = m.a_id === r.reviewer_id ? m.b_id : m.a_id;
      return [{ r, m, by: name(r.reviewer_id), about: name(aboutId) }];
    })
    .filter((x) => !grupo || x.m.type === (grupo === 'controlo' ? 'control' : 'compatible'))
    .filter((x) => !query || x.by.toLowerCase().includes(query) || x.about.toLowerCase().includes(query))
    .sort((a, b) => b.r.created_at.localeCompare(a.r.created_at));
  const href = (params: { dados?: DataMode; grupo?: string }) =>
    `/admin/reviews?${new URLSearchParams({
      dados: params.dados ?? mode,
      ...(q ? { q } : {}),
      ...((params.grupo ?? grupo) ? { grupo: params.grupo ?? grupo! } : {}),
    })}`;
  const pill = (active: boolean) => `rounded-full border px-3 py-1 ${active ? 'border-violet bg-violet text-white' : 'border-midnight/20 bg-white'}`;

  return (
    <div className="relative left-1/2 w-[calc(100vw-2rem)] max-w-6xl -translate-x-1/2 space-y-6 text-midnight">
      <AdminNav tab="reviews" mode={mode} href={(dados) => href({ dados })} seedCount={seedCount} e2eCount={e2eCount} toReview={pendingCount + openReports} />

      <form action="/admin/reviews" className="flex gap-2">
        <input type="hidden" name="dados" value={mode} />
        {grupo && <input type="hidden" name="grupo" value={grupo} />}
        <input
          name="q"
          defaultValue={q}
          placeholder="Procurar por nome (quem respondeu ou sobre quem)"
          className="min-w-0 flex-1 rounded-full border border-midnight/20 bg-white px-4 py-2 text-sm"
        />
        <button className="rounded-full bg-violet px-4 py-2 text-sm font-semibold text-white">Procurar</button>
      </form>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href={href({ grupo: '' })} className={pill(!grupo)}>
          Todas
        </Link>
        <Link href={href({ grupo: 'compativel' })} className={pill(grupo === 'compativel')}>
          Compatível
        </Link>
        <Link href={href({ grupo: 'controlo' })} className={pill(grupo === 'controlo')}>
          Controlo
        </Link>
        <span className="text-midnight/60">
          {items.length} {items.length === 1 ? 'review' : 'reviews'}, as mais recentes primeiro
        </span>
      </div>

      {items.length === 0 && <p className="text-sm text-midnight/60">Ainda não há reviews{query || grupo ? ' com este filtro' : ''}.</p>}
      <ul className="grid gap-4 lg:grid-cols-2">
        {items.map(({ r, m, by, about }) => (
          <li key={r.id} className="space-y-3 rounded-3xl bg-white p-4 text-sm sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-base">
                <b>{by}</b> <span className="text-midnight/60">sobre</span> <b>{about}</b>
              </p>
              <span className="text-xs text-midnight/60">{when(r.created_at)}</span>
            </div>
            <p className="flex flex-wrap gap-2 text-xs">
              <span className={`rounded-full px-2 py-0.5 font-semibold ${m.type === 'compatible' ? 'bg-violet/15' : 'bg-lime/60'}`}>
                {m.type === 'compatible' ? 'Compatível' : 'Controlo'}
              </span>
              <span className="rounded-full bg-paper px-2 py-0.5">
                {m.shared_count} {m.shared_count === 1 ? 'interesse' : 'interesses'} em comum · {m.points} pontos
              </span>
            </p>
            <dl className="divide-y divide-midnight/5">
              {answers(r).map(([question, answer]) => (
                <div key={question} className="flex justify-between gap-4 py-1.5">
                  <dt className="text-midnight/70">{question}</dt>
                  <dd className="shrink-0 text-right font-semibold">{answer}</dd>
                </div>
              ))}
            </dl>
            {r.comment && <p className="whitespace-pre-wrap break-words rounded-2xl bg-paper p-3">“{r.comment}”</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
