import { describe, expect, it } from 'vitest';
import { inBatches } from '@/lib/batch';

describe('inBatches', () => {
  it('runs every item, a batch at a time, and counts the successes', async () => {
    let running = 0;
    let peak = 0;
    const done = await inBatches([1, 2, 3, 4, 5, 6, 7], 3, Infinity, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return n % 2 === 1;
    });
    expect(done).toBe(4);
    expect(peak).toBe(3);
  });

  it('starts no batch after the deadline', async () => {
    const seen: number[] = [];
    await inBatches([1, 2, 3], 1, Date.now() - 1, async (n) => (seen.push(n), true));
    expect(seen).toEqual([]);
  });
});
