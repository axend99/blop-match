import en, { type Dict } from './en';
import pt from './pt';
import { interestByCode } from '@/lib/interests';

export type Lang = 'en' | 'pt';
export const LANGS: Lang[] = ['en', 'pt'];
export const DEFAULT_LANG: Lang = 'en';
export const LANG_COOKIE = 'lang';

const dicts: Record<Lang, Dict> = { en, pt };

export function isLang(value: unknown): value is Lang {
  return value === 'en' || value === 'pt';
}

export function getDict(lang: Lang): Dict {
  return dicts[lang];
}

export function interestLabel(code: string, lang: Lang): string {
  const interest = interestByCode(code);
  return interest ? interest[lang] : code;
}
