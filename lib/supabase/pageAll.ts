// Supabase returns at most 1000 rows per query: reads a whole table (or filtered query) page by
// page. `build(from, to)` must give a query with a stable order and `.range(from, to)`. Same
// { data, error } shape as a single query, so callers stay unchanged.
const PAGE = 1000;

export async function pageAll<T = any>( // eslint-disable-line @typescript-eslint/no-explicit-any
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<{ data: T[]; error: unknown }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) return { data: rows, error };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return { data: rows, error: null };
  }
}
