// Removes the 10 automated test accounts (e2e/) and everything linked to them, including
// matches they had with other people (and those people's reviews/taps on those matches).
//   npm run e2e:clean
import { adminDb } from '../e2e/db';
import { E2E_EMAILS } from '@/lib/e2eUsers';

const db = adminDb();

async function must<T>(promise: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data as T;
}

async function main() {
  const people = await must(db.from('participants').select('id, user_id, email').in('email', E2E_EMAILS));
  const ids = people.map((p) => p.id as string);
  const matches = ids.length
    ? await must(db.from('matches').select('id').or(`a_id.in.(${ids}),b_id.in.(${ids})`))
    : [];
  const matchIds = matches.map((m) => m.id as string);

  if (matchIds.length) {
    await must(db.from('content_flags').delete().in('match_id', matchIds));
    await must(db.from('contact_clicks').delete().in('match_id', matchIds));
    await must(db.from('reviews').delete().in('match_id', matchIds));
    await must(db.from('review_requests').delete().in('match_id', matchIds));
    await must(db.from('email_log').delete().in('match_id', matchIds));
  }
  if (ids.length) {
    await must(db.from('content_flags').delete().in('participant_id', ids));
    await must(db.from('contact_clicks').delete().in('participant_id', ids));
    await must(db.from('reviews').delete().in('reviewer_id', ids));
    await must(db.from('review_requests').delete().in('participant_id', ids));
    await must(db.from('email_log').delete().in('participant_id', ids));
  }
  if (matchIds.length) await must(db.from('matches').delete().in('id', matchIds));
  if (ids.length) await must(db.from('participants').delete().in('id', ids));

  // Auth users with these e-mails (also those that never finished sign-up).
  let users = 0;
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) {
      if (u.email && E2E_EMAILS.includes(u.email.toLowerCase())) {
        const { error: delError } = await db.auth.admin.deleteUser(u.id);
        if (delError) throw delError;
        users++;
      }
    }
    if (data.users.length < 1000) break;
  }
  console.log(`E2E apagado: ${ids.length} participantes, ${matchIds.length} matches, ${users} contas.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
