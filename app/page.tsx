import Link from 'next/link';
import { redirectIfLoggedIn } from '@/lib/auth';
import { getDict } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { reviewDelayDays } from '@/lib/site';

export default async function Home() {
  await redirectIfLoggedIn();
  const t = getDict(await getLang());
  // Twice: right under the headline (in view without scrolling on most phones) and at the end.
  const cta = (
    <Link
      href="/login"
      className="block rounded-full bg-violet px-6 py-4 text-center text-lg font-semibold text-white shadow-lg shadow-violet/30 active:scale-[0.98]"
    >
      {t.home.cta}
    </Link>
  );

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-midnight/60">{t.home.tagline}</p>
        <h1 className="text-4xl font-bold leading-tight">
          {t.home.title}
        </h1>
        <p className="text-lg text-midnight/70">{t.home.subtitle}</p>
      </section>

      {cta}

      <section className="space-y-4 rounded-3xl bg-midnight p-6 text-white">
        <h2 className="text-xl font-semibold">{t.home.howTitle}</h2>
        <ol className="space-y-3">
          {[...t.home.steps, t.home.review(reviewDelayDays())].map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet text-sm font-bold">
                {i + 1}
              </span>
              <span className="text-white/90">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-2 text-midnight/80">
        <p>{t.home.duration}</p>
        <p>
          {t.home.privacy}{' '}
          <Link href="/privacy" className="font-medium text-violet underline">
            {t.home.privacyLink}
          </Link>
        </p>
      </section>

      {cta}
    </div>
  );
}
