import 'server-only';
import { classifyWord } from '@/lib/guessCheck';
import { createServiceClient } from '@/lib/supabase/service';

// Passwords saved while the AI check was down have no word type (the clue for matches): fill
// them in, a few per cron run. A failed check leaves the row for the next run.
export async function fillMissingPasswordKinds(deadline: number): Promise<number> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('participants')
    .select('id, password')
    .not('password', 'is', null)
    .is('password_kind', null)
    .is('deleted_at', null)
    .eq('is_seed', false)
    .limit(30);
  let filled = 0;
  for (const p of data ?? []) {
    if (Date.now() > deadline) break;
    const kind = await classifyWord(p.password as string);
    if (!kind) continue;
    const { error } = await supabase.from('participants').update({ password_kind: kind }).eq('id', p.id).is('password_kind', null);
    if (!error) filled++;
  }
  return filled;
}
