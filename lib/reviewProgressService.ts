import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

// Review requests and the taps/views recorded on the way to a review, for /admin.
export async function loadReviewTracking() {
  const supabase = createServiceClient();
  const [requests, clicks, views] = await Promise.all([
    supabase.from('review_requests').select('match_id, participant_id, requested_at, reminded_at'),
    supabase.from('review_clicks').select('match_id, participant_id, source'),
    supabase.from('review_views').select('match_id, participant_id'),
  ]);
  for (const r of [requests, clicks, views]) if (r.error) throw r.error;
  return { requests: requests.data!, clicks: clicks.data!, views: views.data! };
}
