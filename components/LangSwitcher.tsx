'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { LANGS, type Lang } from '@/lib/i18n';
import { setLang } from '@/lib/i18n/server';

export default function LangSwitcher({ current, label }: { current: Lang; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div role="group" aria-label={label} className="flex rounded-full border border-midnight/20 bg-white p-0.5 text-sm">
      {LANGS.map((lang) => (
        <button
          key={lang}
          type="button"
          disabled={pending}
          aria-pressed={lang === current}
          onClick={() =>
            startTransition(async () => {
              await setLang(lang);
              router.refresh();
            })
          }
          className={`min-w-11 rounded-full px-3 py-1.5 font-medium uppercase ${
            lang === current ? 'bg-midnight text-white' : 'text-midnight/70'
          }`}
        >
          {lang}
        </button>
      ))}
    </div>
  );
}
