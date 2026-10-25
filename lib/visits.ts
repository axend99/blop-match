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

// When the visit counter went live in production: accounts and profiles before it are left out,
// so all steps cover the same period.
export const VISITS_SINCE = '2026-10-23T18:37:00Z';

export type FunnelDay = {
  day: string;
  home: number;
  login: number;
  join: number;
  accounts: number;
  profiles: number;
};

// Accounts and profiles count from `from` on (the visit counter's start), so the steps are
// comparable. `since` is the first day with visit counts. Days newest first.
export function visitFunnel(
  steps: { day: string; step: string; sessions: number }[],
  accounts: string[], // created_at of login accounts
  profiles: string[], // created_at of profiles
  from: string = VISITS_SINCE,
) {
  const since = steps.reduce<string | null>((min, s) => (min === null || s.day < min ? s.day : min), null);
  const counted = (iso: string) => new Date(iso).getTime() >= new Date(from).getTime();
  const byDay = new Map<string, FunnelDay>();
  const row = (day: string) => {
    let r = byDay.get(day);
    if (!r) byDay.set(day, (r = { day, home: 0, login: 0, join: 0, accounts: 0, profiles: 0 }));
    return r;
  };
  for (const s of steps) if ((VISIT_STEPS as readonly string[]).includes(s.step)) row(s.day)[s.step as VisitStep] += s.sessions;
  if (since) {
    for (const a of accounts) if (counted(a)) row(lisbonDay(a)).accounts++;
    for (const p of profiles) if (counted(p)) row(lisbonDay(p)).profiles++;
  }
  const days = [...byDay.values()].sort((a, b) => b.day.localeCompare(a.day));
  const total = days.reduce(
    (t, d) => ({
      home: t.home + d.home,
      login: t.login + d.login,
      join: t.join + d.join,
      accounts: t.accounts + d.accounts,
      profiles: t.profiles + d.profiles,
    }),
    { home: 0, login: 0, join: 0, accounts: 0, profiles: 0 },
  );
  return { since, days, total };
}

export type FunnelTotals = { home: number; login: number; join: number; accounts: number; profiles: number };

// Before × after a snapshot: "before" is what the snapshot saved, "after" is everything since
// (current totals minus the snapshot). Never negative.
export function splitAtSnapshot(total: FunnelTotals, snapshot: FunnelTotals): { before: FunnelTotals; after: FunnelTotals } {
  const keys = ['home', 'login', 'join', 'accounts', 'profiles'] as const;
  const after = Object.fromEntries(keys.map((k) => [k, Math.max(0, total[k] - snapshot[k])])) as FunnelTotals;
  return { before: { ...snapshot }, after };
}

// Each step as a share of the previous one, in the panel's order; null when the previous is 0.
export const FUNNEL_ORDER = ['home', 'login', 'accounts', 'join', 'profiles'] as const;
export function stepRates(t: FunnelTotals): (number | null)[] {
  return FUNNEL_ORDER.map((k, i) => (i === 0 ? null : t[FUNNEL_ORDER[i - 1]] > 0 ? t[k] / t[FUNNEL_ORDER[i - 1]] : null));
}
