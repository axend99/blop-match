import 'server-only';
import { isE2eEmail } from '@/lib/e2eUsers';
import { analysisType, compatPoints } from '@/lib/matching';
import { matchingConfig } from '@/lib/site';
import { filterAdminData, type DataMode, type ReviewRow } from '@/lib/stats';
import { createServiceClient } from '@/lib/supabase/service';

// Loads whole tables for /admin, 1000 rows per page in a stable order (PostgREST limit).
// Any query error throws: the panel must never show zeros for missing data.
async function all<T>(table: string, columns: string): Promise<T[]> {
  const supabase = createServiceClient();
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).order('id').range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return rows;
  }
}

export type AdminParticipant = {
  id: string;
  name: string;
  email: string | null;
  whatsapp: string | null;
  instagram: string | null;
  city: string;
  lang: string;
  age: number | null;
  age_range: string;
  time_in_city: string;
  origin: string;
  interests: string[];
  other_text: Record<string, string>;
  talk_about: string | null;
  talk_about_code: string | null;
  active: boolean;
  pending_review: boolean;
  deleted_at: string | null;
  is_seed: boolean;
  created_at: string;
};

export type AdminMatch = {
  id: string;
  a_id: string;
  b_id: string;
  type: 'compatible' | 'control'; // group for the analysis (analysisType), not the stored one
  assigned_type: 'compatible' | 'control'; // type stored when the match was created
  points: number; // compatibility points: shared interests + 1 if ages are close
  score: number;
  shared_items: string[];
  shared_count: number;
  shared_by_category: Record<string, number>;
  created_at: string;
};

export type AdminReview = Omit<ReviewRow, 'type' | 'shared_count' | 'shared_by_category' | 'shared_items' | 'age_range' | 'time_in_city' | 'origin' | 'city' | 'lang'> & {
  id: string;
  reviewer_id: string;
  who_first: string | null;
  comment: string | null;
  created_at: string;
};

export type AdminFlag = {
  id: string;
  participant_id: string;
  match_id: string | null;
  field: string;
  text: string;
  status: 'flagged' | 'error';
  category: string | null;
  reason: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type AdminClick = { match_id: string; participant_id: string; channel: string; created_at: string };

export type AdminReport = {
  id: string;
  match_id: string | null;
  reporter_id: string | null;
  reported_id: string | null;
  reason: string;
  details: string | null;
  created_at: string;
  resolved_at: string | null;
  resolution: string | null;
};

export async function loadAdminData(mode: DataMode) {
  const [allParticipants, storedMatches, allReviews, allFlags, allClicks, reports, waitlistClicks, waitlistSent] = await Promise.all([
    all<AdminParticipant>(
      'participants',
      'id, name, email, whatsapp, instagram, city, lang, age, age_range, time_in_city, origin, interests, other_text, talk_about, talk_about_code, active, pending_review, deleted_at, is_seed, created_at',
    ),
    all<Omit<AdminMatch, 'assigned_type' | 'points'>>('matches', 'id, a_id, b_id, type, score, shared_items, shared_count, shared_by_category, created_at'),
    all<AdminReview>(
      'reviews',
      'id, match_id, reviewer_id, contacted, interest_1_7, who_first, comfort_1_7, why_not, talked, flow_1_7, common_ground_1_7, satisfaction_1_7, meet_again_1_7, met, ig_follow, likes_concept, best_for, party_interest, comment, next_step, created_at',
    ),
    all<AdminFlag>('content_flags', 'id, participant_id, match_id, field, text, status, category, reason, created_at, resolved_at'),
    all<AdminClick>('contact_clicks', 'match_id, participant_id, channel, created_at'),
    all<AdminReport>('reports', 'id, match_id, reporter_id, reported_id, reason, details, created_at, resolved_at, resolution'),
    all<{ participant_id: string | null; source: string }>('waitlist_clicks', 'id, participant_id, source'),
    all<{ participant_id: string; kind: string }>('email_log', 'id, participant_id, kind').then((rows) => rows.filter((r) => r.kind === 'waitlist')),
  ]);
  // Analysis group from the current rule (points include the age bonus), stored type kept apart.
  const ageOf = new Map(allParticipants.map((p) => [p.id, p.age]));
  const min = matchingConfig().minSharedCompatible;
  const allMatches = storedMatches.map((m): AdminMatch => {
    const points = compatPoints(m.shared_count, ageOf.get(m.a_id), ageOf.get(m.b_id));
    return { ...m, assigned_type: m.type, points, type: analysisType(points, min) };
  });
  const seedCount = allParticipants.filter((p) => p.is_seed).length;
  const e2eCount = allParticipants.filter((p) => isE2eEmail(p.email)).length;
  // Whole base (not filtered): what waits for an admin in the Verificação tab.
  const pendingCount = allParticipants.filter((p) => p.pending_review && !p.deleted_at && !p.is_seed).length;
  const openReports = reports.filter((r) => !r.resolved_at).length;
  const allPeople = new Map(allParticipants.map((p) => [p.id, p]));
  const { participants, matches, reviews, flags, clicks } = filterAdminData(
    { participants: allParticipants, matches: allMatches, reviews: allReviews, flags: allFlags, clicks: allClicks },
    mode,
  );

  const personById = new Map(participants.map((p) => [p.id, p]));
  const matchById = new Map(matches.map((m) => [m.id, m]));

  // Each review joined with its match and the profile of the person who answered.
  const rows: (ReviewRow & { review: AdminReview; assigned_type: AdminMatch['assigned_type'] })[] = reviews.flatMap((r) => {
    const m = matchById.get(r.match_id);
    const p = personById.get(r.reviewer_id);
    if (!m || !p) return [];
    return [
      {
        ...r,
        review: r,
        type: m.type,
        assigned_type: m.assigned_type,
        shared_count: m.shared_count,
        shared_by_category: m.shared_by_category,
        shared_items: m.shared_items,
        age_range: p.age_range,
        time_in_city: p.time_in_city,
        origin: p.origin,
        city: p.city,
        lang: p.lang,
      },
    ];
  });

  // Channels each person tapped in each match, and their first tap: `${match}|${person}`.
  const tapped = new Map<string, string[]>();
  const firstTap = new Map<string, string>();
  for (const c of clicks) {
    const key = `${c.match_id}|${c.participant_id}`;
    tapped.set(key, [...(tapped.get(key) ?? []), c.channel]);
    if (!firstTap.has(key) || c.created_at < firstTap.get(key)!) firstTap.set(key, c.created_at);
  }

  return {
    participants,
    matches,
    reviews,
    flags,
    clicks,
    tapped,
    firstTap,
    rows,
    personById,
    matchById,
    seedCount,
    e2eCount,
    pendingCount,
    openReports,
    reports,
    allPeople,
    allFlags,
    // Waiting list (BLOP app), for the people in the current data filter.
    waitlist: (() => {
      const ids = new Set(participants.map((p) => p.id));
      const clicks = waitlistClicks.filter((c) => c.participant_id && ids.has(c.participant_id));
      return {
        invited: new Set(waitlistSent.filter((r) => ids.has(r.participant_id)).map((r) => r.participant_id)).size,
        fromEmail: clicks.filter((c) => c.source === 'email').length,
        fromButton: clicks.filter((c) => c.source === 'button').length,
        people: new Set(clicks.map((c) => c.participant_id)).size,
      };
    })(),
  };
}
