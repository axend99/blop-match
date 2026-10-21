import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import Blop from '@/components/Blop';
import ReviewStatus from '@/components/ReviewStatus';
import { getMyParticipant, getUser } from '@/lib/auth';
import { avatarCategory } from '@/lib/avatar';
import { getDict, interestLabel } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { getMyMatches } from '@/lib/myMatches';
import looking from '@/public/blop/looking.webp';

export default async function MePage() {
  if (!(await getUser())) redirect('/login');
  const me = await getMyParticipant();
  if (!me) redirect('/join');
  const lang = await getLang();
  const t = getDict(lang);
  const matches = await getMyMatches();

  return (
    <div className="space-y-8">
      <section className="flex items-center gap-4">
        <Blop variant={avatarCategory(me.interests)} label={t.avatarAlt(me.name)} className="size-24 shrink-0" />
        <h1 className="text-3xl font-bold">{t.me.title(me.name)}</h1>
      </section>

      {!me.active && <p className="rounded-2xl bg-pink/40 p-4 text-sm">{t.me.leftNotice}</p>}

      {matches.length === 0 ? (
        <section className="space-y-3 rounded-3xl bg-white p-6 text-center">
          <Image src={looking} alt="" className="mx-auto w-48" priority />
          <h2 className="text-xl font-semibold">{t.me.lookingTitle}</h2>
          <p className="text-midnight/70">{t.me.noMatches}</p>
        </section>
      ) : (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t.me.matchesTitle}</h2>
          <ul className="space-y-3">
            {matches.map((m) => {
              const name = m.other_deleted ? t.me.formerParticipant : m.other_name;
              return (
                <li key={m.match_id}>
                  <Link
                    href={`/me/match/${m.match_id}`}
                    className="flex gap-4 rounded-3xl bg-white p-4 shadow-sm active:scale-[0.99]"
                  >
                    <Blop variant={avatarCategory(m.other_interests)} className="size-20 shrink-0" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-lg font-semibold">{name}</span>
                        <span aria-hidden="true" className="text-xl text-midnight/40">›</span>
                      </div>
                      {m.other_deleted ? null : m.shared_items.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          <span className="sr-only">{t.me.youBothLike}</span>
                          {m.shared_items.slice(0, 3).map((code) => (
                            <span key={code} className="rounded-full bg-pink/50 px-2.5 py-0.5 text-sm">
                              {interestLabel(code, lang)}
                            </span>
                          ))}
                          {m.shared_items.length > 3 && (
                            <span className="px-1 py-0.5 text-sm text-midnight/60">+{m.shared_items.length - 3}</span>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-midnight/70">{t.me.getToKnow}</p>
                      )}
                      <ReviewStatus t={t.me} lang={lang} createdAt={m.created_at} reviewed={m.reviewed_by_me} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

    </div>
  );
}
