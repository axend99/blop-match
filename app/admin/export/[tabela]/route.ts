import { NextResponse, type NextRequest } from 'next/server';
import { isAdmin } from '@/lib/admin';
import { loadAdminData } from '@/lib/adminData';
import { toCsv } from '@/lib/csv';
import { dataMode } from '@/lib/stats';

export const dynamic = 'force-dynamic';

const TABLES = ['participantes', 'matches', 'reviews', 'palpites', 'experiencia'] as const;
type Table = (typeof TABLES)[number];

export async function GET(request: NextRequest, { params }: { params: Promise<{ tabela: string }> }) {
  const { tabela } = await params;
  if (!(await isAdmin()) || !TABLES.includes(tabela as Table)) return new NextResponse('Not found', { status: 404 });

  const mode = dataMode(request.nextUrl.searchParams.get('dados') ?? undefined);
  const { participants, matches, rows, guesses, experiences, personById, tapped, firstTap } = await loadAdminData(mode);
  const seedOf = (id: string) => personById.get(id)?.is_seed ?? false;
  const has = (match: string, person: string, channel: string) => (tapped.get(`${match}|${person}`) ?? []).includes(channel);
  const mineIn = (match: string, person: string) => guesses.filter((g) => g.match_id === match && g.guesser_id === person);
  let csv: string;
  if (tabela === 'participantes') {
    csv = toCsv(
      ['id', 'name', 'email', 'whatsapp', 'instagram', 'city', 'lang', 'age', 'age_range', 'time_in_city', 'origin', 'interests', 'other_text', 'talk_about', 'talk_about_code', 'gender', 'gender_estimate', 'cohort', 'password', 'password_kind', 'nickname', 'leaderboard_show_name', 'active', 'deleted_at', 'is_seed', 'created_at'],
      participants,
    );
  } else if (tabela === 'matches') {
    csv = toCsv(
      ['id', 'a_id', 'a_name', 'a_is_seed', 'a_clicked', 'a_first_click_at', 'b_id', 'b_name', 'b_is_seed', 'b_clicked', 'b_first_click_at', 'type', 'assigned_type', 'points', 'score', 'shared_count', 'shared_items', 'shared_by_category', 'created_at'],
      matches.map((m) => ({
        ...m,
        a_name: personById.get(m.a_id)?.name,
        a_is_seed: seedOf(m.a_id),
        b_name: personById.get(m.b_id)?.name,
        b_is_seed: seedOf(m.b_id),
        a_clicked: tapped.get(`${m.id}|${m.a_id}`) ?? [],
        a_first_click_at: firstTap.get(`${m.id}|${m.a_id}`),
        b_clicked: tapped.get(`${m.id}|${m.b_id}`) ?? [],
        b_first_click_at: firstTap.get(`${m.id}|${m.b_id}`),
      })),
    );
  } else if (tabela === 'experiencia') {
    // The BLOP experience review (once per person, since 18/11/2026).
    csv = toCsv(
      ['participant_id', 'name', 'cohort', 'likes_concept', 'best_for', 'personality', 'party_interest', 'game_fun_1_7', 'comment', 'created_at'],
      experiences.map((e) => ({ ...e, name: personById.get(e.participant_id)?.name, cohort: personById.get(e.participant_id)?.cohort })),
    );
  } else if (tabela === 'palpites') {
    // v2 password game: every guess, with the match type and whether the guesser had reviewed by then.
    const reviewAt = new Map(rows.map((r) => [`${r.match_id}|${r.review.reviewer_id}`, r.review.created_at]));
    csv = toCsv(
      ['id', 'match_id', 'type', 'guesser_id', 'guesser_name', 'attempt', 'guess', 'is_right', 'right', 'before_review', 'created_at'],
      guesses.map((g) => ({
        ...g,
        type: matches.find((m) => m.id === g.match_id)?.type,
        guesser_name: personById.get(g.guesser_id)?.name,
        before_review: !reviewAt.has(`${g.match_id}|${g.guesser_id}`) || g.created_at < reviewAt.get(`${g.match_id}|${g.guesser_id}`)!,
      })),
    );
  } else {
    // Each review with its match and the profile of the person who answered.
    csv = toCsv(
      [
        'id', 'match_id', 'reviewer_id', 'reviewer_name', 'is_seed', 'created_at',
        'type', 'assigned_type', 'shared_count', 'shared_items', 'shared_by_category',
        'age', 'age_range', 'time_in_city', 'origin', 'city', 'lang',
        'contacted', 'interest_1_7', 'who_first', 'comfort_1_7', 'why_not', 'talked', 'flow_1_7',
        'common_ground_1_7', 'satisfaction_1_7', 'meet_again_1_7', 'met', 'next_step', 'ig_follow', 'likes_concept', 'best_for', 'party_interest', 'personality', 'comment', 'low_interest_reasons', 'password_said', 'password_guesses', 'password_guess_right',
        'clicked_whatsapp', 'clicked_instagram', 'first_click_at', 'clicked_before_review',
      ],
      rows.map((r) => ({
        ...r,
        ...r.review,
        reviewer_name: personById.get(r.review.reviewer_id)?.name,
        age: personById.get(r.review.reviewer_id)?.age,
        is_seed: seedOf(r.review.reviewer_id),
        // v2 password game: this reviewer's guesses in this match (all tries), and whether one was right.
        password_guesses: mineIn(r.match_id, r.review.reviewer_id).map((g) => g.guess).join('|'),
        password_guess_right: mineIn(r.match_id, r.review.reviewer_id).length ? mineIn(r.match_id, r.review.reviewer_id).some((g) => g.right) : '',
        clicked_whatsapp: has(r.match_id, r.review.reviewer_id, 'whatsapp'),
        clicked_instagram: has(r.match_id, r.review.reviewer_id, 'instagram'),
        first_click_at: firstTap.get(`${r.match_id}|${r.review.reviewer_id}`),
        clicked_before_review: (firstTap.get(`${r.match_id}|${r.review.reviewer_id}`) ?? '9999') <= r.review.created_at,
      })),
    );
  }

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="blop-${tabela}-${mode}-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
