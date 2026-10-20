import {
  CATEGORIES,
  MAX_PER_CATEGORY,
  MIN_PER_CATEGORY,
  interestByCode,
  type Category,
} from '@/lib/interests';
import { isLang, type Lang } from '@/lib/i18n';

export const AGE_RANGES = ['18-24', '25-30', '31-35', '36+'] as const;
export const TIMES_IN_CITY = ['lt6m', '6-24m', '2y+', 'always'] as const;
export const ORIGINS = ['this_city', 'same_country', 'other_country'] as const;

export type AgeRange = (typeof AGE_RANGES)[number];
export type TimeInCity = (typeof TIMES_IN_CITY)[number];
export type Origin = (typeof ORIGINS)[number];

export const MAX_NAME = 40;
export const MAX_CITY = 80;
export const MAX_OTHER = 100;

// Same rule as the participants.whatsapp check in the migration (E.164).
const WHATSAPP_RE = /^\+[1-9][0-9]{6,14}$/;
const INSTAGRAM_RE = /^[a-z0-9._]{1,30}$/;

export type ProfileInput = {
  name: string;
  whatsapp: string;
  instagram: string;
  city: string;
  lang: string;
  age_range: string;
  time_in_city: string;
  origin: string;
  interests: string[];
  other_text: Record<string, string>;
  consent: boolean;
};

export type Profile = {
  name: string;
  whatsapp: string;
  instagram: string;
  city: string;
  lang: Lang;
  age_range: AgeRange;
  time_in_city: TimeInCity;
  origin: Origin;
  interests: string[];
  other_text: Partial<Record<Category, string>>;
};

export type ErrorKey = 'required' | 'tooLong' | 'whatsapp' | 'instagram' | 'interests' | 'consent';
export type FieldErrors = Partial<Record<Exclude<keyof ProfileInput, 'interests'> | Category, ErrorKey>>;

export type ValidationResult = { ok: true; data: Profile } | { ok: false; errors: FieldErrors };

export function normalizeWhatsapp(value: string): string {
  const compact = value.trim().replace(/[\s\-.()]/g, '');
  return compact.startsWith('00') ? `+${compact.slice(2)}` : compact;
}

export function isValidWhatsapp(value: string): boolean {
  return WHATSAPP_RE.test(value);
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
  const counts: Record<Category, number> = { music: 0, sports: 0, food: 0, hobbies: 0 };
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

  const whatsapp = normalizeWhatsapp(str(input.whatsapp));
  if (!whatsapp) errors.whatsapp = 'required';
  else if (!isValidWhatsapp(whatsapp)) errors.whatsapp = 'whatsapp';

  const instagram = normalizeInstagram(str(input.instagram));
  if (!instagram) errors.instagram = 'required';
  else if (!isValidInstagram(instagram)) errors.instagram = 'instagram';

  if (!isLang(input.lang)) errors.lang = 'required';
  if (!oneOf(AGE_RANGES, str(input.age_range))) errors.age_range = 'required';
  if (!oneOf(TIMES_IN_CITY, str(input.time_in_city))) errors.time_in_city = 'required';
  if (!oneOf(ORIGINS, str(input.origin))) errors.origin = 'required';

  const raw = Array.isArray(input.interests) ? input.interests : [];
  const interests = [...new Set(raw.map(str))];
  const unknown = interests.some((code) => !interestByCode(code));
  const counts = countByCategory(interests);
  for (const category of CATEGORIES) {
    const n = counts[category];
    if (unknown || n < MIN_PER_CATEGORY || n > MAX_PER_CATEGORY) errors[category] = 'interests';
  }

  const other_text: Partial<Record<Category, string>> = {};
  const other = input.other_text && typeof input.other_text === 'object' ? input.other_text : {};
  for (const [key, value] of Object.entries(other)) {
    if (!oneOf(CATEGORIES, key) || typeof value !== 'string') continue;
    const text = value.trim();
    if (!text) continue;
    if (text.length > MAX_OTHER) errors.other_text = 'tooLong';
    else other_text[key] = text;
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
      age_range: input.age_range as AgeRange,
      time_in_city: input.time_in_city as TimeInCity,
      origin: input.origin as Origin,
      interests,
      other_text,
    },
  };
}
