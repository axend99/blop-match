import 'server-only';
import { createElement } from 'react';
import NewMatchEmail from '@/emails/NewMatchEmail';
import { sendEmail } from '@/lib/email';
import { getDict, isLang } from '@/lib/i18n';
import { planMatches, type Candidate } from '@/lib/matching';
import { matchingConfig, siteUrl } from '@/lib/site';
import { createServiceClient } from '@/lib/supabase/service';

type Participant = {
  id: string;
  name: string;
  email: string | null;
  lang: string;
  interests: string[];
  active: boolean;
  created_at: string;
  deleted_at: string | null;
};

type MatchRow = { id: string; a_id: string; b_id: string; type: 'compatible' | 'control' };

// Loads everything at once (fine at this study's size: PostgREST returns up to 1000 rows per query).
async function loadState() {
  const supabase = createServiceClient();
  const [people, matches] = await Promise.all([
    supabase.from('participants').select('id, name, email, lang, interests, active, created_at, deleted_at'),
    supabase.from('matches').select('id, a_id, b_id, type'),
  ]);
  if (people.error) throw people.error;
  if (matches.error) throw matches.error;

  const participants = people.data as Participant[];
  const byId = new Map(participants.map((p) => [p.id, p]));
  const pool = new Map<string, Candidate>(
    participants.map((p) => [
      p.id,
      {
        id: p.id,
        interests: p.interests,
        active: p.active && !p.deleted_at,
        createdAt: p.created_at,
        compatibleCount: 0,
        controlCount: 0,
        matchedIds: new Set<string>(),
      },
    ]),
  );
  for (const m of matches.data as MatchRow[]) {
    for (const [self, other] of [[m.a_id, m.b_id], [m.b_id, m.a_id]]) {
      const c = pool.get(self);
      if (!c) continue;
      if (m.type === 'compatible') c.compatibleCount++;
      else c.controlCount++;
      c.matchedIds.add(other);
    }
  }
  return { supabase, byId, pool, matches: matches.data as MatchRow[] };
}

async function notify(participant: Participant | undefined, matchId: string): Promise<boolean> {
  if (!participant?.email || participant.deleted_at || !participant.active) return false;
  const lang = isLang(participant.lang) ? participant.lang : 'en';
  return sendEmail({
    participantId: participant.id,
    kind: 'new_match',
    matchId,
    to: participant.email,
    subject: getDict(lang).emails.newMatch.subject,
    react: createElement(NewMatchEmail, { name: participant.name, lang, url: `${siteUrl()}/me` }),
  });
}

async function createMatches(
  state: Awaited<ReturnType<typeof loadState>>,
  person: Candidate,
): Promise<number> {
  const config = matchingConfig();
  const proposals = planMatches(person, [...state.pool.values()], config);
  let created = 0;

  for (const p of proposals) {
    const { data: matchId, error } = await state.supabase.rpc('try_create_match', {
      p_a: p.aId,
      p_b: p.bId,
      p_type: p.type,
      p_score: p.score,
      p_shared: p.sharedItems,
      p_shared_count: p.sharedCount,
      p_by_cat: p.sharedByCategory,
      p_max_compatible: config.maxCompatible,
      p_max_control: config.maxControl,
    });
    if (error || !matchId) {
      // Failed, or lost a race for the slot: undo the in-memory booking; the next run tries again.
      if (error) console.error('[matching] try_create_match failed', error);
      release(state, p.aId, p.bId, p.type);
      continue;
    }
    created++;
    await Promise.all([notify(state.byId.get(p.aId), matchId), notify(state.byId.get(p.bId), matchId)]);
  }
  return created;
}

function release(state: Awaited<ReturnType<typeof loadState>>, aId: string, bId: string, type: string) {
  for (const [self, other] of [[aId, bId], [bId, aId]]) {
    const c = state.pool.get(self);
    if (!c) continue;
    if (type === 'compatible') c.compatibleCount--;
    else c.controlCount--;
    c.matchedIds.delete(other);
  }
}

// Runs after a profile is created: fills the new person's slots, which also fills the
// slots of people who were already waiting.
export async function runMatchingFor(participantId: string): Promise<number> {
  const state = await loadState();
  const person = state.pool.get(participantId);
  return person ? createMatches(state, person) : 0;
}

// Daily cron: everyone with free slots, oldest first, then re-sends any new_match email
// that was lost (email_log makes this idempotent). Stops at `deadline` (ms timestamp) so the
// request stays within the function time limit; the rest is done on the next run.
export async function runMatchingForAll(deadline = Infinity): Promise<{ created: number; emailsRetried: number }> {
  const state = await loadState();
  const config = matchingConfig();
  const waiting = [...state.pool.values()]
    .filter((c) => c.active && (c.compatibleCount < config.maxCompatible || c.controlCount < config.maxControl))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  let created = 0;
  for (const person of waiting) {
    if (Date.now() > deadline) break;
    created += await createMatches(state, person);
  }

  const { data: sent } = await state.supabase.from('email_log').select('participant_id, match_id').eq('kind', 'new_match');
  const done = new Set((sent ?? []).map((r) => `${r.participant_id}|${r.match_id}`));
  let emailsRetried = 0;
  for (const m of state.matches) {
    for (const id of [m.a_id, m.b_id]) {
      if (done.has(`${id}|${m.id}`) || Date.now() > deadline) continue;
      if (await notify(state.byId.get(id), m.id)) emailsRetried++;
    }
  }
  return { created, emailsRetried };
}
