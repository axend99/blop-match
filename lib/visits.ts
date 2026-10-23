// Visit funnel (/admin): browser sessions that reached each page, then accounts and profiles
// created. Pure functions; data loading is in lib/visitService.ts.

export const VISIT_STEPS = ['home', 'login', 'join'] as const;
export type VisitStep = (typeof VISIT_STEPS)[number];

export function stepForPath(path: string): VisitStep | null {
  if (path === '/') return 'home';
  if (path === '/login') return 'login';
  if (path === '/join') return 'join';
  return null;
}

// Calendar day in Lisbon (YYYY-MM-DD), the same day the database uses for visit_steps.
export function lisbonDay(iso: string | Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date(iso));
}

export type FunnelDay = { day: string; home: number; login: number; join: number; accounts: number; profiles: number };

// From the first day with visit counts on (accounts and profiles before it are left out, so the
// steps are comparable). Days newest first.
export function visitFunnel(
  steps: { day: string; step: string; sessions: number }[],
  accounts: string[], // created_at of login accounts
  profiles: string[], // created_at of profiles
) {
  const since = steps.reduce<string | null>((min, s) => (min === null || s.day < min ? s.day : min), null);
  const byDay = new Map<string, FunnelDay>();
  const row = (day: string) => {
    let r = byDay.get(day);
    if (!r) byDay.set(day, (r = { day, home: 0, login: 0, join: 0, accounts: 0, profiles: 0 }));
    return r;
  };
  for (const s of steps) if ((VISIT_STEPS as readonly string[]).includes(s.step)) row(s.day)[s.step as VisitStep] += s.sessions;
  if (since) {
    for (const a of accounts) if (lisbonDay(a) >= since) row(lisbonDay(a)).accounts++;
    for (const p of profiles) if (lisbonDay(p) >= since) row(lisbonDay(p)).profiles++;
  }
  const days = [...byDay.values()].sort((a, b) => b.day.localeCompare(a.day));
  const total = days.reduce(
    (t, d) => ({ home: t.home + d.home, login: t.login + d.login, join: t.join + d.join, accounts: t.accounts + d.accounts, profiles: t.profiles + d.profiles }),
    { home: 0, login: 0, join: 0, accounts: 0, profiles: 0 },
  );
  return { since, days, total };
}
