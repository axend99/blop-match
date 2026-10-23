import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { resolveFlag } from '@/app/admin/actions';
import AdminNav from '@/components/admin/AdminNav';
import DoseChart from '@/components/admin/DoseChart';
import FunnelChart from '@/components/admin/FunnelChart';
import { isAdmin, isAdminEmail } from '@/lib/admin';
import BanForm from '@/components/admin/BanForm';
import { FLAG_CATEGORY, flagField } from '@/lib/adminLabels';
import { loadAdminData } from '@/lib/adminData';
import { interestLabel } from '@/lib/i18n';
import pt from '@/lib/i18n/pt';
import { REVIEW_GRACE_MS } from '@/lib/review';
import { matchingConfig, reviewDelayDays } from '@/lib/site';
import { CATEGORIES } from '@/lib/interests';
import {
  MIN_N,
  SEGMENTS,
  WHY_NOT,
  byCategory,
  contactClicks,
  dataMode,
  type DataMode,
  byGroup,
  doseResponse,
  funnel,
  hypotheses,
  igFollow,
  otherAnswers,
  overview,
  scores,
  sample,
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
const IG_FOLLOW_LABEL: Record<string, string> = pt.review.igFollowOptions;
const STATUS: Record<Hypothesis['status'], { label: string; className: string }> = {
  above: { label: 'Acima da meta', className: 'bg-lime text-midnight' },
  below: { label: 'Abaixo da meta', className: 'bg-pink/60 text-midnight' },
  insufficient: { label: 'Dados insuficientes', className: 'bg-midnight/10 text-midnight/70' },
};
// What each hypothesis asks and how its number is computed, in plain words.
const TARGETS: Record<Hypothesis['id'], { title: string; target: string; question: string; how: string }> = {
  H0: {
    title: 'Taxa de contacto',
    target: '≥ 40%',
    question: 'As pessoas chegam a falar com o match?',
    how: '% de todas as reviews (dos dois grupos) em que houve contacto.',
  },
  H1: {
    title: 'Compatível conversa mais e fica mais satisfeito',
    target: '≥ +15 p.p. e ≥ +1,0 ponto',
    question: 'Os matches compatíveis funcionam melhor do que os de controlo?',
    how: 'Diferença compatível − controlo em duas coisas: a % que teve uma conversa (sobre todas as reviews do grupo; sem resposta conta como não) e a satisfação média de 1 a 7 (só de quem conversou).',
  },
  H2: {
    title: 'Mais itens em comum, mais satisfação',
    target: 'ρ ≥ 0,3',
    question: 'Quanto mais interesses em comum, maior a satisfação?',
    how: 'Correlação de Spearman entre o nº de itens em comum e a satisfação, em todas as reviews com satisfação (só quem conversou).',
  },
  H3: {
    title: 'Categoria com mais efeito',
    target: '≥ +0,75 ponto',
    question: 'Que tipo de interesse em comum pesa mais?',
    how: 'Por categoria: satisfação de quem partilha pelo menos um item dessa categoria − de quem não partilha (só quem conversou). Mostra a maior diferença entre as categorias com n ≥ 15 dos dois lados (pode ser negativa).',
  },
  H4: {
    title: 'Sensação de coisas em comum',
    target: '≥ +1,0 ponto',
    question: 'Quem tem um match compatível sente que tem mais em comum?',
    how: 'Diferença compatível − controlo na nota "temos coisas em comum" (1 a 7, só de quem conversou).',
  },
};

function compositionLabel(key: string, value: string) {
  if (value === '__other') return 'Outras';
  if (key === 'city') return value.charAt(0).toUpperCase() + value.slice(1);
  return SEGMENT_VALUE[key]?.[value] ?? value;
}

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

function Section({
  n,
  title,
  description,
  children,
}: {
  n: number | string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-3xl bg-white p-4 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">
          <span className="mr-2 text-midnight/40">{n}.</span>
          {title}
        </h2>
        {description && <p className="text-sm text-midnight/60">{description}</p>}
      </div>
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

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ grupo?: string; dados?: string }> }) {
  if (!(await isAdmin())) notFound();
  const { grupo, dados } = await searchParams;
  const mode = dataMode(dados);
  const segmentGroup: Group | 'all' = grupo === 'compativel' ? 'compatible' : grupo === 'controlo' ? 'control' : 'all';

  const { participants, matches, reviews, flags, clicks, rows, personById, seedCount, e2eCount, pendingCount, openReports, waitlist } = await loadAdminData(mode);
  const seedShown = participants.filter((p) => p.is_seed).length;
  // Keeps both filters in links.
  const link = (params: { grupo?: string; dados?: DataMode }, hash = '') =>
    `/admin?${new URLSearchParams({ dados: params.dados ?? mode, ...(params.grupo ?? grupo ? { grupo: params.grupo ?? grupo! } : {}) })}${hash}`;
  const live = participants.filter((p) => !p.deleted_at);
  const o = overview({
    participants: participants.map((p) => ({ active: p.active, deleted: Boolean(p.deleted_at) })),
    matches,
    reviews,
    now: new Date(),
    delayDays: reviewDelayDays(),
    graceMs: REVIEW_GRACE_MS,
  });
  // Pending people (being verified or reported) do not count as active.
  const smp = sample({ participants: participants.map((p) => ({ ...p, active: p.active && !p.pending_review })), matches, categories: CATEGORIES });
  const minShared = matchingConfig().minSharedCompatible;
  const byNewest = (a?: string | null, b?: string | null) => (b ?? '').localeCompare(a ?? '');
  const openFlags = flags.filter((f) => !f.resolved_at).sort((a, b) => byNewest(a.created_at, b.created_at));
  const doneFlags = flags
    .filter((f) => f.resolved_at)
    .sort((a, b) => byNewest(a.resolved_at, b.resolved_at))
    .slice(0, 20);

  return (
    // Wider than the participant layout on desktop.
    <div className="relative left-1/2 w-[calc(100vw-2rem)] max-w-6xl -translate-x-1/2 space-y-6 text-midnight">
      <AdminNav tab="painel" mode={mode} href={(dados) => link({ dados })} seedCount={seedCount} e2eCount={e2eCount} toReview={pendingCount + openReports} />
      {openFlags.length > 0 && (
        <a href="#alertas" className="block rounded-2xl bg-pink/50 p-4 font-medium">
          ⚠️ {openFlags.length} {openFlags.length === 1 ? 'alerta de conteúdo por ver' : 'alertas de conteúdo por ver'}
        </a>
      )}

      <details className="rounded-3xl bg-white p-4 text-sm sm:px-6">
        <summary className="cursor-pointer font-semibold">Como ler este painel</summary>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-midnight/80">
          <li>
            <b>Match compatível</b>: a pessoa mais parecida entre as que partilham pelo menos {minShared} interesses. <b>Match de
            controlo</b>: sorteado entre quem não tem nenhum interesse em comum (se não houver ninguém, a pessoa menos parecida). O
            controlo serve de comparação: mostra o que acontece sem interesses em comum.
          </li>
          <li>
            <b>Review</b>: uma pessoa a avaliar um match, {reviewDelayDays()} dias depois. Cada match dá até 2 reviews (uma de cada
            lado).
          </li>
          <li>
            As perguntas de satisfação, fluidez, &quot;coisas em comum&quot; e &quot;voltar a encontrar&quot; (notas de 1 a 7) só
            são feitas a quem <b>conversou</b>; as médias são só dessas pessoas.
          </li>
          <li>
            <b>n</b>: quantas respostas entram no número. <b>p.p.</b> (pontos percentuais): diferença entre duas percentagens
            (ex.: 60% − 45% = +15 p.p.).
          </li>
          <li>
            <b>ρ de Spearman</b>: de −1 a 1. Positivo = mais itens em comum anda junto com mais satisfação; 0 = sem relação. A meta é
            ≥ 0,3.
          </li>
          <li>
            <b>Dados insuficientes</b>: menos de {MIN_N} respostas em alguma das contagens usadas (ver o n de cada cartão).
          </li>
        </ul>
      </details>

      <Section
        n={1}
        title="Amostra"
        description="Quem participa, quantos matches foram criados e o que os pares têm em comum."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Participantes', `${smp.people}`, `${smp.active} ativos${mode === 'tudo' && seedShown ? ` · ${seedShown} de seed` : ''}`],
            ['Matches', `${smp.matches}`, `${smp.compatible} compatíveis · ${smp.control} controlo`],
            [
              'Matches por pessoa',
              num(smp.perPersonMean, 1),
              'cada match conta para as duas pessoas (máx. 4: 3 compatíveis + 1 controlo)',
            ],
            ['Reviews', `${o.reviews}`, `taxa de resposta ${pct(o.responseRate.value)} (n = ${o.responseRate.n}: matches já abertos × 2)`],
          ].map(([label, value, sub]) => (
            <div key={label} className="rounded-2xl bg-paper p-3">
              <p className="text-xs uppercase tracking-wide text-midnight/60">{label}</p>
              <p className="text-2xl font-bold tabular-nums">{value}</p>
              <p className="text-xs text-midnight/50">{sub}</p>
            </div>
          ))}
        </div>
        {smp.people > 0 && (
          <p className="text-sm">
            <span className="text-midnight/60">Nº de matches por pessoa: </span>
            {smp.perPerson.map((b) => `${b.bucket}: ${pct(b.share.value)}`).join(' · ')}
            <span className="text-midnight/60"> · média de {num(smp.interestsMean, 1)} interesses escolhidos por pessoa</span>
          </p>
        )}

        <h3 className="pt-2 text-sm font-semibold">Quem são (% dos participantes)</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
          {smp.composition.map((c) => (
            <div key={c.key}>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-midnight/60">{c.label}</h4>
              <Table head={['', '%']}>
                {c.values.map((v) => (
                  <tr key={v.value}>
                    <td className="px-2 py-1">{compositionLabel(c.key, v.value)}</td>
                    <PctCell s={v.share} />
                  </tr>
                ))}
              </Table>
            </div>
          ))}
        </div>

        <h3 className="pt-2 text-sm font-semibold">O que os pares têm em comum (% dos matches de cada grupo)</h3>
        <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
          <Table head={['Interesses', 'Compatível', 'Controlo']}>
            <tr>
              <td className="px-2 py-1.5">Média de itens em comum</td>
              <MeanCell s={smp.sharedMean.compatible} />
              <MeanCell s={smp.sharedMean.control} />
            </tr>
            {smp.sharedByCategory.map((c) => (
              <tr key={c.category}>
                <td className="px-2 py-1.5">Pelo menos 1 em {CATEGORY_LABEL[c.category]}</td>
                <PctCell s={c.compatible} />
                <PctCell s={c.control} />
              </tr>
            ))}
          </Table>
          <Table head={['Mesmo perfil', 'Compatível', 'Controlo']}>
            {smp.sameProfile.map((f) => (
              <tr key={f.key}>
                <td className="px-2 py-1.5">{f.label}</td>
                <PctCell s={f.compatible} />
                <PctCell s={f.control} />
              </tr>
            ))}
          </Table>
        </div>
        <p className="text-xs text-midnight/60">
          Base: participantes não anonimizados e os matches entre eles (matches com pessoas que pediram para apagar os dados não
          contam aqui). O controlo partilha poucos interesses por desenho; o perfil (idade, cidade…) não entra no matching.
        </p>
      </Section>

      <Section
        n={2}
        title="Placar das hipóteses"
        description="As perguntas do estudo. Cada cartão diz o que testa, como se calcula e se já passou a meta."
      >
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
              <p className="text-sm">{TARGETS[h.id].question}</p>
              {h.category && <p className="text-sm font-medium">{CATEGORY_LABEL[h.category]}</p>}
              {h.values.map((v) => (
                <p key={v.label}>
                  <span className="text-2xl font-bold tabular-nums">{hValue(v)}</span>{' '}
                  <span className="text-sm text-midnight/60">{v.label}</span>
                </p>
              ))}
              <p className="text-sm text-midnight/60">Meta: {TARGETS[h.id].target}</p>
              <p className="text-xs text-midnight/60">{TARGETS[h.id].how}</p>
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

      <Section n={3} title="Funil por grupo" description="De todas as reviews de cada grupo, que % chegou a cada etapa: contacto, conversa, próximo passo (quer voltar a ver ou já combinou) e encontro.">
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

      <Section n="3b" title="Cliques nos botões de contacto (tentativas de contacto)" description="Quem tocou no botão de WhatsApp ou Instagram na página do match, e como isso se compara com o que disse na review.">
        {(() => {
          const cc = contactClicks({
            matches,
            deleted: new Set(participants.filter((p) => p.deleted_at).map((p) => p.id)),
            seed: new Set(participants.filter((p) => p.is_seed).map((p) => p.id)),
            instagram: new Set(participants.filter((p) => p.instagram).map((p) => p.id)),
            clicks,
            reviews: rows.map((r) => ({ ...r.review, match_id: r.match_id })),
          });
          const cols = [cc.all, cc.compatible, cc.control];
          const line = (label: string, pick: (x: (typeof cols)[number]) => Stat) => (
            <tr key={label}>
              <td className="px-2 py-1.5">{label}</td>
              {cols.map((c, i) => (
                <PctCell key={i} s={pick(c)} />
              ))}
            </tr>
          );
          return (
            <>
              <h3 className="text-sm font-semibold">Tentativas (todos os lados de matches, com ou sem review)</h3>
              <Table head={['', 'Todos', 'Compatível', 'Controlo']}>
                {line('Tocou em algum botão', (c) => c.clicked)}
                {line('Tocou no WhatsApp', (c) => c.whatsapp)}
                {line('Tocou no Instagram (se a outra pessoa tem)', (c) => c.instagram)}
              </Table>
              <h3 className="pt-2 text-sm font-semibold">Toque × resposta da review (lados com review; toques antes da review)</h3>
              <Table head={['', 'Todos', 'Compatível', 'Controlo']}>
                {line('Tocou e houve contacto', (c) => c.clickedContacted)}
                {line('Tocou mas não houve contacto (barreira)', (c) => c.clickedNotContacted)}
                {line('Não tocou, contactou primeiro', (c) => c.notClickedContactedMe)}
                {line('Não tocou, a outra pessoa contactou', (c) => c.notClickedContactedThem)}
                {line('Nem tocou nem houve contacto', (c) => c.neither)}
                {line('De quem tocou: teve conversa', (c) => c.clickedThenTalked)}
              </Table>
              <h3 className="pt-2 text-sm font-semibold">Já se seguem no Instagram? (reviews em que as duas pessoas têm Instagram)</h3>
              <Table head={['', 'Compatível', 'Controlo']}>
                {igFollow(rows).map((f) => (
                  <tr key={f.option}>
                    <td className="px-2 py-1.5">{IG_FOLLOW_LABEL[f.option]}</td>
                    <PctCell s={f.compatible} />
                    <PctCell s={f.control} />
                  </tr>
                ))}
              </Table>
              <p className="text-sm">
                Motivos na barreira (todos):{' '}
                {cc.all.barrierReasons
                  .filter((b) => b.share.value)
                  .map((b) => `${WHY_NOT_LABEL[b.reason] ?? b.reason} ${pct(b.share.value)}`)
                  .join(' · ') || '—'}{' '}
                <N n={cc.all.barrierReasons[0]?.share.n ?? 0} />
              </p>
              <p className="text-xs text-midnight/60">
                Unidade: lado do match (uma pessoa num match). Sem pessoas anonimizadas. Conta toques no botão (é um mínimo: não sabemos se a mensagem foi enviada, e sem JavaScript o
                toque não fica registado).
              </p>
            </>
          );
        })()}
      </Section>

      <Section n={4} title="Notas médias (1–7) por grupo" description="Média de cada pergunta de 1 (nada) a 7 (muito). As que vêm depois de &quot;conversaram?&quot; são só de quem conversou.">
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

      <Section n={5} title="Por categoria (H3)" description="Para cada categoria de interesses: satisfação e % de conversa quando o par partilha pelo menos um item dela, e quando não partilha.">
        <Table head={['Categoria', 'Satisfação com', 'Satisfação sem', 'Diferença', 'Conversa com', 'Conversa sem']}>
          {byCategory(rows).map((c) => (
            <tr key={c.category}>
              <td className="px-2 py-1.5">
                <details>
                  <summary className="cursor-pointer font-medium">{CATEGORY_LABEL[c.category]}</summary>
                  <ul className="mt-2 w-48 space-y-0.5 whitespace-normal text-xs sm:w-72">
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

      <Section n={6} title="Por segmento" description="Os mesmos números partidos pelo perfil de quem respondeu (idade, tempo na cidade, origem…).">
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
                href={link({ grupo: value }, '#segmentos')}
                className={`rounded-full border px-3 py-1 ${active ? 'border-violet bg-violet text-white' : 'border-midnight/15'}`}
              >
                {label}
              </Link>
            );
          })}
        </div>
        <div id="segmentos" className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
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

      <Section n={7} title="Dose-resposta (H2): satisfação por nº de itens em comum" description="Satisfação média (só quem conversou) consoante o nº de interesses que o par tem em comum. Se a hipótese H2 estiver certa, sobe da esquerda para a direita.">
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

      <Section n={8} title="Motivos, itens e respostas “outro”" description="Porque é que quem não contactou não o fez, os interesses mais escolhidos e o que as pessoas escreveram em &quot;Outro&quot;.">
        <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
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

      <Section
        n="8b"
        title="Lista de espera da app BLOP"
        description="Convite enviado por e-mail 5 dias depois do cadastro e botão na página dos matches. Conta a primeira vez que cada pessoa toca no link, por origem."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Convites enviados', `${waitlist.invited}`],
            ['Pessoas que tocaram', `${waitlist.people}`],
            ['Pelo e-mail', `${waitlist.fromEmail}`],
            ['Pelo botão', `${waitlist.fromButton}`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-paper p-3">
              <p className="text-xs uppercase tracking-wide text-midnight/60">{label}</p>
              <p className="text-2xl font-bold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-midnight/60">
          Quem se inscreve de facto na lista de espera fica no serviço da lista (fora do BLOP Match); aqui só contamos os toques.
        </p>
      </Section>

      <Section n={9} title="Tabelas brutas (CSV)" description="Os dados completos para abrir no Excel ou noutra ferramenta (respeitam o filtro Reais/Seed/Tudo).">
        <div className="flex flex-wrap gap-2">
          {[
            ['participantes', `Participantes (${participants.length})`],
            ['matches', `Matches (${matches.length})`],
            ['reviews', `Reviews (${reviews.length})`],
          ].map(([table, label]) => (
            <a key={table} href={`/admin/export/${table}?dados=${mode}`} className="rounded-full bg-violet px-4 py-2 text-sm font-semibold text-white">
              ⬇ {label}
            </a>
          ))}
        </div>
        <p className="text-xs text-midnight/60">Cada review inclui os dados do match e do perfil de quem respondeu.</p>
      </Section>

      <section id="alertas">
        <Section n={10} title={`Alertas de conteúdo (${openFlags.length} por ver)`} description="Nomes e textos que a verificação automática (IA) marcou. Os de perfis novos também estão na aba Verificação (esses perfis só entram no matching depois de aprovados); os comentários de reviews só avisam.">
          {openFlags.length === 0 && <p className="text-sm text-midnight/60">Nenhum alerta por ver.</p>}
          <ul className="space-y-3">
            {openFlags.map((f) => (
              <li key={f.id} className="space-y-1 rounded-2xl border border-midnight/10 p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${f.status === 'flagged' ? 'bg-pink/60' : 'bg-midnight/10'}`}>
                    {f.status === 'flagged' ? (FLAG_CATEGORY[f.category ?? ''] ?? f.category ?? 'marcado') : 'por verificar'}
                  </span>
                  <span className="text-midnight/60">{flagField(f.field)}</span>
                  <span className="text-midnight/60">· {personById.get(f.participant_id)?.name ?? '—'}</span>
                  <span className="text-midnight/60">· {new Date(f.created_at).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' })}</span>
                </div>
                <p className="whitespace-pre-wrap break-words rounded-xl bg-paper p-2 text-sm">{f.text}</p>
                {f.reason && <p className="text-sm text-midnight/70">{f.reason}</p>}
                <div className="flex flex-wrap items-start gap-2">
                  <form action={resolveFlag}>
                    <input type="hidden" name="id" value={f.id} />
                    <button className="rounded-full border border-midnight/20 px-3 py-1 text-sm font-medium">Marcar como visto</button>
                  </form>
                  {(() => {
                    const person = personById.get(f.participant_id);
                    return person && !person.is_seed && person.email && !isAdminEmail(person.email) ? (
                      <BanForm participantId={person.id} name={person.name} />
                    ) : null;
                  })()}
                </div>
              </li>
            ))}
          </ul>
          {doneFlags.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-midnight/60">Últimos vistos ({doneFlags.length})</summary>
              <ul className="mt-2 space-y-1">
                {doneFlags.map((f) => (
                  <li key={f.id} className="break-words text-midnight/60">
                    {flagField(f.field)} · {personById.get(f.participant_id)?.name ?? '—'}: {f.text}
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
