import 'server-only';
import { createElement } from 'react';
import NewMatchEmail from '@/emails/NewMatchEmail';
import { sendEmail } from '@/lib/email';
import { getDict, isLang } from '@/lib/i18n';
import { itemShares, planMatches, type Candidate } from '@/lib/matching';
import { matchingConfig, siteUrl, V1_ENDS_AT } from '@/lib/site';
import { createServiceClient } from '@/lib/supabase/service';
import { pageAll } from '@/lib/supabase/pageAll';

type Participant = {
  id: string;
  name: string;
  email: string | null;
  lang: string;
  match_lang: string | null;
  interests: string[];
  talk_about_code: string | null;
  age: number | null;
  active: boolean;
  pending_review: boolean;
  created_at: string;
  deleted_at: string | null;
  cohort: string;
  password: string | null;
};

type MatchRow = { id: string; a_id: string; b_id: string; type: 'compatible' | 'control'; created_at: string };

// Loads everything at once (fine at this study's size: PostgREST returns up to 1000 rows per query).
async function loadState() {
  const supabase = createServiceClient();
  const [people, matches] = await Promise.all([
    pageAll((a, b) =>
      supabase.from('participants').select('id, name, email, lang, match_lang, interests, talk_about_code, age, active, pending_review, created_at, deleted_at, cohort, password').order('id').range(a, b),
    ),
    pageAll((a, b) => supabase.from('matches').select('id, a_id, b_id, type, created_at').order('id').range(a, b)),
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
        // Pending people (being verified, or reported) get no new matches. Only v2 is matched, and
        // only once the person has chosen a password (the game is part of every v2 match).
        active: p.active && !p.deleted_at && !p.pending_review && p.cohort === 'v2' && Boolean(p.password),
        createdAt: p.created_at,
        age: p.age,
        lang: p.match_lang ?? p.lang, // the language they want to chat in, not the site's
        talkAboutCode: p.talk_about_code,
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
      // v1 matches don't use up v2 slots (people who joined v2 start fresh), but the pair is
      // never matched again.
      if (m.created_at >= V1_ENDS_AT) {
        if (m.type === 'compatible') c.compatibleCount++;
        else c.controlCount++;
      }
      c.matchedIds.add(other);
    }
  }
  // Rarity of each interest over everyone who took part (v1 and v2): steadier than the v2 pool alone.
  const shares = itemShares(participants.filter((p) => !p.deleted_at));
  return { supabase, byId, pool, shares, matches: matches.data as MatchRow[] };
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
    react: createElement(NewMatchEmail, {
      name: participant.name,
      lang,
      url: `${siteUrl()}/me`,
      reportUrl: `${siteUrl()}/login?next=/me/report/${matchId}`,
    }),
  });
}

async function createMatches(
  state: Awaited<ReturnType<typeof loadState>>,
  person: Candidate,
): Promise<number> {
  const config = matchingConfig();
  const proposals = planMatches(person, [...state.pool.values()], config, Math.random, state.shares);
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

  const { data: sent } = await pageAll((a, b) =>
    state.supabase.from('email_log').select('participant_id, match_id').eq('kind', 'new_match').order('id').range(a, b),
  );
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
