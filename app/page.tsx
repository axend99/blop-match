import { getDict } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';

export default async function Home() {
  const t = getDict(await getLang());

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold leading-tight">{t.home.title}</h1>
      <p className="text-lg text-neutral-600">{t.home.subtitle}</p>
    </section>
  );
}
