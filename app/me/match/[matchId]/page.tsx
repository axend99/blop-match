import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import Blop from '@/components/Blop';
import ReviewStatus from '@/components/ReviewStatus';
import { getMyParticipant, getUser } from '@/lib/auth';
import { avatarCategory } from '@/lib/avatar';
import { whatsappLink, whatsappMessage, type Topic } from '@/lib/icebreaker';
import { getDict, interestLabel } from '@/lib/i18n';
import type { Dict } from '@/lib/i18n/en';
import { getLang } from '@/lib/i18n/server';
import { getMyMatches } from '@/lib/myMatches';
import thinking from '@/public/blop/thinking.webp';

// The match "cheat sheet": who they are and what you have in common.
export default async function MatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  if (!(await getUser())) redirect('/login');
  const me = await getMyParticipant();
  if (!me) redirect('/join');
  const { matchId } = await params;
  const match = (await getMyMatches()).find((m) => m.match_id === matchId);
  if (!match) notFound();

  const lang = await getLang();
  const t = getDict(lang);
  const deleted = match.other_deleted;
  const name = deleted ? t.me.formerParticipant : match.other_name;
  const shared = new Set(match.shared_items);
  const alsoLikes = match.other_interests.filter((code) => !shared.has(code));
  const age = match.other_age_range ? t.join.ageOptions[match.other_age_range as keyof Dict['join']['ageOptions']] : null;
  // One of their interests (in the viewer's language) or their own words; used both on screen
  // and to open WhatsApp with a ready-made message built around it.
  const topic: Topic = match.other_talk_about_code
    ? { code: match.other_talk_about_code, label: interestLabel(match.other_talk_about_code, lang) }
    : match.other_talk_about
      ? { text: match.other_talk_about }
      : null;
  const talksAbout = topic && ('code' in topic ? topic.label : `“${topic.text}”`);
  const whatsapp =
    match.other_whatsapp &&
    whatsappLink(
      match.other_whatsapp,
      whatsappMessage({
        t: t.match,
        me: me.name,
        them: match.other_name,
        topic,
        shared: match.shared_items.map((code) => ({ code, label: interestLabel(code, lang) })),
        myInterests: me.interests,
      }),
    );

  return (
    <article className="space-y-6 text-center">
      <Link href="/me" className="block text-left text-sm font-medium text-violet">
        ← {t.match.back}
      </Link>

      <p className="text-midnight/70">{t.match.intro}</p>
      <Blop variant={deleted ? null : avatarCategory(match.other_interests)} label={t.avatarAlt(name)} className="mx-auto w-56" />

      <div>
        <h1 className="text-3xl font-bold">
          {name}
          {age && !deleted ? `, ${age}` : ''}
        </h1>
        {match.other_city && !deleted && <p className="text-lg text-midnight/70">{t.match.basedIn(match.other_city)}</p>}
        {deleted && <p className="text-midnight/70">{t.match.left}</p>}
      </div>

      {talksAbout && !deleted && (
        <section className="space-y-1 rounded-3xl bg-lime/60 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide">{t.match.talksAbout}</h2>
          <p className="text-lg">{talksAbout}</p>
        </section>
      )}

      {!deleted && (
        <section className="space-y-2 rounded-3xl bg-pink/40 p-5">
          <h2 className="text-lg font-semibold">{t.match.commonGround}</h2>
          {match.shared_items.length > 0 ? (
            <p className="text-lg">{match.shared_items.map((code) => interestLabel(code, lang)).join(' · ')}</p>
          ) : (
            <div className="flex items-center justify-center gap-3">
              <Image src={thinking} alt="" className="w-16" />
              <p className="text-lg">{t.match.getToKnow}</p>
            </div>
          )}
        </section>
      )}

      {alsoLikes.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{t.match.alsoLikes}</h2>
          <div className="flex flex-wrap justify-center gap-2">
            {alsoLikes.map((code) => (
              <span key={code} className="rounded-full border border-midnight/15 bg-white px-3 py-1">
                {interestLabel(code, lang)}
              </span>
            ))}
          </div>
        </section>
      )}

      {!deleted && (
        <div className="space-y-3">
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-full bg-[#25d366] px-6 py-4 text-lg font-semibold text-midnight"
            >
              {t.match.whatsapp}
            </a>
          )}
          {match.other_instagram && (
            <a
              href={`https://instagram.com/${match.other_instagram.replace(/^@/, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-full bg-violet px-6 py-4 text-lg font-semibold text-white"
            >
              {t.match.instagram}
            </a>
          )}
        </div>
      )}

      <ReviewStatus t={t.me} lang={lang} createdAt={match.created_at} reviewed={match.reviewed_by_me} matchId={match.match_id} />
    </article>
  );
}
