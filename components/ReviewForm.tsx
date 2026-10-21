'use client';

import { useRef, useState, useTransition } from 'react';
import { submitReview } from '@/app/me/review/[matchId]/actions';
import Scale from '@/components/Scale';
import type { Dict } from '@/lib/i18n/en';
import { MAX_COMMENT, MET, WHO_FIRST, WHY_NOT, validateReview, type ReviewErrors, type ReviewField } from '@/lib/review';

// Only plain strings can cross to a client component.
export type ReviewFormTexts = Omit<Dict['review'], 'title' | 'opensOn'>;
type T = ReviewFormTexts;
type Answers = Record<string, unknown>;

// One screen; follow-up questions appear according to the answers (SPEC §7).
export default function ReviewForm({ matchId, t, genericError }: { matchId: string; t: T; genericError: string }) {
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<ReviewErrors>({});
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // Answering a question clears its error; errors of questions that get hidden go too.
  const set = (field: ReviewField) => (value: unknown) => {
    setAnswers((a) => ({ ...a, [field]: value }));
    setErrors((e) => (field === 'contacted' || field === 'talked' ? {} : { ...e, [field]: undefined }));
  };

  function showErrors(next: ReviewErrors) {
    setErrors(next);
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setFailed(false);
    const check = validateReview(answers);
    if (!check.ok) {
      showErrors(check.errors);
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await submitReview(matchId, answers);
      if (result?.errors) showErrors(result.errors);
      if (result?.failed) setFailed(true);
    });
  }

  const question = (field: ReviewField, label: string, control: React.ReactNode) => (
    <fieldset
      key={field}
      tabIndex={-1}
      aria-invalid={Boolean(errors[field])}
      aria-describedby={errors[field] ? `err-${field}` : undefined}
      className="space-y-3 rounded-3xl bg-white p-5 outline-none"
    >
      <legend id={`q-${field}`} className="float-left mb-3 w-full text-lg font-semibold">
        {label}
      </legend>
      <div className="clear-both">{control}</div>
      {errors[field] && (
        <p id={`err-${field}`} className="text-sm text-red-700">
          {t.errors[errors[field]!]}
        </p>
      )}
    </fieldset>
  );

  const choice = <V extends string | boolean>(field: ReviewField, options: [V, string][]) => (
    <div className={`grid gap-2 ${options.length === 2 ? 'grid-cols-2' : ''}`}>
      {options.map(([value, label]) => (
        <label
          key={String(value)}
          className={`cursor-pointer rounded-2xl border px-4 py-3 text-center text-lg font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet/50 ${
            answers[field] === value ? 'border-violet bg-violet text-white' : 'border-midnight/15 bg-white'
          }`}
        >
          <input
            type="radio"
            name={field}
            checked={answers[field] === value}
            onChange={() => set(field)(value)}
            className="sr-only"
          />
          {label}
        </label>
      ))}
    </div>
  );

  const yesNo = (field: ReviewField) =>
    choice<boolean>(field, [
      [true, t.yes],
      [false, t.no],
    ]);

  const scale = (field: ReviewField) => (
    <Scale name={field} value={answers[field] as number | undefined} onChange={set(field)} low={t.notAtAll} high={t.veryMuch} />
  );

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="space-y-4">
      {question('contacted', t.contacted, yesNo('contacted'))}
      {question('interest_1_7', t.interest, scale('interest_1_7'))}

      {answers.contacted === true && (
        <>
          {question('who_first', t.whoFirst, choice('who_first', WHO_FIRST.map((v) => [v, t.whoFirstOptions[v]])))}
          {question('comfort_1_7', t.comfort, scale('comfort_1_7'))}
          {question('talked', t.talked, yesNo('talked'))}
        </>
      )}

      {answers.contacted === false &&
        question('why_not', t.whyNot, choice('why_not', WHY_NOT.map((v) => [v, t.whyNotOptions[v]])))}

      {answers.contacted === true && answers.talked === true && (
        <>
          {question('flow_1_7', t.flow, scale('flow_1_7'))}
          {question('common_ground_1_7', t.commonGround, scale('common_ground_1_7'))}
          {question('satisfaction_1_7', t.satisfaction, scale('satisfaction_1_7'))}
          {question('meet_again_1_7', t.meetAgain, scale('meet_again_1_7'))}
          {question('met', t.met, choice('met', MET.map((v) => [v, t.metOptions[v]])))}
        </>
      )}

      {question(
        'comment',
        t.comment,
        <textarea
          aria-labelledby="q-comment"
          rows={3}
          maxLength={MAX_COMMENT}
          value={(answers.comment as string) ?? ''}
          onChange={(e) => set('comment')(e.target.value)}
          className="w-full rounded-2xl border border-midnight/15 bg-white px-4 py-3 text-base outline-none focus:border-violet focus:ring-2 focus:ring-violet/30"
        />,
      )}

      {(Object.values(errors).some(Boolean) || failed) && (
        <p role="alert" className="rounded-2xl bg-pink/40 p-4 text-sm">
          {failed ? genericError : t.fixErrors}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-violet px-6 py-4 text-lg font-semibold text-white shadow-lg shadow-violet/30 disabled:opacity-60"
      >
        {pending ? t.submitting : t.submit}
      </button>
    </form>
  );
}
