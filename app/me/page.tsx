import { redirect } from 'next/navigation';
import SignOutButton from '@/components/SignOutButton';
import { getMyParticipant, getUser } from '@/lib/auth';
import { getDict } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';

// Minimal page for Phase 2; Phase 3 adds the match list and "Leave the study".
export default async function MePage() {
  if (!(await getUser())) redirect('/login');
  const me = await getMyParticipant();
  if (!me) redirect('/join');
  const t = getDict(await getLang());

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t.me.title(me.name)}</h1>
      <p className="rounded-3xl bg-white p-6 text-lg text-midnight/80">{t.me.noMatches}</p>
      <div className="flex justify-center">
        <SignOutButton label={t.common.signOut} />
      </div>
    </div>
  );
}
