'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { saveExperience } from '@/app/me/experience/actions';
import Scale from '@/components/Scale';
import { BEST_FOR, MAX_COMMENT, PARTY, PERSONALITY, type ExperienceErrors, type ExperienceField } from '@/lib/review';

// Only plain strings cross to this client component.
export type ExperienceFormTexts = {
  likesConcept: string;
  yes: string;
  no: string;
  bestFor: string;
  bestForOptions: Record<(typeof BEST_FOR)[number], string>;
  personality: string;
  personalityOptions: Record<(typeof PERSONALITY)[number], string>;
  party: string;
  partyOptions: Record<(typeof PARTY)[number], string>;
  gameFun: string | null; // v2 only
  notAtAll: string;
  veryMuch: string;
  comment: string;
  required: string;
  tooLong: string;
  submit: string;
  submitting: string;
  skip: string;
};

export default function ExperienceForm({ t, genericError }: { t: ExperienceFormTexts; genericError: string }) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<ExperienceErrors>({});
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const set = (field: ExperienceField) => (value: unknown) => {
    setAnswers((a) => ({ ...a, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const question = (field: ExperienceField, label: string, control: React.ReactNode) => (
    <fieldset key={field} aria-invalid={Boolean(errors[field])} className="space-y-3 rounded-3xl bg-white p-5">
      <legend className="float-left mb-3 w-full text-lg font-semibold">{label}</legend>
      <div className="clear-both">{control}</div>
      {errors[field] && <p className="text-sm text-red-700">{errors[field] === 'tooLong' ? t.tooLong : t.required}</p>}
    </fieldset>
  );
  const choice = <V extends string | boolean>(field: ExperienceField, options: [V, string][]) => (
    <div className={`grid gap-2 ${options.length === 2 ? 'grid-cols-2' : ''}`}>
      {options.map(([value, label]) => (
        <label
          key={String(value)}
          className={`cursor-pointer rounded-2xl border px-4 py-3 text-center text-lg font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet/50 ${
            answers[field] === value ? 'border-violet bg-violet text-white' : 'border-midnight/15 bg-white'
          }`}
        >
          <input type="radio" name={field} checked={answers[field] === value} onChange={() => set(field)(value)} className="sr-only" />
          {label}
        </label>
      ))}
    </div>
  );

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setFailed(false);
        startTransition(async () => {
          const result = await saveExperience(answers);
          if (result?.errors) setErrors(result.errors);
          if (result?.failed) setFailed(true);
        });
      }}
    >
      {question('likes_concept', t.likesConcept, choice<boolean>('likes_concept', [[true, t.yes], [false, t.no]]))}
      {question('best_for', t.bestFor, choice('best_for', BEST_FOR.map((v) => [v, t.bestForOptions[v]])))}
      {question('personality', t.personality, choice('personality', PERSONALITY.map((v) => [v, t.personalityOptions[v]])))}
      {question('party_interest', t.party, choice('party_interest', PARTY.map((v) => [v, t.partyOptions[v]])))}
      {t.gameFun &&
        question(
          'game_fun_1_7',
          t.gameFun,
          <Scale name="game_fun_1_7" value={answers.game_fun_1_7 as number | undefined} onChange={set('game_fun_1_7')} low={t.notAtAll} high={t.veryMuch} />,
        )}
      {question(
        'comment',
        t.comment,
        <textarea
          rows={3}
          maxLength={MAX_COMMENT}
          value={(answers.comment as string) ?? ''}
          onChange={(e) => set('comment')(e.target.value)}
          className="w-full rounded-2xl border border-midnight/15 bg-white px-4 py-3 text-base outline-none focus:border-violet focus:ring-2 focus:ring-violet/30"
        />,
      )}
      {failed && (
        <p role="alert" className="rounded-2xl bg-pink/40 p-4 text-sm">
          {genericError}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-violet px-6 py-4 text-lg font-semibold text-white shadow-lg shadow-violet/30 disabled:opacity-60"
      >
        {pending ? t.submitting : t.submit}
      </button>
      <Link href="/me" className="block text-center text-sm text-midnight/60 underline">
        {t.skip}
      </Link>
    </form>
  );
}
