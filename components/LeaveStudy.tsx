'use client';

import { useState, useTransition } from 'react';
import { leaveStudy } from '@/app/me/actions';
import type { Dict } from '@/lib/i18n/en';

export default function LeaveStudy({ t }: { t: Dict['leave'] }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="text-sm font-medium text-midnight/60 underline">
        {t.button}
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-3xl bg-white p-5 text-center">
      <p>{t.confirm}</p>
      <div className="flex gap-2">
        <button type="button" onClick={() => setConfirming(false)} className="flex-1 rounded-full border border-midnight/15 px-4 py-3 font-medium">
          {t.cancel}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => leaveStudy())}
          className="flex-1 rounded-full bg-midnight px-4 py-3 font-semibold text-white disabled:opacity-60"
        >
          {t.yes}
        </button>
      </div>
    </div>
  );
}
