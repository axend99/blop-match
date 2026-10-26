// Runs `fn` over `items` a few at a time (e-mails go out in parallel instead of one by one),
// starting no new batch after `deadline` (ms timestamp). Returns how many calls returned true.
export async function inBatches<T>(items: T[], size: number, deadline: number, fn: (item: T) => Promise<boolean>): Promise<number> {
  let done = 0;
  for (let i = 0; i < items.length; i += size) {
    if (Date.now() > deadline) break;
    const results = await Promise.all(items.slice(i, i + size).map(fn));
    done += results.filter(Boolean).length;
  }
  return done;
}
