import LoginForm from '@/components/LoginForm';
import { redirectIfLoggedIn } from '@/lib/auth';
import { getDict } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await redirectIfLoggedIn();
  const t = getDict(await getLang());
  const { error } = await searchParams;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{t.login.title}</h1>
        <p className="text-midnight/70">{t.login.subtitle}</p>
      </div>
      {error === 'auth' && (
        <p role="alert" className="rounded-2xl bg-pink/40 p-4 text-sm">
          {t.login.authError}
        </p>
      )}
      <LoginForm t={t.login} />
    </div>
  );
}
