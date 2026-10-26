import Link from 'next/link';
import { NAV_BUTTON } from '@/lib/ui';
import { redirect } from 'next/navigation';
import Blop from '@/components/Blop';
import { getMyParticipant, getUser } from '@/lib/auth';
import { avatarCategory } from '@/lib/avatar';
import { getDict, interestLabel, type Lang } from '@/lib/i18n';
import type { Dict } from '@/lib/i18n/en';
import { getLang } from '@/lib/i18n/server';
import { CATEGORIES, interestByCode } from '@/lib/interests';
import { createClient } from '@/lib/supabase/server';

// The participant's own profile, read-only (it cannot be edited during the study).
export default async function ProfilePage() {
  if (!(await getUser())) redirect('/login?next=/me/profile');
  if (!(await getMyParticipant())) redirect('/join');
  const lang = await getLang();
  const t = getDict(lang);

  // RLS: a participant can only read their own row.
  const { data: me } = await (await createClient())
    .from('participants')
    .select('name, email, whatsapp, instagram, city, lang, age, age_range, time_in_city, origin, interests, other_text, talk_about, talk_about_code')
    .maybeSingle();
  if (!me) redirect('/join');

  const j = t.join;
  const other = (me.other_text ?? {}) as Record<string, string>;
  const rows: [string, string][] = [
    [t.profile.email, me.email ?? '—'],
    [j.whatsapp, me.whatsapp ?? '—'],
    [j.instagram.replace(/\s*\(.*\)$/, ''), me.instagram ? `@${me.instagram}` : t.profile.notGiven],
    [j.city, me.city],
    [j.age, me.age ? String(me.age) : (j.ageOptions[me.age_range as keyof Dict['join']['ageOptions']] ?? me.age_range)],
    [j.timeInCity, j.timeInCityOptions[me.time_in_city as keyof Dict['join']['timeInCityOptions']] ?? me.time_in_city],
    [j.origin, j.originOptions[me.origin as keyof Dict['join']['originOptions']] ?? me.origin],
    [t.profile.language, t.profile.languages[me.lang as Lang] ?? me.lang],
  ];
  const talksAbout = me.talk_about_code ? interestLabel(me.talk_about_code, lang) : me.talk_about;

  return (
    <article className="space-y-6">
      <Link href="/me" className={NAV_BUTTON}>
        ← {t.match.back}
      </Link>
      <div className="flex items-center gap-4">
        <Blop variant={avatarCategory(me.interests)} label={t.avatarAlt(me.name)} className="size-24 shrink-0" />
        <div>
          <h1 className="text-3xl font-bold">{t.profile.title}</h1>
          <p className="text-lg">{me.name}</p>
        </div>
      </div>
      <p className="text-midnight/70">{t.profile.intro}</p>

      <dl className="divide-y divide-midnight/10 rounded-3xl bg-white px-5">
        {rows.map(([label, value]) => (
          <div key={label} className="py-3">
            <dt className="text-sm text-midnight/60">{label}</dt>
            <dd className="break-words text-lg">{value}</dd>
          </div>
        ))}
      </dl>

      {talksAbout && (
        <section className="space-y-1 rounded-3xl bg-lime/60 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide">{j.talkAbout}</h2>
          <p className="break-words text-lg">{talksAbout}</p>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">{j.interestsTitle}</h2>
        {CATEGORIES.map((category) => {
          const codes = me.interests.filter((code: string) => interestByCode(code)?.category === category);
          if (codes.length === 0 && !other[category]) return null; // categories can stay empty
          return (
            <div key={category} className="space-y-2">
              <h3 className="font-semibold">{j.categories[category]}</h3>
              <div className="flex flex-wrap gap-2">
                {codes.map((code: string) => (
                  <span key={code} className="rounded-full border border-midnight/15 bg-white px-3 py-1">
                    {interestLabel(code, lang)}
                  </span>
                ))}
              </div>
              {other[category] && (
                <p className="break-words text-sm text-midnight/70">
                  {t.profile.other}: {other[category]}
                </p>
              )}
            </div>
          );
        })}
      </section>

      <p className="rounded-2xl bg-paper p-4 text-sm text-midnight/70">{t.profile.readOnly}</p>
    </article>
  );
}
