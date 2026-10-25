import 'server-only';
import { isAdminEmail } from '@/lib/admin';
import { isE2eEmail } from '@/lib/e2eUsers';
import { createServiceClient } from '@/lib/supabase/service';
import { visitFunnel, type FunnelTotals } from '@/lib/visits';

// Visit funnel for /admin. Team and test accounts are left out of accounts and profiles.
export async function loadVisitFunnel() {
  const supabase = createServiceClient();
  const [steps, people] = await Promise.all([
    supabase.from('visit_steps').select('day, step, sessions'),
    supabase.from('participants').select('email, created_at, is_seed'),
  ]);
  if (steps.error) throw steps.error;
  if (people.error) throw people.error;
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  const team = (email: string | null | undefined) => isAdminEmail(email ?? undefined) || isE2eEmail(email);
  return visitFunnel(
    steps.data,
    users.filter((u) => !team(u.email)).map((u) => u.created_at),
    people.data.filter((p) => !p.is_seed && !team(p.email)).map((p) => p.created_at),
  );
}

export type FunnelSnapshot = FunnelTotals & { label: string; taken_at: string };

export async function latestSnapshot(): Promise<FunnelSnapshot | null> {
  const { data, error } = await createServiceClient()
    .from('funnel_snapshots')
    .select('label, taken_at, home, login, join_form, accounts, profiles')
    .order('taken_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? { ...data, join: data.join_form } : null;
}

// Saves the current funnel totals, to compare before × after a change.
export async function saveSnapshot(label: string): Promise<void> {
  const { total } = await loadVisitFunnel();
  const { error } = await createServiceClient().from('funnel_snapshots').insert({
    label: label.trim().slice(0, 120) || 'Fotografia',
    home: total.home,
    login: total.login,
    join_form: total.join,
    accounts: total.accounts,
    profiles: total.profiles,
  });
  if (error) throw error;
}
