import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import AdminNav from '@/components/admin/AdminNav';
import { isAdmin } from '@/lib/admin';
import { loadAdminData, type AdminParticipant, type AdminReview } from '@/lib/adminData';
import { interestLabel } from '@/lib/i18n';
import pt from '@/lib/i18n/pt';
import { dataMode, participantMatches, type DataMode } from '@/lib/stats';

// Who the participants are and each one's matches (admin, in Portuguese).
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'BLOP Match · Participantes', robots: { index: false, follow: false } };

const when = (iso: string) => new Date(iso).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon', dateStyle: 'short', timeStyle: 'short' });
const LANG: Record<string, string> = { en: 'Inglês', pt: 'Português' };
const CHANNEL: Record<string, string> = { whatsapp: 'WhatsApp', instagram: 'Instagram' };

function state(p: AdminParticipant) {
  if (p.deleted_at) return ['anonimizado', 'bg-midnight/10'];
  if (p.is_seed) return ['seed', 'bg-lime/60'];
  return p.active ? ['ativo', 'bg-violet/15'] : ['inativo', 'bg-pink/50'];
}

function reviewText(r: AdminReview | null) {
  if (!r) return 'sem review';
  if (!r.contacted) return `não contactou (${pt.review.whyNotOptions[r.why_not as keyof typeof pt.review.whyNotOptions] ?? r.why_not})`;
  if (!r.talked) return 'contactou, sem conversa';
  return `conversou · satisfação ${r.satisfaction_1_7}/7${r.met ? ` · encontro: ${pt.review.metOptions[r.met as keyof typeof pt.review.metOptions]}` : ''}`;
}

export default async function ParticipantsPage({ searchParams }: { searchParams: Promise<{ dados?: string; q?: string }> }) {
  if (!(await isAdmin())) notFound();
  const { dados, q = '' } = await searchParams;
  const mode = dataMode(dados);
  const { participants, matches, reviews, clicks, personById, seedCount, e2eCount } = await loadAdminData(mode);

  const query = q.trim().toLowerCase();
  const shown = participants
    .filter((p) => !query || p.name.toLowerCase().includes(query) || (p.email ?? '').toLowerCase().includes(query))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const byPerson = participantMatches({ matches, reviews, clicks });
  const href = (params: { dados?: DataMode; q?: string }) =>
    `/admin/participantes?${new URLSearchParams({ dados: params.dados ?? mode, ...((params.q ?? q) ? { q: params.q ?? q } : {}) })}`;

  return (
    // Wider than the participant layout on desktop.
    <div className="relative left-1/2 w-[calc(100vw-2rem)] max-w-6xl -translate-x-1/2 space-y-6 text-midnight">
      <AdminNav tab="participantes" mode={mode} href={(dados) => href({ dados })} seedCount={seedCount} e2eCount={e2eCount} />

      <form action="/admin/participantes" className="flex gap-2">
        <input type="hidden" name="dados" value={mode} />
        <input
          name="q"
          defaultValue={q}
          placeholder="Procurar por nome ou e-mail"
          className="min-w-0 flex-1 rounded-full border border-midnight/15 bg-white px-4 py-2"
        />
        <button className="rounded-full bg-violet px-4 py-2 font-semibold text-white">Procurar</button>
      </form>
      <p className="text-sm text-midnight/60">
        {shown.length} {shown.length === 1 ? 'participante' : 'participantes'} · toque numa pessoa para ver o perfil e os matches.
      </p>

      <ul className="space-y-2">
        {shown.map((p) => {
          const [label, badge] = state(p);
          const own = byPerson.get(p.id) ?? [];
          return (
            <li key={p.id} id={`p-${p.id}`} className="scroll-mt-4 rounded-2xl bg-white">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 p-4">
                  <span className="font-semibold">{p.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge}`}>{label}</span>
                  <span className="text-sm text-midnight/60">
                    {own.length} {own.length === 1 ? 'match' : 'matches'} · {p.city} · {when(p.created_at)}
                  </span>
                </summary>
                <div className="space-y-4 border-t border-midnight/10 p-4 text-sm">
                  <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2 [&>div]:min-w-0">
                    {[
                      ['E-mail', p.email ?? '—'],
                      ['WhatsApp', p.whatsapp ?? '—'],
                      ['Instagram', p.instagram ? `@${p.instagram}` : '—'],
                      ['Idade', pt.join.ageOptions[p.age_range as keyof typeof pt.join.ageOptions] ?? p.age_range],
                      ['Tempo na cidade', pt.join.timeInCityOptions[p.time_in_city as keyof typeof pt.join.timeInCityOptions] ?? p.time_in_city],
                      ['Origem', pt.join.originOptions[p.origin as keyof typeof pt.join.originOptions] ?? p.origin],
                      ['Idioma', LANG[p.lang] ?? p.lang],
                      ['Quer falar sobre', p.talk_about_code ? interestLabel(p.talk_about_code, 'pt') : (p.talk_about ?? '—')],
                    ].map(([k, v]) => (
                      <div key={k} className="break-words">
                        <dt className="inline text-midnight/60">{k}: </dt>
                        <dd className="inline">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="break-words">
                    <span className="text-midnight/60">Interesses: </span>
                    {p.interests.map((code) => interestLabel(code, 'pt')).join(' · ')}
                    {Object.values(p.other_text ?? {}).length > 0 && (
                      <span className="text-midnight/60"> · Outro: {Object.values(p.other_text).join(' · ')}</span>
                    )}
                  </p>

                  <div className="space-y-2">
                    <h3 className="font-semibold">Matches</h3>
                    {own.length === 0 && <p className="text-midnight/60">Ainda sem matches.</p>}
                    {own.map(({ match, other, mine, theirs, myTaps, theirTaps }) => {
                      const o = personById.get(other);
                      return (
                        <div key={match.id} className="space-y-1 rounded-xl bg-paper p-3">
                          <p className="flex flex-wrap items-center gap-x-2">
                            <a href={`#p-${other}`} className="font-semibold text-violet underline">
                              {o?.name ?? '—'}
                            </a>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${match.type === 'compatible' ? 'bg-lime' : 'bg-pink/60'}`}
                            >
                              {match.type === 'compatible' ? 'compatível' : 'controlo'}
                            </span>
                            <span className="text-midnight/60">{when(match.created_at)}</span>
                          </p>
                          <p className="break-words">
                            <span className="text-midnight/60">Em comum ({match.shared_count}): </span>
                            {match.shared_items.map((code) => interestLabel(code, 'pt')).join(' · ') || '—'}
                          </p>
                          <p>
                            <span className="text-midnight/60">Review de {p.name}: </span>
                            {reviewText(mine)}
                            <span className="text-midnight/60"> · tocou: {myTaps.map((c) => CHANNEL[c] ?? c).join(', ') || 'não'}</span>
                          </p>
                          <p>
                            <span className="text-midnight/60">Review de {o?.name ?? 'outra pessoa'}: </span>
                            {reviewText(theirs)}
                            <span className="text-midnight/60"> · tocou: {theirTaps.map((c) => CHANNEL[c] ?? c).join(', ') || 'não'}</span>
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
