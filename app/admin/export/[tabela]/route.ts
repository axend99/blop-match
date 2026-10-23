import { NextResponse, type NextRequest } from 'next/server';
import { isAdmin } from '@/lib/admin';
import { loadAdminData } from '@/lib/adminData';
import { toCsv } from '@/lib/csv';
import { dataMode } from '@/lib/stats';

export const dynamic = 'force-dynamic';

const TABLES = ['participantes', 'matches', 'reviews'] as const;
type Table = (typeof TABLES)[number];

export async function GET(request: NextRequest, { params }: { params: Promise<{ tabela: string }> }) {
  const { tabela } = await params;
  if (!(await isAdmin()) || !TABLES.includes(tabela as Table)) return new NextResponse('Not found', { status: 404 });

  const mode = dataMode(request.nextUrl.searchParams.get('dados') ?? undefined);
  const { participants, matches, rows, personById, tapped, firstTap } = await loadAdminData(mode);
  const seedOf = (id: string) => personById.get(id)?.is_seed ?? false;
  const has = (match: string, person: string, channel: string) => (tapped.get(`${match}|${person}`) ?? []).includes(channel);
  let csv: string;
  if (tabela === 'participantes') {
    csv = toCsv(
      ['id', 'name', 'email', 'whatsapp', 'instagram', 'city', 'lang', 'age', 'age_range', 'time_in_city', 'origin', 'interests', 'other_text', 'talk_about', 'talk_about_code', 'active', 'deleted_at', 'is_seed', 'created_at'],
      participants,
    );
  } else if (tabela === 'matches') {
    csv = toCsv(
      ['id', 'a_id', 'a_name', 'a_is_seed', 'a_clicked', 'a_first_click_at', 'b_id', 'b_name', 'b_is_seed', 'b_clicked', 'b_first_click_at', 'type', 'score', 'shared_count', 'shared_items', 'shared_by_category', 'created_at'],
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
  } else {
    // Each review with its match and the profile of the person who answered.
    csv = toCsv(
      [
        'id', 'match_id', 'reviewer_id', 'reviewer_name', 'is_seed', 'created_at',
        'type', 'shared_count', 'shared_items', 'shared_by_category',
        'age', 'age_range', 'time_in_city', 'origin', 'city', 'lang',
        'contacted', 'interest_1_7', 'who_first', 'comfort_1_7', 'why_not', 'talked', 'flow_1_7',
        'common_ground_1_7', 'satisfaction_1_7', 'meet_again_1_7', 'met', 'next_step', 'ig_follow', 'likes_concept', 'best_for', 'comment',
        'clicked_whatsapp', 'clicked_instagram', 'first_click_at', 'clicked_before_review',
      ],
      rows.map((r) => ({
        ...r,
        ...r.review,
        reviewer_name: personById.get(r.review.reviewer_id)?.name,
        age: personById.get(r.review.reviewer_id)?.age,
        is_seed: seedOf(r.review.reviewer_id),
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
