import {
  CATEGORIES,
  MAX_PER_CATEGORY,
  MIN_CATEGORIES,
  MIN_TOTAL,
  interestByCode,
  type Category,
} from '@/lib/interests';
import { isLang, type Lang } from '@/lib/i18n';
import { toWhatsapp } from '@/lib/phone';

export const AGE_RANGES = ['18-24', '25-30', '31-35', '36+'] as const;
export const TIMES_IN_CITY = ['lt6m', '6-24m', '2y+', 'always'] as const;
export const ORIGINS = ['this_city', 'same_country', 'other_country'] as const;

export type AgeRange = (typeof AGE_RANGES)[number];
export const MIN_AGE = 18;
export const MAX_AGE = 99;

// Age bands kept for the analysis (segments, admin, CSV); the profile stores the exact age.
export function ageRange(age: number): AgeRange {
  return age <= 24 ? '18-24' : age <= 30 ? '25-30' : age <= 35 ? '31-35' : '36+';
}
export type TimeInCity = (typeof TIMES_IN_CITY)[number];
export type Origin = (typeof ORIGINS)[number];

export const MAX_NAME = 40;
export const MAX_CITY = 80;
export const MAX_OTHER = 100;
export const MAX_TALK_ABOUT = 140;

const INSTAGRAM_RE = /^[a-z0-9._]{1,30}$/;

export type ProfileInput = {
  name: string;
  whatsapp: string;
  instagram: string;
  city: string;
  lang: string;
  age: string | number;
  time_in_city: string;
  origin: string;
  interests: string[];
  other_text: Record<string, string>;
  talk_about: string;
  talk_about_code: string;
  consent: boolean;
};

export type Profile = {
  name: string;
  whatsapp: string;
  instagram: string | null;
  city: string;
  lang: Lang;
  age: number;
  age_range: AgeRange;
  time_in_city: TimeInCity;
  origin: Origin;
  interests: string[];
  other_text: Partial<Record<Category, string>>;
  talk_about: string | null;
  talk_about_code: string | null;
};

export type ErrorKey = 'required' | 'tooLong' | 'whatsapp' | 'instagram' | 'age' | 'interests' | 'interestsTotal' | 'consent';
// `interestsTotal`: the overall rule (MIN_TOTAL items in MIN_CATEGORIES categories); a
// category key: more than MAX_PER_CATEGORY in it.
export type FieldErrors = Partial<Record<Exclude<keyof ProfileInput, 'interests'> | Category | 'interestsTotal', ErrorKey>>;

export type ValidationResult = { ok: true; data: Profile } | { ok: false; errors: FieldErrors };

export function normalizeWhatsapp(value: string): string {
  const compact = value.trim().replace(/[\s\-.()]/g, '');
  return compact.startsWith('00') ? `+${compact.slice(2)}` : compact;
}

// A valid mobile number in international form (stored as E.164, as the DB check requires).
export function isValidWhatsapp(value: string): boolean {
  return value.startsWith('+') && toWhatsapp(value) !== null;
}

export function normalizeInstagram(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/^instagram\.com\//i, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
    .replace(/^@/, '')
    .toLowerCase();
}

export function isValidInstagram(value: string): boolean {
  return INSTAGRAM_RE.test(value);
}

export function countByCategory(codes: string[]): Record<Category, number> {
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
  for (const code of codes) {
    const interest = interestByCode(code);
    if (interest) counts[interest.category]++;
  }
  return counts;
}

// The server action receives client data, so fields may not have the declared types.
function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function oneOf<T extends string>(options: readonly T[], value: string): value is T {
  return (options as readonly string[]).includes(value);
}

export function validateProfile(input: ProfileInput): ValidationResult {
  const errors: FieldErrors = {};

  const name = str(input.name).trim();
  if (!name) errors.name = 'required';
  else if (name.length > MAX_NAME) errors.name = 'tooLong';

  const city = str(input.city).trim();
  if (!city) errors.city = 'required';
  else if (city.length > MAX_CITY) errors.city = 'tooLong';

  const typed = normalizeWhatsapp(str(input.whatsapp));
  const whatsapp = isValidWhatsapp(typed) ? toWhatsapp(typed)! : typed;
  if (!typed) errors.whatsapp = 'required';
  else if (!isValidWhatsapp(typed)) errors.whatsapp = 'whatsapp';

  // Optional: an empty handle is stored as null (no Instagram button, no Instagram question).
  const instagram = normalizeInstagram(str(input.instagram)) || null;
  if (instagram && !isValidInstagram(instagram)) errors.instagram = 'instagram';

  if (!isLang(input.lang)) errors.lang = 'required';
  const ageText = String(input.age ?? '').trim();
  const age = /^\d{1,2}$/.test(ageText) ? Number(ageText) : NaN;
  if (!ageText) errors.age = 'required';
  else if (!(age >= MIN_AGE && age <= MAX_AGE)) errors.age = 'age';
  if (!oneOf(TIMES_IN_CITY, str(input.time_in_city))) errors.time_in_city = 'required';
  if (!oneOf(ORIGINS, str(input.origin))) errors.origin = 'required';

  const raw = Array.isArray(input.interests) ? input.interests : [];
  const interests = [...new Set(raw.map(str))];
  const unknown = interests.some((code) => !interestByCode(code));
  const counts = countByCategory(interests);
  for (const category of CATEGORIES) {
    if (counts[category] > MAX_PER_CATEGORY) errors[category] = 'interests';
  }
  const used = CATEGORIES.filter((c) => counts[c] > 0).length;
  if (unknown || interests.length < MIN_TOTAL || used < MIN_CATEGORIES) errors.interestsTotal = 'interestsTotal';

  const other_text: Partial<Record<Category, string>> = {};
  const other = input.other_text && typeof input.other_text === 'object' ? input.other_text : {};
  for (const [key, value] of Object.entries(other)) {
    if (!oneOf(CATEGORIES, key) || typeof value !== 'string') continue;
    const text = value.trim();
    if (!text) continue;
    if (text.length > MAX_OTHER) errors.other_text = 'tooLong';
    else other_text[key] = text;
  }

  // "What I want to talk about": exactly one of the person's own interests, or one line of
  // free text (newlines and repeated spaces collapse before the length check).
  const code = str(input.talk_about_code);
  let talk_about: string | null = null;
  let talk_about_code: string | null = null;
  if (code) {
    if (interests.includes(code) && interestByCode(code)) talk_about_code = code;
    else errors.talk_about = 'required';
  } else {
    talk_about = str(input.talk_about).replace(/\s+/g, ' ').trim();
    if (!talk_about) errors.talk_about = 'required';
    else if (talk_about.length > MAX_TALK_ABOUT) errors.talk_about = 'tooLong';
  }

  if (input.consent !== true) errors.consent = 'consent';

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      name,
      whatsapp,
      instagram,
      city,
      lang: input.lang as Lang,
      age,
      age_range: ageRange(age),
      time_in_city: input.time_in_city as TimeInCity,
      origin: input.origin as Origin,
      interests,
      other_text,
      talk_about,
      talk_about_code,
    },
  };
}
