'use client';

import { useState, useTransition } from 'react';
import { guessPassword } from '@/app/me/match/[matchId]/actions';
import { GUESS_MAX } from '@/lib/password';

// Only plain strings cross to this client component.
export type GuessFormTexts = {
  prompt: string;
  left: string;
  placeholder: string;
  submit: string;
  saved: string;
  repeat: string;
  invalid: string;
  error: string;
};

export default function GuessForm({ matchId, t }: { matchId: string; t: GuessFormTexts }) {
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-2 text-left"
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) return setMessage({ ok: false, text: t.invalid });
        startTransition(async () => {
          const result = await guessPassword(matchId, value);
          if (result.saved) {
            setValue('');
            setMessage({ ok: true, text: t.saved });
          } else {
            setMessage({ ok: false, text: result.error === 'repeat' ? t.repeat : result.error === 'invalid' ? t.invalid : t.error });
          }
        });
      }}
    >
      <label htmlFor="guess" className="block font-semibold">
        {t.prompt}
      </label>
      <div className="flex gap-2">
        <input
          id="guess"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t.placeholder}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={GUESS_MAX}
          className="min-w-0 flex-1 rounded-2xl border border-midnight/15 bg-white px-4 py-3 text-lg"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-full bg-violet px-5 py-3 font-semibold text-white disabled:opacity-60"
        >
          {t.submit}
        </button>
      </div>
      <p className="text-sm text-midnight/70">{t.left}</p>
      {message && (
        <p role={message.ok ? 'status' : 'alert'} className={message.ok ? 'text-sm font-medium text-midnight' : 'text-sm text-red-700'}>
          {message.text}
        </p>
      )}
    </form>
  );
}
