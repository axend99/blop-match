import { redirect } from 'next/navigation';
import ExperienceForm from '@/components/ExperienceForm';
import { getMyParticipant, getUser } from '@/lib/auth';
import { getDict } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { createServiceClient } from '@/lib/supabase/service';

// The BLOP experience review: once per person, after their first match review.
export default async function ExperiencePage() {
  if (!(await getUser())) redirect('/login?next=/me/experience');
  const me = await getMyParticipant();
  if (!me) redirect('/join');
  const { data: done } = await createServiceClient().from('experience_reviews').select('participant_id').eq('participant_id', me.id).maybeSingle();
  if (done) redirect('/me');
  const t = getDict(await getLang());
  const r = t.review;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{t.experience.title}</h1>
        <p className="text-midnight/70">{t.experience.intro}</p>
      </div>
      <ExperienceForm
        genericError={t.common.genericError}
        t={{
          likesConcept: r.likesConcept,
          yes: r.yes,
          no: r.no,
          bestFor: r.bestFor,
          bestForOptions: r.bestForOptions,
          personality: r.personality,
          personalityOptions: r.personalityOptions,
          party: r.party,
          partyOptions: r.partyOptions,
          gameFun: me.cohort === 'v2' ? t.experience.gameFun : null,
          notAtAll: r.notAtAll,
          veryMuch: r.veryMuch,
          comment: t.experience.comment,
          required: r.errors.required,
          tooLong: r.errors.tooLong,
          submit: t.experience.submit,
          submitting: r.submitting,
          skip: t.experience.skip,
        }}
      />
    </div>
  );
}
