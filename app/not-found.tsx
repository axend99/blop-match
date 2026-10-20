import Image from 'next/image';
import Link from 'next/link';
import { getDict } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import thinking from '@/public/blop/thinking.webp';

export default async function NotFound() {
  const t = getDict(await getLang());

  return (
    <section className="space-y-4 text-center">
      <Image src={thinking} alt="" className="mx-auto w-48" />
      <h1 className="text-2xl font-bold">{t.notFound.title}</h1>
      <Link href="/" className="inline-block rounded-full bg-violet px-6 py-3 font-semibold text-white">
        {t.notFound.back}
      </Link>
    </section>
  );
}
