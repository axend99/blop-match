import Link from 'next/link';
import BackLink from '@/components/BackLink';
import LeaveStudy from '@/components/LeaveStudy';
import { getMyParticipant, getUser } from '@/lib/auth';
import { getDict } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { reviewDelayDays } from '@/lib/site';

// About the study. "Leave the study" lives here, small and at the very end, so it doesn't
// look like a step of the normal flow.
export default async function AboutPage() {
  const t = getDict(await getLang());
  const me = (await getUser()) ? await getMyParticipant() : null;

  return (
    <article className="space-y-6">
      <BackLink t={t} />
      <h1 className="text-3xl font-bold">{t.about.title}</h1>

      <section className="space-y-1">
        <h2 className="text-lg font-semibold">{t.about.whatTitle}</h2>
        <p className="text-midnight/80">{t.about.what}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t.about.howTitle}</h2>
        <ol className="list-decimal space-y-1 pl-5 text-midnight/80">
          {[...t.home.steps, t.home.review(reviewDelayDays())].map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="space-y-1">
        <h2 className="text-lg font-semibold">{t.about.durationTitle}</h2>
        <p className="text-midnight/80">{t.home.duration}</p>
      </section>

      <section className="space-y-1">
        <h2 className="text-lg font-semibold">{t.about.privacyTitle}</h2>
        <p className="text-midnight/80">
          {t.home.privacy}{' '}
          <Link href="/privacy" className="font-medium text-violet underline">
            {t.home.privacyLink}
          </Link>
        </p>
      </section>

      <section className="space-y-1">
        <h2 className="text-lg font-semibold">{t.about.contactTitle}</h2>
        <p className="text-midnight/80">{t.about.contact}</p>
      </section>

      {me && (
        <div className="flex justify-center pt-10">
          {me.active ? (
            <LeaveStudy t={t.leave} errorText={t.common.genericError} />
          ) : (
            <p className="text-sm text-midnight/60">{t.me.leftNotice}</p>
          )}
        </div>
      )}
    </article>
  );
}
