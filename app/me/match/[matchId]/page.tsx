import Image from 'next/image';
import Link from 'next/link';
import { NAV_BUTTON } from '@/lib/ui';
import { notFound, redirect } from 'next/navigation';
import Blop from '@/components/Blop';
import ContactButtons from '@/components/ContactButtons';
import ReviewStatus from '@/components/ReviewStatus';
import { getMyParticipant, getUser } from '@/lib/auth';
import { avatarCategory } from '@/lib/avatar';
import { whatsappLink, whatsappMessage, type Topic } from '@/lib/icebreaker';
import { getDict, interestLabel } from '@/lib/i18n';
import type { Dict } from '@/lib/i18n/en';
import { getLang } from '@/lib/i18n/server';
import { getMyMatches } from '@/lib/myMatches';
import GuessForm from '@/components/GuessForm';
import { loadGame } from '@/lib/gameService';
import thinking from '@/public/blop/thinking.webp';

// The match "cheat sheet": who they are and what you have in common.
export default async function MatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  // Back here after signing in (e.g. a link opened from an e-mail in another browser).
  if (!(await getUser())) redirect(`/login?next=/me/match/${encodeURIComponent(matchId)}`);
  const me = await getMyParticipant();
  if (!me) redirect('/join');
  const match = (await getMyMatches()).find((m) => m.match_id === matchId);
  if (!match) notFound();

  const lang = await getLang();
  const t = getDict(lang);
  const game = me.cohort === 'v2' ? ((await loadGame(me.id)).matches.get(match.match_id) ?? null) : null;
  const quoted = (words: string[]) => words.map((w) => `“${w}”`).join(', ');
  const deleted = match.other_deleted;
  const name = deleted ? t.me.formerParticipant : match.other_name;
  const shared = new Set(match.shared_items);
  const alsoLikes = match.other_interests.filter((code) => !shared.has(code));
  // Exact age; profiles created before ages were asked only have the band.
  const age =
    match.other_age ??
    (match.other_age_range ? t.join.ageOptions[match.other_age_range as keyof Dict['join']['ageOptions']] : null);
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
      <div className="text-left">
        <Link href="/me" className={NAV_BUTTON}>
          ← {t.match.back}
        </Link>
      </div>

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
        <ContactButtons
          matchId={match.match_id}
          whatsapp={whatsapp || null}
          instagram={match.other_instagram ? `https://instagram.com/${match.other_instagram.replace(/^@/, '')}` : null}
          labels={{ whatsapp: t.match.whatsapp, instagram: t.match.instagram }}
        />
      )}

      <ReviewStatus t={t.me} lang={lang} createdAt={match.created_at} reviewed={match.reviewed_by_me} matchId={match.match_id} />

      {game && (
        <section className="space-y-3 rounded-3xl bg-lime/50 p-5 text-left">
          <h2 className="text-center text-lg font-semibold">🤫 {t.password.revealTitle}</h2>
          {game.hints && !game.theirPassword && (
            <p className="rounded-2xl bg-white p-3">
              <span className="font-semibold">{t.password.cluesTitle}:</span> {t.password.letters(game.hints.letters)}
              {game.hints.kind && ` · ${t.password.kinds[game.hints.kind] ?? game.hints.kind}`}
            </p>
          )}
          {!deleted && game.guessesLeft > 0 && (
            <GuessForm
              matchId={match.match_id}
              t={{
                prompt: t.password.guessPrompt(name),
                left: t.password.guessesLeft(game.guessesLeft),
                placeholder: t.password.guessPlaceholder,
                submit: t.password.guessSubmit,
                right: t.password.guessRight,
                wrong: [0, 1, 2].map((left) => t.password.guessWrong(left)),
                repeat: t.password.guessRepeat,
                invalid: t.password.guessInvalid,
                error: t.common.genericError,
              }}
            />
          )}
          {game.myGuesses.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-semibold">{t.password.myGuessesTitle}</p>
              <ul className="flex flex-wrap gap-2">
                {game.myGuesses.map((g, i) => (
                  <li key={i} className={`rounded-full px-3 py-1 ${g.right ? 'bg-violet text-white' : 'bg-white'}`}>
                    {g.right ? '✅' : '❌'} {g.guess}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {game.found && <p className="font-semibold">{t.password.foundIt(game.myGuesses.find((g) => g.right)!.guess)}</p>}
          {game.theirPassword && !game.found && <p className="font-semibold">{t.password.theirPassword(name, game.theirPassword)}</p>}
          {!game.iReviewed
            ? game.theirGuessCount > 0 && <p className="rounded-2xl bg-white p-3 font-medium">{t.password.theyTried(name)}</p>
            : (() => {
                const theirs = game.theirGuesses ?? [];
                const right = theirs.find((g) => g.right);
                const words = quoted(theirs.map((g) => g.guess));
                return (
                  <p className="rounded-2xl bg-white p-3">
                    {right
                      ? t.password.theirGuessRight(name, right.guess)
                      : theirs.length === 0
                        ? t.password.theirGuessNone(name)
                        : game.theyCanStillGuess
                          ? t.password.theirGuessSoFar(name, words)
                          : t.password.theirGuessWrong(name, words)}
                  </p>
                );
              })()}
        </section>
      )}

      {!deleted && (
        <Link href={`/me/report/${match.match_id}`} className="block text-sm text-midnight/50 underline">
          {t.report.link}
        </Link>
      )}
    </article>
  );
}
