import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import ReviewForm from '@/components/ReviewForm';
import { getMyParticipant, getUser } from '@/lib/auth';
import { getDict } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { getMyMatches } from '@/lib/myMatches';
import { formatDate, reviewOpensAt } from '@/lib/site';
import looking from '@/public/blop/looking.webp';

// The server action also runs the AI check of the comment in after().
export const maxDuration = 60;

export default async function ReviewPage({ params }: { params: Promise<{ matchId: string }> }) {
  if (!(await getUser())) redirect('/login');
  const me = await getMyParticipant();
  if (!me) redirect('/join');
  const { matchId } = await params;
  const match = (await getMyMatches()).find((m) => m.match_id === matchId);
  if (!match) notFound();

  const lang = await getLang();
  const t = getDict(lang);
  const opensAt = reviewOpensAt(match.created_at);
  const { title, opensOn, ...formTexts } = t.review;

  const back = (
    <Link href="/me" className="block text-sm font-medium text-violet">
      ← {t.match.back}
    </Link>
  );

  if (match.reviewed_by_me || opensAt > new Date()) {
    return (
      <div className="space-y-6">
        {back}
        <section className="space-y-3 rounded-3xl bg-white p-6 text-center">
          <Image src={looking} alt="" className="mx-auto w-40" />
          <p className="text-lg">{match.reviewed_by_me ? t.review.alreadyDone : opensOn(formatDate(opensAt, lang))}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {back}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{match.other_deleted ? t.review.titleFormer : title(match.other_name)}</h1>
        <p className="text-midnight/70">{t.review.intro}</p>
      </div>
      <ReviewForm
        matchId={match.match_id}
        t={formTexts}
        genericError={t.common.genericError}
        askInstagram={Boolean(me.instagram && match.other_instagram)}
      />
      {!match.other_deleted && (
        <Link href={`/me/report/${match.match_id}`} className="block text-center text-sm text-midnight/50 underline">
          {t.report.link}
        </Link>
      )}
    </div>
  );
}
