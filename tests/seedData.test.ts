import { describe, expect, it } from 'vitest';
import { planMatches, type Candidate } from '@/lib/matching';
import { mulberry32, seedPeople, seedReview } from '@/lib/seedData';

describe('seed data', () => {
  it('makes 100 valid, distinct profiles, the same for the same seed', () => {
    const a = seedPeople(100, mulberry32(42));
    const b = seedPeople(100, mulberry32(42));
    expect(a).toHaveLength(100);
    expect(a).toEqual(b);
    expect(new Set(a.map((p) => p.whatsapp)).size).toBe(100);
    expect(a.every((p) => (p.talk_about === null) !== (p.talk_about_code === null))).toBe(true);
    expect(a.every((p) => !p.talk_about_code || p.interests.includes(p.talk_about_code))).toBe(true);
  });

  it('matches only within the pool, without duplicate pairs, and yields both match types', () => {
    const rng = mulberry32(7);
    const people = seedPeople(100, rng);
    const pool: Candidate[] = people.map((p, i) => ({
      id: `s${String(i).padStart(3, '0')}`,
      interests: p.interests,
      active: true,
      createdAt: `2026-10-01T00:00:${String(i % 60).padStart(2, '0')}Z`,
      compatibleCount: 0,
      controlCount: 0,
      matchedIds: new Set(),
    }));
    const pairs = new Set<string>();
    const types = new Set<string>();
    for (const person of pool) {
      for (const p of planMatches(person, pool, { maxCompatible: 3, maxControl: 1, minSharedCompatible: 2 }, rng)) {
        const key = `${p.aId}|${p.bId}`;
        expect(pairs.has(key)).toBe(false);
        pairs.add(key);
        types.add(p.type);
      }
    }
    expect(types).toEqual(new Set(['compatible', 'control']));
    expect(pairs.size).toBeGreaterThan(150);
  });

  it('produces valid reviews where compatible matches do slightly better on average', () => {
    const rng = mulberry32(3);
    const avg = (type: 'compatible' | 'control') => {
      const rs = Array.from({ length: 2000 }, () => seedReview(rng, type, type === 'compatible' ? 4 : 0));
      const talked = rs.filter((r) => r.talked).length / rs.length;
      const sat = rs.filter((r) => r.satisfaction_1_7 !== null).map((r) => r.satisfaction_1_7!);
      return { talked, sat: sat.reduce((a, b) => a + b, 0) / sat.length };
    };
    const comp = avg('compatible');
    const ctrl = avg('control');
    expect(comp.talked).toBeGreaterThan(ctrl.talked);
    expect(comp.sat - ctrl.sat).toBeGreaterThan(0.5);
    expect(comp.sat - ctrl.sat).toBeLessThan(2);
  });
});
