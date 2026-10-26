import { describe, expect, it } from 'vitest';
import { pageAll } from '@/lib/supabase/pageAll';

describe('pageAll', () => {
  it('reads every page until a short one', async () => {
    const table = Array.from({ length: 2345 }, (_, i) => i);
    const calls: [number, number][] = [];
    const { data, error } = await pageAll(async (from, to) => {
      calls.push([from, to]);
      return { data: table.slice(from, to + 1), error: null };
    });
    expect(error).toBeNull();
    expect(data).toHaveLength(2345);
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it('stops and reports the error', async () => {
    const { error } = await pageAll(async () => ({ data: null, error: new Error('boom') }));
    expect(error).toBeInstanceOf(Error);
  });
});
