'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { createProfile } from '@/app/join/actions';
import { interestLabel, type Lang } from '@/lib/i18n';
import type { Dict } from '@/lib/i18n/en';
import { CATEGORIES, MAX_PER_CATEGORY, MIN_CATEGORIES, MIN_TOTAL, interestsByCategory, type Category } from '@/lib/interests';
import {
  MAX_CITY,
  MAX_NAME,
  MAX_OTHER,
  MAX_TALK_ABOUT,
  ORIGINS,
  TIMES_IN_CITY,
  countByCategory,
  validateProfile,
  type FieldErrors,
} from '@/lib/profile';
import { formatNational, splitInternational, toWhatsapp, type Country } from '@/lib/phone';

type T = Dict['join'];

const inputClass =
  'w-full rounded-2xl border bg-white px-4 py-3 text-lg outline-none focus:border-violet focus:ring-2 focus:ring-violet/30';

export default function JoinForm({
  t,
  lang,
  genericError,
  countries,
}: {
  t: T;
  lang: Lang;
  genericError: string;
  countries: Country[];
}) {
  const [name, setName] = useState('');
  const [country, setCountry] = useState<string>(countries[0]?.code ?? 'PT');
  const [phone, setPhone] = useState('');
  const [instagram, setInstagram] = useState('');
  const [city, setCity] = useState('');
  const [age, setAge] = useState('');
  const [timeInCity, setTimeInCity] = useState('');
  const [origin, setOrigin] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [otherText, setOtherText] = useState<Partial<Record<Category, string>>>({});
  const [otherOpen, setOtherOpen] = useState<Partial<Record<Category, boolean>>>({});
  const [talkAbout, setTalkAbout] = useState('');
  const [talkAboutCode, setTalkAboutCode] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const counts = countByCategory(interests);
  const usedCategories = CATEGORIES.filter((c) => counts[c] > 0).length;
  const enough = interests.length >= MIN_TOTAL && usedCategories >= MIN_CATEGORIES;
  const current = countries.find((c) => c.code === country) ?? countries[0];
  const dial = current?.dial ?? '';

  // Formats while typing; deleting keeps the raw text, so a space can be erased. A pasted
  // "+55…" or "0055…" number switches the country.
  function typePhone(value: string) {
    const intl = splitInternational(value);
    if (intl && countries.some((c) => c.code === intl.country)) {
      setCountry(intl.country);
      setPhone(formatNational(intl.national, intl.country));
    } else {
      setPhone(value.length > phone.length ? formatNational(value, country) : value);
    }
  }

  function changeCountry(code: string) {
    setCountry(code);
    setPhone(formatNational(phone.replace(/\D/g, ''), code));
  }

  function toggle(code: string, category: Category) {
    if (interests.includes(code)) {
      if (code === talkAboutCode) setTalkAboutCode(''); // can only talk about an own interest
      setInterests(interests.filter((c) => c !== code));
    } else if (counts[category] < MAX_PER_CATEGORY) {
      setInterests([...interests, code]);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setFailed(false);
    // Sent in international form; an invalid number keeps the typed text so the error shows.
    const whatsapp = toWhatsapp(phone, country) ?? (phone.trim() ? `+${dial}${phone.replace(/\D/g, '')}` : '');
    const input = {
      name,
      whatsapp,
      instagram,
      city,
      age,
      time_in_city: timeInCity,
      origin,
      interests,
      other_text: otherText,
      talk_about: talkAbout,
      talk_about_code: talkAboutCode,
      consent,
    };
    const check = validateProfile({ ...input, lang });
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await createProfile(input);
      if (result?.errors) setErrors(result.errors);
      if (result?.failed) setFailed(true);
    });
  }

  const err = (field: keyof FieldErrors) =>
    errors[field] ? (
      <p role="alert" className="text-sm text-red-700">
        {t.errors[errors[field]!]}
      </p>
    ) : null;
  const border = (field: keyof FieldErrors) => (errors[field] ? 'border-red-600' : 'border-midnight/15');
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      <div className="space-y-5">
        <Field id="name" label={t.name}>
          <input id="name" value={name} maxLength={MAX_NAME} autoComplete="given-name"
            onChange={(e) => setName(e.target.value)} className={`${inputClass} ${border('name')}`} />
          {err('name')}
        </Field>
        <Field id="whatsapp" label={t.whatsapp} hint={t.whatsappHint}>
          <div className="flex gap-2">
            {/* Native select (good on phones) under a compact "flag +code" face. */}
            <div className={`relative flex w-28 shrink-0 items-center justify-center rounded-2xl border bg-white text-lg focus-within:border-violet focus-within:ring-2 focus-within:ring-violet/30 ${border('whatsapp')}`}>
              <span aria-hidden="true">{current ? `${current.label.split(' ')[0]} +${dial}` : ''}</span>
              <select aria-label={t.whatsappCountry} value={country} onChange={(e) => changeCountry(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0">
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>
            <input id="whatsapp" type="tel" inputMode="tel" autoComplete="tel-national" value={phone}
              onChange={(e) => typePhone(e.target.value)} className={`${inputClass} min-w-0 ${border('whatsapp')}`} />
          </div>
          {err('whatsapp')}
        </Field>
        <Field id="instagram" label={t.instagram} hint={t.instagramHint}>
          <input id="instagram" value={instagram} autoCapitalize="none" autoCorrect="off" spellCheck={false}
            onChange={(e) => setInstagram(e.target.value)} className={`${inputClass} ${border('instagram')}`} />
          {err('instagram')}
        </Field>
        <Field id="city" label={t.city}>
          <input id="city" value={city} maxLength={MAX_CITY} placeholder={t.cityPlaceholder} autoComplete="address-level2"
            onChange={(e) => setCity(e.target.value)} className={`${inputClass} ${border('city')}`} />
          {err('city')}
        </Field>
      </div>

      <Field id="age" label={t.age}>
        <input id="age" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} value={age}
          onChange={(e) => setAge(e.target.value.replace(/\D/g, ''))} className={`${inputClass} w-28 ${border('age')}`} />
        {err('age')}
      </Field>
      <Choice legend={t.timeInCity} name="time_in_city" value={timeInCity} onChange={setTimeInCity}
        options={TIMES_IN_CITY.map((v) => [v, t.timeInCityOptions[v]])} error={err('time_in_city')} />
      <Choice legend={t.origin} name="origin" value={origin} onChange={setOrigin}
        options={ORIGINS.map((v) => [v, t.originOptions[v]])} error={err('origin')} />

      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">{t.interestsTitle}</h2>
          <p className="text-sm text-midnight/60">{t.interestsHint}</p>
        </div>
        {CATEGORIES.map((category) => {
          const n = counts[category];
          const showOther = otherOpen[category] || Boolean(otherText[category]);
          return (
            <fieldset key={category} className="space-y-3">
              <legend className="flex w-full items-center justify-between">
                <span className="font-semibold">{t.categories[category]}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${n > 0 ? 'bg-lime text-midnight' : 'bg-midnight/10 text-midnight/70'}`}
                >
                  {n}/{MAX_PER_CATEGORY}
                </span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {interestsByCategory(category).map((interest) => {
                  const selected = interests.includes(interest.code);
                  const full = !selected && n >= MAX_PER_CATEGORY;
                  return (
                    <button
                      key={interest.code}
                      type="button"
                      aria-pressed={selected}
                      disabled={full}
                      onClick={() => toggle(interest.code, category)}
                      className={`rounded-full border px-4 py-2 text-base font-medium transition ${
                        selected
                          ? 'border-violet bg-pink text-midnight'
                          : 'border-midnight/15 bg-white text-midnight disabled:opacity-40'
                      }`}
                    >
                      {interest[lang]}
                    </button>
                  );
                })}
              </div>
              {err(category)}
              {showOther ? (
                <input
                  aria-label={`${t.categories[category]}: ${t.otherLabel}`}
                  value={otherText[category] ?? ''}
                  maxLength={MAX_OTHER}
                  placeholder={`${t.otherLabel} · ${t.otherPlaceholder}`}
                  autoFocus={otherOpen[category] && !otherText[category]}
                  onChange={(e) => setOtherText((o) => ({ ...o, [category]: e.target.value }))}
                  className={`${inputClass} border-midnight/15 text-base`}
                />
              ) : (
                <button type="button" onClick={() => setOtherOpen((o) => ({ ...o, [category]: true }))}
                  className="text-sm font-medium text-violet">
                  {t.otherAdd}
                </button>
              )}
            </fieldset>
          );
        })}
        {err('other_text')}
        {/* Overall rule, always in view while picking. */}
        <div role="status" className={`sticky bottom-2 z-10 rounded-2xl border px-4 py-3 text-sm font-medium shadow-sm ${
          enough ? 'border-lime bg-lime text-midnight' : errors.interestsTotal ? 'border-red-600 bg-white text-red-700' : 'border-midnight/10 bg-white'
        }`}>
          {t.interestsCount(interests.length, usedCategories)}
          {errors.interestsTotal && !enough && <span className="block font-normal">{t.errors.interestsTotal}</span>}
        </div>
      </div>

      {/* Exactly one: one of the chosen interests, or a line of free text. */}
      <fieldset
        aria-describedby={errors.talk_about ? 'talk-about-hint talk-about-error' : 'talk-about-hint'}
        className={`space-y-3 rounded-3xl border bg-white p-4 ${errors.talk_about ? 'border-red-600' : 'border-midnight/10'}`}
      >
        <legend className="float-left w-full font-medium">{t.talkAbout}</legend>
        <p id="talk-about-hint" className="clear-both text-sm text-midnight/60">
          {t.talkAboutHint}
        </p>
        <p className="text-sm font-medium">{t.talkAboutPick}</p>
        {interests.length === 0 ? (
          <p className="text-sm text-midnight/60">{t.talkAboutPickFirst}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {interests.map((code) => (
              <button
                key={code}
                type="button"
                aria-pressed={talkAboutCode === code}
                onClick={() => {
                  setTalkAboutCode(talkAboutCode === code ? '' : code);
                  setTalkAbout('');
                }}
                className={`rounded-full border px-3 py-1 text-sm font-medium ${
                  talkAboutCode === code ? 'border-violet bg-violet text-white' : 'border-midnight/15 bg-white'
                }`}
              >
                {interestLabel(code, lang)}
              </button>
            ))}
          </div>
        )}
        <label htmlFor="talk_about" className="block text-sm font-medium">
          {t.talkAboutOr}
        </label>
        <textarea
          id="talk_about"
          rows={2}
          value={talkAbout}
          maxLength={MAX_TALK_ABOUT}
          onChange={(e) => {
            setTalkAbout(e.target.value);
            setTalkAboutCode('');
          }}
          className={`${inputClass} border-midnight/15 text-base`}
        />
        <p className="text-right text-xs text-midnight/60">
          {talkAbout.length}/{MAX_TALK_ABOUT}
        </p>
        {errors.talk_about && (
          <p id="talk-about-error" role="alert" className="text-sm text-red-700">
            {t.errors[errors.talk_about]}
          </p>
        )}
      </fieldset>

      <div className="space-y-2">
        <label className="flex gap-3">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 size-5 shrink-0 accent-violet" />
          <span>
            {t.consent}{' '}
            <Link href="/privacy" target="_blank" className="font-medium text-violet underline">
              {t.consentLink}
            </Link>
          </span>
        </label>
        {err('consent')}
      </div>

      <div className="space-y-3">
        {(hasErrors || failed) && (
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
      </div>
    </form>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block font-medium">
        {label}
      </label>
      {hint && <p className="text-sm text-midnight/60">{hint}</p>}
      {children}
    </div>
  );
}

function Choice({
  legend,
  name,
  value,
  onChange,
  options,
  error,
  columns,
}: {
  legend: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
  error: React.ReactNode;
  columns?: boolean;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 font-medium">{legend}</legend>
      <div className={columns ? 'grid grid-cols-4 gap-2' : 'grid gap-2'}>
        {options.map(([option, label]) => (
          <label
            key={option}
            className={`cursor-pointer rounded-2xl border px-4 py-3 text-center font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet/40 ${
              value === option ? 'border-violet bg-violet text-white' : 'border-midnight/15 bg-white'
            }`}
          >
            <input type="radio" name={name} value={option} checked={value === option}
              onChange={() => onChange(option)} className="sr-only" />
            {label}
          </label>
        ))}
      </div>
      {error}
    </fieldset>
  );
}
