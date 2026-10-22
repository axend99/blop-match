import Link from 'next/link';
import { adminSignOut } from '@/app/admin/actions';
import type { DataMode } from '@/lib/stats';

const MODES: [DataMode, string][] = [
  ['reais', 'Reais'],
  ['seed', 'Seed'],
  ['tudo', 'Tudo'],
];

// Top of every /admin page: tabs, sign-out, the Reais/Seed/Tudo filter and test-data warnings.
// `href(mode)` builds the current page's link for another data mode (keeping its other filters).
export default function AdminNav({
  tab,
  mode,
  href,
  seedCount,
  e2eCount,
  toReview = 0,
}: {
  tab: 'painel' | 'participantes' | 'verificacao';
  mode: DataMode;
  href: (mode: DataMode) => string;
  seedCount: number;
  e2eCount: number;
  toReview?: number; // profiles waiting + open reports
}) {
  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 ${active ? 'border-violet bg-violet text-white' : 'border-midnight/20 bg-white'}`;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Painel do estudo</h1>
        <form action={adminSignOut}>
          <button className="rounded-full border border-midnight/20 bg-white px-4 py-2 text-sm font-medium">Sair do admin</button>
        </form>
      </div>
      <nav className="flex gap-2 text-sm font-medium">
        <Link href={`/admin?dados=${mode}`} className={pill(tab === 'painel')}>
          Painel
        </Link>
        <Link href={`/admin/participantes?dados=${mode}`} className={pill(tab === 'participantes')}>
          Participantes
        </Link>
        <Link href="/admin/verificacao" className={pill(tab === 'verificacao')}>
          Verificação{toReview > 0 ? ` (${toReview})` : ''}
        </Link>
      </nav>
      {(seedCount > 0 || mode !== 'reais') && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-lime/40 p-3 text-sm">
          <span className="font-medium">Dados:</span>
          {MODES.map(([value, label]) => (
            <Link key={value} href={href(value)} className={pill(mode === value)}>
              {label}
            </Link>
          ))}
          {seedCount > 0 && (
            <span className="text-midnight/70">
              Há {seedCount} participantes de seed (dados falsos). Limpe com <code>npm run seed:clean</code> antes de divulgar.
            </span>
          )}
        </div>
      )}
      {e2eCount > 0 && (
        <p className="rounded-2xl bg-lime/40 p-3 text-sm">
          Há {e2eCount} contas de teste automático (e2e) nos dados reais. Apague-as com <code>npm run e2e:clean</code> antes de
          divulgar.
        </p>
      )}
    </>
  );
}
