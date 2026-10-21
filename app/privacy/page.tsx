import BackLink from '@/components/BackLink';
import { getDict } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';

export default async function PrivacyPage() {
  const t = getDict(await getLang());

  return (
    <article className="space-y-6">
      <BackLink t={t} />
      <h1 className="text-3xl font-bold">{t.privacy.title}</h1>
      {t.privacy.sections.map((section) => (
        <section key={section.heading} className="space-y-1">
          <h2 className="text-lg font-semibold">{section.heading}</h2>
          <p className="text-midnight/80">{section.body}</p>
        </section>
      ))}
    </article>
  );
}
