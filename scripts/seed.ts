// Fake study data for demos and for testing /admin.
//   npm run seed        → 100 fake participants, their matches, reviews and contact taps
//   npm run seed:clean  → removes every seed row (and nothing else)
// Seed participants have no account and no e-mail and are stored inactive, so matching,
// the cron and the review e-mails never touch them. Uses the service role; never run in the app.
import { createClient } from '@supabase/supabase-js';
import { planMatches, type Candidate } from '@/lib/matching';
import { REVIEW_GRACE_MS } from '@/lib/review';
import { mulberry32, seedPeople, seedReview } from '@/lib/seedData';
import { matchingConfig, reviewDelayDays } from '@/lib/site';

const PEOPLE = 100;
const SEED = 2026;
const DAY = 24 * 60 * 60 * 1000;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, ''); // some shells export the REST endpoint
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (.env.local).');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
console.log(`Supabase: ${new URL(url).host}`);

const chunks = <T>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));

async function must<T>(promise: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data as T;
}

async function seedIds(): Promise<string[]> {
  const rows = await must(db.from('participants').select('id').eq('is_seed', true));
  return (rows ?? []).map((r) => r.id as string);
}

async function clean() {
  const ids = await seedIds();
  if (ids.length === 0) return console.log('Não há dados de seed.');
  const seed = new Set(ids);

  // Never touch real people: abort if any match mixes a seed and a real participant.
  // A match can come back in two batches (one per side): key by id.
  const byId = new Map<string, { id: string; a_id: string; b_id: string }>();
  for (const batch of chunks(ids, 50)) {
    const rows = await must(db.from('matches').select('id, a_id, b_id').or(`a_id.in.(${batch}),b_id.in.(${batch})`));
    for (const m of rows) byId.set(m.id, m);
  }
  const matches = [...byId.values()];
  const mixed = matches.filter((m) => seed.has(m.a_id) !== seed.has(m.b_id));
  if (mixed.length) throw new Error(`Há ${mixed.length} matches entre seed e pessoas reais; nada foi apagado.`);

  for (const batch of chunks(ids, 50)) {
    await must(db.from('contact_clicks').delete().in('participant_id', batch));
    await must(db.from('content_flags').delete().in('participant_id', batch));
    await must(db.from('reviews').delete().in('reviewer_id', batch));
    await must(db.from('review_requests').delete().in('participant_id', batch));
    await must(db.from('email_log').delete().in('participant_id', batch));
  }
  for (const batch of chunks(ids, 50)) await must(db.from('matches').delete().in('a_id', batch));
  for (const batch of chunks(ids, 50)) await must(db.from('participants').delete().in('id', batch).eq('is_seed', true));
  console.log(`Seed apagado: ${ids.length} participantes, ${matches.length} matches.`);
}

async function seed() {
  if ((await seedIds()).length) throw new Error('Já há dados de seed. Corra primeiro: npm run seed:clean');
  const rng = mulberry32(SEED);
  const now = Date.now();
  const delay = reviewDelayDays();
  const at = (ms: number) => new Date(ms).toISOString();
  const between = (from: number, to: number) => from + rng() * Math.max(0, to - from);

  // 1. Participants: created 11–14 days ago, inactive, no account, no e-mail.
  const people = seedPeople(PEOPLE, rng).map((p) => ({ ...p, created: now - between(11 * DAY, 14 * DAY) }));
  const inserted = await must(
    db
      .from('participants')
      .insert(
        people.map(({ created, ...p }) => ({
          ...p,
          is_seed: true,
          active: false,
          user_id: null,
          email: null,
          consent_at: at(created),
          created_at: at(created),
        })),
      )
      .select('id, whatsapp, created_at'),
  );
  const idOf = new Map(inserted.map((r) => [r.whatsapp as string, r.id as string])); // fake numbers are unique
  const hasInstagram = new Set(people.filter((p) => p.instagram).map((p) => idOf.get(p.whatsapp)!));

  // 2. Matching with the real rules, only among seed people (active only in memory).
  const pool: Candidate[] = people.map((p) => ({
    id: idOf.get(p.whatsapp)!,
    interests: p.interests,
    active: true,
    createdAt: at(p.created),
    compatibleCount: 0,
    controlCount: 0,
    matchedIds: new Set(),
  }));
  const config = matchingConfig();
  const proposals = [...pool]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .flatMap((person) => planMatches(person, pool, config, rng));

  // Matches are old enough for their reviews to be open (delay + 1 day or more).
  const matchRows = proposals.map((p) => ({
    a_id: p.aId,
    b_id: p.bId,
    type: p.type,
    score: p.score,
    shared_items: p.sharedItems,
    shared_count: p.sharedCount,
    shared_by_category: p.sharedByCategory,
    created_at: at(now - between((delay + 1) * DAY, 10 * DAY)),
  }));
  const matches = await must(db.from('matches').insert(matchRows).select('id, a_id, b_id, type, shared_count, created_at'));

  // 3. Reviews (~75% of sides) and contact taps (before the review).
  const reviews: Record<string, unknown>[] = [];
  const clicks: Record<string, unknown>[] = [];
  for (const m of matches) {
    const created = new Date(m.created_at).getTime();
    const opens = created + delay * DAY - REVIEW_GRACE_MS;
    for (const [person, other] of [
      [m.a_id, m.b_id],
      [m.b_id, m.a_id],
    ]) {
      const both = hasInstagram.has(person) && hasInstagram.has(other);
      const answers = rng() < 0.75 ? seedReview(rng, m.type, m.shared_count, both) : null;
      const reviewedAt = answers ? between(Math.max(opens, created), now - 60_000) : now;
      if (answers) reviews.push({ ...answers, match_id: m.id, reviewer_id: person, created_at: at(reviewedAt) });
      const tapP = answers ? (answers.contacted ? 0.85 : 0.3) : 0.5;
      if (rng() < tapP) {
        clicks.push({
          match_id: m.id,
          participant_id: person,
          channel: hasInstagram.has(other) && rng() < 0.25 ? 'instagram' : 'whatsapp', // no button without Instagram
          created_at: at(between(created, reviewedAt)),
        });
      }
    }
  }
  for (const batch of chunks(reviews, 200)) await must(db.from('reviews').insert(batch));
  for (const batch of chunks(clicks, 200)) await must(db.from('contact_clicks').insert(batch));

  // 4. A few example content alerts (never sent to the AI).
  const flagged = pool.slice(0, 3).map((c, i) => ({
    participant_id: c.id,
    field: i === 2 ? 'review_comment' : 'talk_about',
    text: ['Texto de exemplo (seed) com linguagem imprópria', 'Liga-me para o 912 345 678 (seed)', 'Comentário de exemplo marcado (seed)'][i],
    status: 'flagged',
    category: ['obscene', 'personal_data', 'harassment'][i],
    reason: 'Exemplo gerado pelo seed para testar o painel.',
  }));
  await must(db.from('content_flags').insert(flagged));

  const comp = matches.filter((m) => m.type === 'compatible').length;
  console.log(
    `Seed criado: ${inserted.length} participantes, ${matches.length} matches (${comp} compatíveis, ${matches.length - comp} controlo), ${reviews.length} reviews, ${clicks.length} toques, ${flagged.length} alertas.`,
  );
}

(process.argv.includes('--clean') ? clean() : seed()).catch((err) => {
  console.error(err);
  process.exit(1);
});
