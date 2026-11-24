'use client';

import { useState } from 'react';

// Invite a friend: the person's link, shared on WhatsApp or copied. Plain strings only.
export type InviteTexts = { title: string; body: string; points: string; whatsapp: string; copy: string; copied: string };

export default function InviteCard({ link, whatsappHref, t }: { link: string; whatsappHref: string; t: InviteTexts }) {
  const [copied, setCopied] = useState(false);
  return (
    <section id="invite" className="scroll-mt-4 space-y-3 rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">{t.title}</h2>
      <p className="text-midnight/80">{t.body}</p>
      <p className="rounded-2xl bg-lime/50 p-3 text-sm font-medium">{t.points}</p>
      <p className="break-all rounded-2xl bg-paper px-3 py-2 text-sm text-midnight/70">{link}</p>
      <div className="flex flex-wrap gap-2">
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-full bg-violet px-5 py-3 font-semibold text-white active:scale-[0.98]"
        >
          {t.whatsapp}
        </a>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
          className="rounded-full border border-violet/40 bg-white px-5 py-3 font-semibold text-violet active:scale-[0.98]"
        >
          {copied ? t.copied : t.copy}
        </button>
      </div>
    </section>
  );
}
