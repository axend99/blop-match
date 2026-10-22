// Wipes every participant (real test accounts, e2e accounts and seed) to restart the study
// data, e.g. after changing the interest catalogue. Admin accounts are never deleted.
//   npm run reset:data                          → only lists what would be deleted, writes a CSV backup
//   npm run reset:data -- --apply               → deletes
//   RESET_BACKUP_DIR=<dir> sets where the backup goes (default ./reset-backup, git-ignored).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adminDb } from '../e2e/db';
import { toCsv } from '@/lib/csv';
import { E2E_EMAILS } from '@/lib/e2eUsers';

const db = adminDb();
const apply = process.argv.includes('--apply');
const admins = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
// Default: reset-backup/ in the folder npm runs from (the repo root, where it is git-ignored).
const backupDir = process.env.RESET_BACKUP_DIR ?? 'reset-backup';

async function must<T>(promise: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data as T;
}

// Whole table, 1000 rows per page (PostgREST limit).
async function all<T>(table: string, columns = '*'): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(columns).order('id').range(from, from + 999);
    if (error) throw error;
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

async function authUsers() {
  const users: { id: string; email?: string }[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

const chunks = <T>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));

async function main() {
  const participants = await all<Record<string, unknown>>('participants');
  const matches = await all<Record<string, unknown>>('matches');
  const reviews = await all<Record<string, unknown>>('reviews');
  const users = await authUsers();

  const isAdmin = (email?: string | null) => Boolean(email) && admins.includes(email!.trim().toLowerCase());
  const realOnes = participants.filter((p) => !p.is_seed && !E2E_EMAILS.includes(String(p.email ?? '').toLowerCase()));
  const linkedUsers = new Set(participants.map((p) => p.user_id).filter(Boolean) as string[]);
  const deleteUsers = users.filter(
    (u) => !isAdmin(u.email) && (linkedUsers.has(u.id) || E2E_EMAILS.includes((u.email ?? '').toLowerCase())),
  );
  const unlinked = users.filter((u) => !linkedUsers.has(u.id) && !E2E_EMAILS.includes((u.email ?? '').toLowerCase()));

  console.log(`Participantes: ${participants.length} (seed ${participants.filter((p) => p.is_seed).length}, e2e ${participants.filter((p) => E2E_EMAILS.includes(String(p.email ?? '').toLowerCase())).length}, outros ${realOnes.length})`);
  for (const p of realOnes) console.log(`  · ${p.name} <${p.email ?? '—'}>${isAdmin(p.email as string) ? ' (admin: a conta fica, só o perfil é apagado)' : ''}`);
  console.log(`Matches: ${matches.length} · Reviews: ${reviews.length}`);
  console.log(`Contas de login a apagar: ${deleteUsers.length}`);
  console.log(`Contas de login sem perfil (não são apagadas): ${unlinked.map((u) => `${u.email}${isAdmin(u.email) ? ' (admin)' : ''}`).join(', ') || '—'}`);

  mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  for (const [name, rows] of [['participants', participants], ['matches', matches], ['reviews', reviews]] as const) {
    if (rows.length) writeFileSync(join(backupDir, `${name}-${stamp}.csv`), toCsv(Object.keys(rows[0]), rows));
  }
  console.log(`Cópia de segurança em ${backupDir}/ (dados pessoais: não partilhar nem pôr no git).`);

  if (!apply) return console.log('\nNada foi apagado. Para apagar: npm run reset:data -- --apply');
  // Without the admin list, admin logins could not be told apart: never delete then.
  if (admins.length === 0) throw new Error('ADMIN_EMAILS vazio: nada foi apagado.');

  const ids = participants.map((p) => p.id as string);
  const matchIds = matches.map((m) => m.id as string);
  for (const table of ['content_flags', 'contact_clicks', 'reviews', 'review_requests', 'email_log']) {
    for (const batch of chunks(matchIds, 100)) await must(db.from(table).delete().in('match_id', batch));
    const column = table === 'reviews' ? 'reviewer_id' : 'participant_id';
    for (const batch of chunks(ids, 100)) await must(db.from(table).delete().in(column, batch));
  }
  for (const batch of chunks(matchIds, 100)) await must(db.from('matches').delete().in('id', batch));
  for (const batch of chunks(ids, 100)) await must(db.from('participants').delete().in('id', batch));
  for (const u of deleteUsers) {
    const { error } = await db.auth.admin.deleteUser(u.id);
    if (error) throw error;
  }
  console.log(`Apagado: ${ids.length} participantes, ${matchIds.length} matches, ${deleteUsers.length} contas de login.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
