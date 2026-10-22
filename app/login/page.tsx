import LoginForm from '@/components/LoginForm';
import { redirectIfLoggedIn } from '@/lib/auth';
import { getDict } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { safeNext } from '@/lib/next';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const goTo = safeNext(next);
  await redirectIfLoggedIn(goTo);
  const lang = await getLang();
  const t = getDict(lang);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{t.login.title}</h1>
        <p className="text-midnight/70">{t.login.subtitle}</p>
      </div>
      {(error === 'auth' || error === 'banned') && (
        <p role="alert" className="rounded-2xl bg-pink/40 p-4 text-sm">
          {error === 'banned' ? t.login.bannedError : t.login.authError}
        </p>
      )}
      <LoginForm t={t.login} lang={lang} next={goTo} />
    </div>
  );
}
