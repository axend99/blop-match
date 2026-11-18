import 'server-only';
import type { MyParticipant } from '@/lib/auth';
import { getMyMatches } from '@/lib/myMatches';
import { reviewDueAt } from '@/lib/site';
import { createServiceClient } from '@/lib/supabase/service';

// What the study tabs need: the person's matches, how many reviews are open, and whether the
// one-time experience review is done.
export async function getMyStudy(me: MyParticipant) {
  const [matches, { data: experience }] = await Promise.all([
    getMyMatches(),
    createServiceClient().from('experience_reviews').select('participant_id').eq('participant_id', me.id).maybeSingle(),
  ]);
  const toReview = matches
    .filter((m) => !m.reviewed_by_me && reviewDueAt(m.created_at) <= new Date())
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const experienceDone = Boolean(experience);
  // The experience review is asked after the first match review.
  const askExperience = !experienceDone && matches.some((m) => m.reviewed_by_me);
  return { matches, toReview, experienceDone, askExperience, pending: toReview.length + (askExperience ? 1 : 0) };
}
