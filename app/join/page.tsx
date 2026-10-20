import { redirect } from 'next/navigation';
import JoinForm from '@/components/JoinForm';
import { getMyParticipant, getUser } from '@/lib/auth';
import { getDict } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';

// The server action also runs matching and sends emails in after().
export const maxDuration = 60;

export default async function JoinPage() {
  if (!(await getUser())) redirect('/login');
  if (await getMyParticipant()) redirect('/me');
  const lang = await getLang();
  const t = getDict(lang);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{t.join.title}</h1>
        <p className="text-midnight/70">{t.join.subtitle}</p>
      </div>
      <JoinForm t={t.join} lang={lang} genericError={t.common.genericError} />
    </div>
  );
}
