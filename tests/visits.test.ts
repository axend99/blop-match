import { describe, expect, it } from 'vitest';
import { lisbonDay, stepForPath, visitFunnel } from '@/lib/visits';

describe('stepForPath', () => {
  it('maps the funnel pages and ignores the rest', () => {
    expect(['/', '/login', '/join', '/me', '/about', '/join/x'].map(stepForPath)).toEqual([
      'home',
      'login',
      'join',
      null,
      null,
      null,
    ]);
  });
});

describe('lisbonDay', () => {
  it('uses Lisbon time (summer: UTC+1)', () => {
    expect(lisbonDay('2026-10-23T23:30:00Z')).toBe('2026-10-24');
    expect(lisbonDay('2026-12-01T23:30:00Z')).toBe('2026-12-01');
  });
});

describe('visitFunnel', () => {
  it('sums steps per day and counts accounts and profiles from the first tracked day', () => {
    const f = visitFunnel(
      [
        { day: '2026-10-24', step: 'home', sessions: 10 },
        { day: '2026-10-24', step: 'login', sessions: 4 },
        { day: '2026-10-25', step: 'home', sessions: 5 },
        { day: '2026-10-25', step: 'join', sessions: 2 },
      ],
      ['2026-10-20T10:00:00Z', '2026-10-24T10:00:00Z', '2026-10-25T10:00:00Z'],
      ['2026-10-25T11:00:00Z'],
      '2026-10-24T00:00:00Z',
    );
    expect(f.since).toBe('2026-10-24');
    expect(f.total).toEqual({
      home: 15,
      login: 4,
      join: 2,
      accounts: 2,
      profiles: 1,
    });
    expect(f.days.map((d) => d.day)).toEqual(['2026-10-25', '2026-10-24']);
    expect(f.days[0]).toEqual({
      day: '2026-10-25',
      home: 5,
      login: 0,
      join: 2,
      accounts: 1,
      profiles: 1,
    });
  });

  it('leaves out accounts and profiles created before the counter started, even on the same day', () => {
    const f = visitFunnel(
      [{ day: '2026-10-24', step: 'home', sessions: 3 }],
      ['2026-10-24T08:00:00Z', '2026-10-24T20:00:00Z'],
      ['2026-10-24T09:00:00Z'],
      '2026-10-24T18:00:00Z',
    );
    expect(f.total).toEqual({
      home: 3,
      login: 0,
      join: 0,
      accounts: 1,
      profiles: 0,
    });
  });

  it('is empty before any visit is counted', () => {
    expect(visitFunnel([], ['2026-10-20T10:00:00Z'], [])).toEqual({
      since: null,
      days: [],
      total: { home: 0, login: 0, join: 0, accounts: 0, profiles: 0 },
    });
  });
});
