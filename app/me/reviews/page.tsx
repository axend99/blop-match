import Link from 'next/link';
import { redirect } from 'next/navigation';
import Blop from '@/components/Blop';
import ReviewStatus from '@/components/ReviewStatus';
import StudyTabs from '@/components/StudyTabs';
import { getMyParticipant, getUser } from '@/lib/auth';
import { avatarCategory } from '@/lib/avatar';
import { getDict } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { getMyStudy } from '@/lib/myStudy';

// Reviews tab: each match's review (open, done or the day it opens) and the one-time review of
// BLOP itself.
export default async function ReviewsPage() {
  if (!(await getUser())) redirect('/login?next=/me/reviews');
  const me = await getMyParticipant();
  if (!me) redirect('/join');
  if (me.cohort === 'v2' && !me.password) redirect('/join/password');
  const lang = await getLang();
  const t = getDict(lang);
  const study = await getMyStudy(me);
  const r = t.reviewsPage;

  return (
    <div className="space-y-6">
      <StudyTabs t={t.tabs} active="reviews" pending={study.pending} showLeaderboard={me.cohort === 'v2'} />
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">{r.title}</h1>
        <p className="text-midnight/70">{r.intro}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">{r.matchesTitle}</h2>
        {study.matches.length === 0 ? (
          <p className="rounded-3xl bg-white p-5 text-midnight/70">{r.none}</p>
        ) : (
          <ul className="space-y-3">
            {study.matches.map((m) => (
              <li key={m.match_id} className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-sm">
                <Blop variant={m.other_deleted ? null : avatarCategory(m.other_interests)} className="size-14 shrink-0" sizes="56px" />
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="truncate text-lg font-semibold">{m.other_deleted ? t.me.formerParticipant : m.other_name}</p>
                  <ReviewStatus t={t.me} lang={lang} createdAt={m.created_at} reviewed={m.reviewed_by_me} matchId={m.match_id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-3xl bg-pink/50 p-6">
        <h2 className="text-xl font-semibold">💜 {r.appTitle}</h2>
        {study.experienceDone ? (
          <p className="font-medium">{r.appDone}</p>
        ) : (
          <>
            <p className="text-midnight/80">{r.appBody}</p>
            <Link href="/me/experience" className="inline-block rounded-full bg-violet px-6 py-3 font-semibold text-white active:scale-[0.98]">
              {r.appButton}
            </Link>
          </>
        )}
      </section>
    </div>
  );
}
