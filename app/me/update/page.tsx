import { redirect } from 'next/navigation';
import JoinForm, { type InitialProfile } from '@/components/JoinForm';
import { getMyParticipant, getUser } from '@/lib/auth';
import { getDict } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { countryList } from '@/lib/phone';
import { createClient } from '@/lib/supabase/server';

// v1 → v2: the person reviews their saved profile before choosing a password (same form as joining).
export default async function UpdateProfilePage() {
  if (!(await getUser())) redirect('/login?next=/me/update');
  const me = await getMyParticipant();
  if (!me) redirect('/join');
  if (me.cohort !== 'v1') redirect('/me');
  const lang = await getLang();
  const t = getDict(lang);
  // RLS: own row only.
  const { data: profile } = await (await createClient())
    .from('participants')
    .select('name, whatsapp, instagram, city, age, time_in_city, origin, gender, match_lang, interests, other_text, talk_about, talk_about_code')
    .maybeSingle();
  if (!profile) redirect('/me');

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{t.upgrade.profileTitle}</h1>
        <p className="text-midnight/70">{t.upgrade.profileIntro}</p>
      </div>
      <JoinForm t={t.join} lang={lang} genericError={t.common.genericError} countries={countryList(lang)} initial={profile as InitialProfile} />
    </div>
  );
}
