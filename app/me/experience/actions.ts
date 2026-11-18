'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { getMyParticipant, getUser } from '@/lib/auth';
import { moderate } from '@/lib/moderationService';
import { validateExperience, type ExperienceErrors, type ReviewInput } from '@/lib/review';
import { createServiceClient } from '@/lib/supabase/service';

export type ExperienceState = { errors?: ExperienceErrors; failed?: boolean };

// The BLOP experience review, once per person (the primary key blocks a second one).
export async function saveExperience(input: ReviewInput): Promise<ExperienceState> {
  if (!(await getUser())) redirect('/login');
  const me = await getMyParticipant();
  if (!me) redirect('/join');
  const result = validateExperience(input, { askGame: me.cohort === 'v2' });
  if (!result.ok) return { errors: result.errors };

  const { error } = await createServiceClient()
    .from('experience_reviews')
    .insert({ ...result.data, participant_id: me.id });
  if (error && error.code !== '23505') {
    console.error('[experience] insert failed', error);
    return { failed: true };
  }
  if (!error && result.data.comment) {
    after(async () => {
      try {
        await moderate(me.id, [{ field: 'review_comment', text: result.data.comment! }]);
      } catch (err) {
        console.error('[experience] moderation failed', err);
      }
    });
  }
  revalidatePath('/me');
  redirect('/me');
}
