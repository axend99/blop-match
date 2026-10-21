import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminSignOut, resolveFlag } from '@/app/admin/actions';
import DoseChart from '@/components/admin/DoseChart';
import FunnelChart from '@/components/admin/FunnelChart';
import { isAdmin } from '@/lib/admin';
import { loadAdminData } from '@/lib/adminData';
import { interestLabel } from '@/lib/i18n';
import pt from '@/lib/i18n/pt';
import { reviewDelayDays } from '@/lib/site';
import {
  MIN_N,
  SEGMENTS,
  WHY_NOT,
  byCategory,
  byGroup,
  doseResponse,
  funnel,
  hypotheses,
  otherAnswers,
  overview,
  scores,
  segment,
  topItems,
  whyNot,
  type Group,
  type Hypothesis,
  type Stat,
} from '@/lib/stats';

// Admin panel (SPEC §8), in Portuguese. Data is read with the service role on the server.
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'BLOP Match · Admin', robots: { index: false, follow: false } };

const nf = (digits: number) => new Intl.NumberFormat('pt-PT', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct = (v: number | null) => (v === null ? '—' : `${nf(1).format(v * 100)}%`);
const num = (v: number | null, digits = 2) => (v === null ? '—' : nf(digits).format(v));
const signed = (v: number | null, digits: number, unit = '') =>
  v === null ? '—' : `${v > 0 ? '+' : ''}${nf(digits).format(v)}${unit}`;

const CATEGORY_LABEL: Record<string, string> = pt.join.categories;
const SEGMENT_VALUE: Record<string, Record<string, string>> = {
  age_range: pt.join.ageOptions,
  time_in_city: pt.join.timeInCityOptions,
  origin: pt.join.originOptions,
  lang: { en: 'Inglês', pt: 'Português' },
};
const WHY_NOT_LABEL: Record<string, string> = pt.review.whyNotOptions;
const STATUS: Record<Hypothesis['status'], { label: string; className: string }> = {
  above: { label: 'Acima da meta', className: 'bg-lime text-midnight' },
  below: { label: 'Abaixo da meta', className: 'bg-pink/60 text-midnight' },
  insufficient: { label: 'Dados insuficientes', className: 'bg-midnight/10 text-midnight/70' },
};
const TARGETS: Record<Hypothesis['id'], { title: string; target: string }> = {
  H0: { title: 'Taxa de contacto', target: '≥ 40%' },
  H1: { title: 'Compatível conversa mais e fica mais satisfeito', target: '≥ +15 p.p. e ≥ +1,0 ponto' },
  H2: { title: 'Mais itens em comum, mais satisfação', target: 'ρ ≥ 0,3' },
  H3: { title: 'Categoria com mais efeito', target: '≥ +0,75 ponto' },
  H4: { title: 'Sensação de coisas em comum', target: '≥ +1,0 ponto' },
};

function hValue(v: Hypothesis['values'][number]) {
  if (v.kind === 'pct') return pct(v.value);
  if (v.kind === 'pp') return signed(v.value === null ? null : v.value * 100, 1, ' p.p.');
  if (v.kind === 'rho') return num(v.value);
  return signed(v.value, 2);
}

function N({ n }: { n: number }) {
  return <span className="text-xs text-midnight/50"> n = {n}</span>;
}

function PctCell({ s }: { s: Stat }) {
  return (
    <td className="px-2 py-1.5 text-right tabular-nums">
      {pct(s.value)}
      <N n={s.n} />
    </td>
  );
}

function MeanCell({ s }: { s: Stat }) {
  return (
    <td className="px-2 py-1.5 text-right tabular-nums">
      {num(s.value)}
      <N n={s.n} />
    </td>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-3xl bg-white p-4 sm:p-6">
      <h2 className="text-lg font-semibold">
        <span className="mr-2 text-midnight/40">{n}.</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b border-midnight/10 text-left text-xs uppercase tracking-wide text-midnight/60">
            {head.map((h, i) => (
              <th key={h} className={`px-2 py-1.5 font-semibold ${i > 0 ? 'text-right' : ''}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-midnight/5">{children}</tbody>
      </table>
    </div>
  );
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ grupo?: string }> }) {
  if (!(await isAdmin())) notFound();
  const { grupo } = await searchParams;
  const segmentGroup: Group | 'all' = grupo === 'compativel' ? 'compatible' : grupo === 'controlo' ? 'control' : 'all';

  const { participants, matches, reviews, flags, rows, personById } = await loadAdminData();
  const live = participants.filter((p) => !p.deleted_at);
  const o = overview({
    participants: participants.map((p) => ({ active: p.active, deleted: Boolean(p.deleted_at) })),
    matches,
    reviews,
    now: new Date(),
    delayDays: reviewDelayDays(),
  });
  const byNewest = (a?: string | null, b?: string | null) => (b ?? '').localeCompare(a ?? '');
  const openFlags = flags.filter((f) => !f.resolved_at).sort((a, b) => byNewest(a.created_at, b.created_at));
  const doneFlags = flags
    .filter((f) => f.resolved_at)
    .sort((a, b) => byNewest(a.resolved_at, b.resolved_at))
    .slice(0, 20);

  return (
    // Wider than the participant layout on desktop.
    <div className="relative left-1/2 w-[calc(100vw-2rem)] max-w-6xl -translate-x-1/2 space-y-6 text-midnight">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Painel do estudo</h1>
        <form action={adminSignOut}>
          <button className="rounded-full border border-midnight/20 bg-white px-4 py-2 text-sm font-medium">Sair do admin</button>
        </form>
      </div>
      {openFlags.length > 0 && (
        <a href="#alertas" className="block rounded-2xl bg-pink/50 p-4 font-medium">
          ⚠️ {openFlags.length} {openFlags.length === 1 ? 'alerta de conteúdo por ver' : 'alertas de conteúdo por ver'}
        </a>
      )}

      <Section n={1} title="Placar das hipóteses">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {hypotheses(rows).map((h) => (
            <div key={h.id} className="space-y-2 rounded-2xl border border-midnight/10 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">
                  {h.id} · {TARGETS[h.id].title}
                </p>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS[h.status].className}`}>
                  {STATUS[h.status].label}
                </span>
              </div>
              {h.values.map((v) => (
                <p key={v.label}>
                  <span className="text-2xl font-bold tabular-nums">{hValue(v)}</span>{' '}
                  <span className="text-sm text-midnight/60">{v.label}</span>
                </p>
              ))}
              <p className="text-sm text-midnight/60">Meta: {TARGETS[h.id].target}</p>
              <p className="text-xs text-midnight/50">{h.ns.map((x) => `${x.label}: n = ${x.n}`).join(' · ') || 'n = 0'}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-midnight/60">
          Unidade: a review (uma pessoa a avaliar um match; cada match dá até 2 reviews, não independentes). &quot;Dados
          insuficientes&quot; quando algum grupo usado tem n &lt; {MIN_N}. H3: só contam categorias com n ≥ {MIN_N} com e sem
          item partilhado; o valor é a maior diferença.
        </p>
      </Section>

      <Section n={2} title="Visão geral">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Participantes', `${o.participants}`, `${o.activeParticipants} ativos`],
            ['Matches', `${o.compatibleMatches + o.controlMatches}`, `${o.compatibleMatches} comp. · ${o.controlMatches} ctrl.`],
            ['Reviews', `${o.reviews}`, ''],
            ['Taxa de resposta', pct(o.responseRate.value), `n = ${o.responseRate.n} (matches já abertos × 2)`],
          ].map(([label, value, sub]) => (
            <div key={label} className="rounded-2xl bg-paper p-3">
              <p className="text-xs uppercase tracking-wide text-midnight/60">{label}</p>
              <p className="text-2xl font-bold tabular-nums">{value}</p>
              <p className="text-xs text-midnight/50">{sub}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section n={3} title="Funil por grupo">
        {(() => {
          const f = funnel(rows);
          return (
            <>
              <FunnelChart
                data={f.map((s) => ({
                  label: s.label,
                  compatible: s.compatible.value === null ? null : s.compatible.value * 100,
                  control: s.control.value === null ? null : s.control.value * 100,
                }))}
              />
              <Table head={['Etapa', 'Compatível', 'Controlo']}>
                {f.map((s) => (
                  <tr key={s.key}>
                    <td className="px-2 py-1.5">{s.label}</td>
                    <PctCell s={s.compatible} />
                    <PctCell s={s.control} />
                  </tr>
                ))}
              </Table>
              <p className="text-xs text-midnight/60">Base: reviews de cada grupo (100%).</p>
            </>
          );
        })()}
      </Section>

      <Section n={4} title="Notas médias (1–7) por grupo">
        <Table head={['Pergunta', 'Compatível', 'Controlo']}>
          {scores(rows).map((s) => (
            <tr key={s.field}>
              <td className="px-2 py-1.5">{s.label}</td>
              <MeanCell s={s.compatible} />
              <MeanCell s={s.control} />
            </tr>
          ))}
        </Table>
      </Section>

      <Section n={5} title="Por categoria (H3)">
        <Table head={['Categoria', 'Satisfação com', 'Satisfação sem', 'Diferença', 'Conversa com', 'Conversa sem']}>
          {byCategory(rows).map((c) => (
            <tr key={c.category}>
              <td className="px-2 py-1.5">
                <details>
                  <summary className="cursor-pointer font-medium">{CATEGORY_LABEL[c.category]}</summary>
                  <ul className="mt-2 space-y-0.5 text-xs">
                    {c.items
                      .filter((i) => i.satisfactionWith.n > 0)
                      .sort((a, b) => (b.difference ?? -Infinity) - (a.difference ?? -Infinity))
                      .map((i) => (
                        <li key={i.code}>
                          {interestLabel(i.code, 'pt')}: {num(i.satisfactionWith.value)} (n = {i.satisfactionWith.n}) vs{' '}
                          {num(i.satisfactionWithout.value)} (n = {i.satisfactionWithout.n}) → {signed(i.difference, 2)}
                        </li>
                      ))}
                  </ul>
                </details>
              </td>
              <MeanCell s={c.satisfactionWith} />
              <MeanCell s={c.satisfactionWithout} />
              <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{signed(c.difference, 2)}</td>
              <PctCell s={c.talkedWith} />
              <PctCell s={c.talkedWithout} />
            </tr>
          ))}
        </Table>
        <p className="text-xs text-midnight/60">&quot;Com&quot; = o match partilha pelo menos um item da categoria. Toque na categoria para ver o detalhe por item.</p>
      </Section>

      <Section n={6} title="Por segmento">
        <div className="flex flex-wrap gap-2 text-sm">
          {[
            ['todos', 'Todos'],
            ['compativel', 'Compatível'],
            ['controlo', 'Controlo'],
          ].map(([value, label]) => {
            const active = value === (segmentGroup === 'all' ? 'todos' : grupo);
            return (
              <Link
                key={value}
                href={`/admin?grupo=${value}#segmentos`}
                className={`rounded-full border px-3 py-1 ${active ? 'border-violet bg-violet text-white' : 'border-midnight/15'}`}
              >
                {label}
              </Link>
            );
          })}
        </div>
        <div id="segmentos" className="grid gap-4 lg:grid-cols-2">
          {SEGMENTS.map(({ key, label }) => (
            <div key={key}>
              <h3 className="mb-1 text-sm font-semibold">{label}</h3>
              <Table head={['Valor', 'Contacto', 'Conversa', 'Satisfação']}>
                {segment(byGroup(rows, segmentGroup), key).map((s) => (
                  <tr key={s.value}>
                    <td className="px-2 py-1.5">
                      {SEGMENT_VALUE[key]?.[s.value] ?? s.value} <N n={s.n} />
                    </td>
                    <PctCell s={s.contact} />
                    <PctCell s={s.talked} />
                    <MeanCell s={s.satisfaction} />
                  </tr>
                ))}
              </Table>
            </div>
          ))}
        </div>
      </Section>

      <Section n={7} title="Dose-resposta (H2): satisfação por nº de itens em comum">
        {(() => {
          const d = doseResponse(rows);
          return (
            <>
              <DoseChart data={d.map((b) => ({ bucket: b.bucket, value: b.satisfaction.value }))} />
              <Table head={['Itens em comum', 'Satisfação média']}>
                {d.map((b) => (
                  <tr key={b.bucket}>
                    <td className="px-2 py-1.5">{b.bucket}</td>
                    <MeanCell s={b.satisfaction} />
                  </tr>
                ))}
              </Table>
            </>
          );
        })()}
      </Section>

      <Section n={8} title="Motivos, itens e respostas “outro”">
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <h3 className="mb-1 text-sm font-semibold">Motivos de não contacto</h3>
            <Table head={['Motivo', 'Comp.', 'Ctrl.']}>
              {whyNot(rows).map((w) => (
                <tr key={w.reason}>
                  <td className="px-2 py-1.5">{WHY_NOT_LABEL[w.reason] ?? w.reason}</td>
                  <PctCell s={w.compatible} />
                  <PctCell s={w.control} />
                </tr>
              ))}
            </Table>
            <p className="mt-1 text-xs text-midnight/60">Base: reviews sem contacto de cada grupo ({WHY_NOT.length} motivos).</p>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-semibold">Itens mais escolhidos</h3>
            <Table head={['Item', 'Pessoas']}>
              {topItems(live).map((i) => (
                <tr key={i.code}>
                  <td className="px-2 py-1.5">{interestLabel(i.code, 'pt')}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {i.count} <span className="text-xs text-midnight/50">({pct(i.share)})</span>
                  </td>
                </tr>
              ))}
            </Table>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-semibold">Respostas “outro”</h3>
            <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">
              {otherAnswers(live).map((a, i) => (
                <li key={i}>
                  <span className="text-xs text-midnight/50">{CATEGORY_LABEL[a.category] ?? a.category}:</span> {a.text}
                </li>
              ))}
              {otherAnswers(live).length === 0 && <li className="text-midnight/50">—</li>}
            </ul>
          </div>
        </div>
      </Section>

      <Section n={9} title="Tabelas brutas (CSV)">
        <div className="flex flex-wrap gap-2">
          {[
            ['participantes', `Participantes (${participants.length})`],
            ['matches', `Matches (${matches.length})`],
            ['reviews', `Reviews (${reviews.length})`],
          ].map(([table, label]) => (
            <a key={table} href={`/admin/export/${table}`} className="rounded-full bg-violet px-4 py-2 text-sm font-semibold text-white">
              ⬇ {label}
            </a>
          ))}
        </div>
        <p className="text-xs text-midnight/60">Cada review inclui os dados do match e do perfil de quem respondeu.</p>
      </Section>

      <section id="alertas">
        <Section n={10} title={`Alertas de conteúdo (${openFlags.length} por ver)`}>
          {openFlags.length === 0 && <p className="text-sm text-midnight/60">Nenhum alerta por ver.</p>}
          <ul className="space-y-3">
            {openFlags.map((f) => (
              <li key={f.id} className="space-y-1 rounded-2xl border border-midnight/10 p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${f.status === 'flagged' ? 'bg-pink/60' : 'bg-midnight/10'}`}>
                    {f.status === 'flagged' ? (f.category ?? 'marcado') : 'por verificar'}
                  </span>
                  <span className="text-midnight/60">{f.field}</span>
                  <span className="text-midnight/60">· {personById.get(f.participant_id)?.name ?? '—'}</span>
                  <span className="text-midnight/60">· {new Date(f.created_at).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' })}</span>
                </div>
                <p className="whitespace-pre-wrap break-words rounded-xl bg-paper p-2 text-sm">{f.text}</p>
                {f.reason && <p className="text-sm text-midnight/70">{f.reason}</p>}
                <form action={resolveFlag}>
                  <input type="hidden" name="id" value={f.id} />
                  <button className="rounded-full border border-midnight/20 px-3 py-1 text-sm font-medium">Marcar como visto</button>
                </form>
              </li>
            ))}
          </ul>
          {doneFlags.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-midnight/60">Últimos vistos ({doneFlags.length})</summary>
              <ul className="mt-2 space-y-1">
                {doneFlags.map((f) => (
                  <li key={f.id} className="break-words text-midnight/60">
                    {f.field} · {personById.get(f.participant_id)?.name ?? '—'}: {f.text}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Section>
      </section>
    </div>
  );
}
