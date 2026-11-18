'use client';

import { useState, useTransition } from 'react';
import { savePassword } from '@/app/join/password/actions';
import { validatePassword } from '@/lib/password';

// Only plain strings can cross to a client component (the password dictionary also has functions).
export type PasswordFormTexts = {
  label: string;
  placeholder: string;
  error: string;
  submit: string;
  showNameLabel: string;
  showNameHint: string;
};

export default function PasswordForm({ t, genericError }: { t: PasswordFormTexts; genericError: string }) {
  const [value, setValue] = useState('');
  const [showName, setShowName] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!validatePassword(value).ok) return setError(t.error);
        setError(null);
        startTransition(async () => {
          const result = await savePassword(value, showName);
          if (result?.error) setError(result.error === 'invalid' ? t.error : genericError);
        });
      }}
    >
      <label className="block space-y-2">
        <span className="font-medium">{t.label}</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t.placeholder}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={20}
          aria-invalid={Boolean(error)}
          className="w-full rounded-2xl border border-midnight/15 bg-white px-4 py-3 text-lg"
        />
      </label>
      <label className="flex items-start gap-3 rounded-2xl bg-white p-4">
        <input
          type="checkbox"
          checked={showName}
          onChange={(e) => setShowName(e.target.checked)}
          className="mt-1 size-5 shrink-0 accent-violet"
        />
        <span className="space-y-1">
          <span className="block font-medium">{t.showNameLabel}</span>
          <span className="block text-sm text-midnight/70">{t.showNameHint}</span>
        </span>
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-violet px-6 py-4 text-lg font-semibold text-white shadow-lg shadow-violet/30 disabled:opacity-60"
      >
        {t.submit}
      </button>
    </form>
  );
}
