import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { pageAll } from '@/lib/supabase/pageAll';

// Review requests and the taps/views recorded on the way to a review, for /admin.
export async function loadReviewTracking() {
  const supabase = createServiceClient();
  const [requests, clicks, views] = await Promise.all([
    pageAll((a, b) =>
      supabase.from('review_requests').select('match_id, participant_id, requested_at, reminded_at').order('match_id').order('participant_id').range(a, b),
    ),
    pageAll((a, b) => supabase.from('review_clicks').select('match_id, participant_id, source').order('id').range(a, b)),
    pageAll((a, b) => supabase.from('review_views').select('match_id, participant_id').order('id').range(a, b)),
  ]);
  for (const r of [requests, clicks, views]) if (r.error) throw r.error;
  return { requests: requests.data!, clicks: clicks.data!, views: views.data! };
}
