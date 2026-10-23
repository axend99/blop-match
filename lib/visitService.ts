import 'server-only';
import { isAdminEmail } from '@/lib/admin';
import { isE2eEmail } from '@/lib/e2eUsers';
import { createServiceClient } from '@/lib/supabase/service';
import { visitFunnel } from '@/lib/visits';

// Visit funnel for /admin. Team and test accounts are left out of accounts and profiles.
export async function loadVisitFunnel() {
  const supabase = createServiceClient();
  const [steps, people, users] = await Promise.all([
    supabase.from('visit_steps').select('day, step, sessions'),
    supabase.from('participants').select('email, created_at, is_seed'),
    supabase.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  if (steps.error) throw steps.error;
  if (people.error) throw people.error;
  if (users.error) throw users.error;
  const team = (email: string | null | undefined) => isAdminEmail(email ?? undefined) || isE2eEmail(email);
  return visitFunnel(
    steps.data,
    users.data.users.filter((u) => !team(u.email)).map((u) => u.created_at),
    people.data.filter((p) => !p.is_seed && !team(p.email)).map((p) => p.created_at),
  );
}
