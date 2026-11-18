import Link from 'next/link';
import { redirect } from 'next/navigation';
import Blop from '@/components/Blop';
import { getMyParticipant, getUser } from '@/lib/auth';
import { getDict } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';

// v1 → v2: what's new, shown to v1 people when they come back. Next: review the profile, then
// the password, which moves them to v2.
export default async function WhatsNewPage() {
  if (!(await getUser())) redirect('/login?next=/me/whats-new');
  const me = await getMyParticipant();
  if (!me) redirect('/join');
  if (me.cohort !== 'v1') redirect('/me');
  const t = getDict(await getLang());
  const u = t.upgrade;

  return (
    <article className="space-y-6">
      <Blop variant={null} label="" className="mx-auto w-40" />
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">{u.title}</h1>
        <p className="text-lg text-midnight/80">{u.intro}</p>
      </div>
      <ul className="space-y-3">
        {u.news.map((item, i) => (
          <li key={i} className="rounded-3xl bg-white p-5 text-midnight/90">
            {item}
          </li>
        ))}
      </ul>
      <p className="text-sm text-midnight/70">{u.oldMatches}</p>
      <div className="space-y-3">
        <Link
          href="/me/update"
          className="block w-full rounded-full bg-violet px-6 py-4 text-center text-lg font-semibold text-white shadow-lg shadow-violet/30 active:scale-[0.98]"
        >
          {u.cta}
        </Link>
        <Link href="/me?old=1" className="block text-center text-sm text-midnight/60 underline">
          {u.later}
        </Link>
      </div>
    </article>
  );
}
