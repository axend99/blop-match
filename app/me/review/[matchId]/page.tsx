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

export default async function ReviewPage({ params }: { params: Promise<{ matchId: string }> }) {
  if (!(await getUser())) redirect('/login');
  if (!(await getMyParticipant())) redirect('/join');
  const { matchId } = await params;
  const match = (await getMyMatches()).find((m) => m.match_id === matchId);
  if (!match) notFound();

  const lang = await getLang();
  const t = getDict(lang);
  const name = match.other_deleted ? t.me.formerParticipant : match.other_name;
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
        <h1 className="text-3xl font-bold">{title(name)}</h1>
        <p className="text-midnight/70">{t.review.intro}</p>
      </div>
      <ReviewForm matchId={match.match_id} t={formTexts} genericError={t.common.genericError} />
    </div>
  );
}
