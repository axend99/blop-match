import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

// Data deletion on request = anonymisation (SPEC §privacy, supabase/migrations/0001_init.sql): the
// row is kept with personal fields cleared, the person's content_flags, contact_clicks and
// waitlist_clicks rows are deleted, then the auth user is deleted. Matches and the other person's reviews survive, without personal data.
export async function deleteParticipantData(participantId: string, userId: string | null): Promise<boolean> {
  const supabase = createServiceClient();

  for (const table of ['content_flags', 'contact_clicks', 'waitlist_clicks']) {
    const { error } = await supabase.from(table).delete().eq('participant_id', participantId);
    if (error) {
      console.error(`[delete] ${table} failed`, error);
      return false;
    }
  }

  const { error } = await supabase
    .from('participants')
    .update({
      name: '[deleted]',
      email: null,
      whatsapp: null,
      instagram: null,
      talk_about: null,
      talk_about_code: null,
      other_text: {},
      active: false,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', participantId);
  if (error) {
    console.error('[delete] anonymise failed', error);
    return false;
  }

  if (userId) {
    const auth = await supabase.auth.admin.deleteUser(userId);
    if (auth.error) console.error('[delete] auth user delete failed', auth.error); // data is already gone
  }
  return true;
}
