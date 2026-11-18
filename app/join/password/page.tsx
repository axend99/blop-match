import { redirect } from 'next/navigation';
import PasswordForm from '@/components/PasswordForm';
import { getMyParticipant, getUser } from '@/lib/auth';
import { getDict } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';

// The server action runs matching in after().
export const maxDuration = 60;

// v2, right after the profile: what the password game is, and the person's secret word.
export default async function PasswordPage() {
  if (!(await getUser())) redirect('/login');
  const me = await getMyParticipant();
  if (!me) redirect('/join');
  // v2 people without a password, and v1 people joining v2 (after reviewing their profile).
  if (me.password || !me.active) redirect('/me');
  const t = getDict(await getLang());
  const example = t.password.examples[Math.floor(Math.random() * t.password.examples.length)];

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">{t.password.title}</h1>
        <p className="text-lg text-midnight/80">{t.password.intro}</p>
      </div>
      <ol className="space-y-3 rounded-3xl bg-midnight p-6 text-white">
        {t.password.rules.map((rule, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet text-sm font-bold">{i + 1}</span>
            <span className="text-white/90">{rule}</span>
          </li>
        ))}
      </ol>
      <p className="rounded-2xl bg-lime/60 p-4 text-sm">{t.password.tip}</p>
      <PasswordForm
        t={{ label: t.password.label, placeholder: `${t.password.placeholder} ${example}`, error: t.password.error, submit: t.password.submit, showNameLabel: t.password.showNameLabel, showNameHint: t.password.showNameHint }}
        genericError={t.common.genericError}
      />
    </div>
  );
}
