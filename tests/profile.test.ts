import { describe, expect, it } from 'vitest';
import {
  normalizeInstagram,
  normalizeWhatsapp,
  isValidInstagram,
  isValidWhatsapp,
  validateProfile,
  type ProfileInput,
} from '@/lib/profile';

const VALID: ProfileInput = {
  name: '  Ana ',
  whatsapp: '+351 912 345 678',
  instagram: '@Ana.Silva',
  city: ' Lisbon ',
  lang: 'pt',
  age: '27',
  time_in_city: '2y+',
  origin: 'other_country',
  interests: [
    'music_rock', 'music_pop', 'music_indie',
    'fit_gym', 'sports_surf', 'sports_padel',
    'food_japanese', 'food_wine', 'food_brunch',
    'act_beach', 'act_bars', 'act_travel',
  ],
  other_text: { music: '  80s synth ', sports: '   ' },
  talk_about: '  The best surf spots\n\n near Lisbon ',
  talk_about_code: '',
  consent: true,
};

const withInput = (patch: Partial<ProfileInput>) => validateProfile({ ...VALID, ...patch });

describe('whatsapp', () => {
  it('normalizes spaces, dashes, parentheses and 00 prefix', () => {
    expect(normalizeWhatsapp(' +351 912-345-678 ')).toBe('+351912345678');
    expect(normalizeWhatsapp('(+55) 11 98765.4321')).toBe('+5511987654321');
    expect(normalizeWhatsapp('00351912345678')).toBe('+351912345678');
  });

  it('accepts valid mobile numbers in international form only', () => {
    expect(isValidWhatsapp('+351912345678')).toBe(true);
    expect(isValidWhatsapp('+5511987654321')).toBe(true);
    expect(isValidWhatsapp('+447911123456')).toBe(true);
    expect(isValidWhatsapp('+351212345678')).toBe(false); // PT fixed line
    expect(isValidWhatsapp('+551133334444')).toBe(false); // BR fixed line
    expect(isValidWhatsapp('+35191234567')).toBe(false); // one digit short
    expect(isValidWhatsapp('912345678')).toBe(false);
    expect(isValidWhatsapp('+0351912345678')).toBe(false);
    expect(isValidWhatsapp('+12345')).toBe(false);
    expect(isValidWhatsapp('+1234567890123456')).toBe(false);
  });
});

describe('instagram', () => {
  it('strips @, URLs, query strings and trailing slashes', () => {
    expect(normalizeInstagram('@Ana.Silva')).toBe('ana.silva');
    expect(normalizeInstagram('https://www.instagram.com/ana_s/?igsh=abc123')).toBe('ana_s');
    expect(normalizeInstagram('instagram.com/ana_s')).toBe('ana_s');
  });

  it('rejects invalid handles', () => {
    expect(isValidInstagram('ana silva')).toBe(false);
    expect(isValidInstagram('ana-silva')).toBe(false);
    expect(isValidInstagram('a'.repeat(31))).toBe(false);
    expect(isValidInstagram('ana_silva.1')).toBe(true);
  });
});

describe('validateProfile', () => {
  it('returns normalized data for a valid profile', () => {
    const result = validateProfile(VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      name: 'Ana',
      city: 'Lisbon',
      whatsapp: '+351912345678',
      instagram: 'ana.silva',
      lang: 'pt',
      age: 27,
      age_range: '25-30',
    });
    expect(result.data.interests).toHaveLength(12);
    expect(result.data.other_text).toEqual({ music: '80s synth' });
    expect(result.data.talk_about).toBe('The best surf spots near Lisbon');
    expect(result.data.talk_about_code).toBeNull();
  });

  it('needs at least 10 interests from 3 categories, at most 5 per category', () => {
    const nine = withInput({ interests: VALID.interests.slice(0, 9) });
    expect(nine.ok || nine.errors.interestsTotal).toBe('interestsTotal');

    const twoCategories = withInput({
      interests: ['music_rock', 'music_pop', 'music_indie', 'music_jazz', 'music_fado', 'food_japanese', 'food_wine', 'food_brunch', 'food_thai', 'food_seafood'],
    });
    expect(twoCategories.ok || twoCategories.errors.interestsTotal).toBe('interestsTotal');

    // A category can stay empty: no animals, movies or hobbies here.
    expect(withInput({}).ok).toBe(true);

    const six = withInput({ interests: [...VALID.interests, 'music_jazz', 'music_fado', 'music_metal'] });
    expect(six.ok).toBe(false);
    if (!six.ok) {
      expect(six.errors.music).toBe('interests');
      expect(six.errors.food).toBeUndefined();
    }
  });

  it('does not count duplicates', () => {
    const result = withInput({ interests: [...VALID.interests.slice(0, 9), 'music_rock'] });
    expect(result.ok).toBe(false);
  });

  it('rejects unknown codes', () => {
    expect(withInput({ interests: [...VALID.interests, 'music_polka'] }).ok).toBe(false);
  });

  it('needs an age between 18 and 99 and stores its band', () => {
    const err = (age: unknown) => {
      const r = validateProfile({ ...VALID, age } as ProfileInput);
      return r.ok ? undefined : r.errors.age;
    };
    expect(err('')).toBe('required');
    expect(err('17')).toBe('age');
    expect(err('100')).toBe('age');
    expect(err('2.5')).toBe('age');
    expect(err('abc')).toBe('age');
    expect(err('18')).toBeUndefined();
    expect(err(99)).toBeUndefined();
    const r = withInput({ age: '36' });
    expect(r.ok && r.data.age_range).toBe('36+');
  });

  it('requires consent and the enum fields', () => {
    const result = withInput({ consent: false, origin: '', lang: 'fr' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.consent).toBe('consent');
      expect(result.errors.origin).toBe('required');
      expect(result.errors.lang).toBe('required');
    }
  });

  it('ignores unknown other_text keys and limits length', () => {
    const ignored = withInput({ other_text: { pets: 'cats' } });
    expect(ignored.ok && ignored.data.other_text).toEqual({});
    const long = withInput({ other_text: { food: 'x'.repeat(101) } });
    expect(long.ok).toBe(false);
    if (!long.ok) expect(long.errors.other_text).toBe('tooLong');
  });

  it('survives malformed payloads from the client', () => {
    const bad = { ...VALID, name: 42, interests: 'music_rock', other_text: 'x' } as unknown as ProfileInput;
    const result = validateProfile(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.name).toBe('required');
  });

  it('requires what you want to talk about, up to 140 characters after collapsing spaces', () => {
    const err = (talk_about: unknown) => {
      const r = validateProfile({ ...VALID, talk_about } as ProfileInput);
      return r.ok ? undefined : r.errors.talk_about;
    };
    expect(err('')).toBe('required');
    expect(err('   \n ')).toBe('required');
    expect(err(42)).toBe('required');
    expect(err('x'.repeat(140))).toBeUndefined();
    expect(err('x'.repeat(141))).toBe('tooLong');
    expect(err('x'.repeat(70) + '\n\n\n' + 'x'.repeat(69))).toBeUndefined(); // 70 + 1 + 69 = 140
  });

  it('accepts one of the chosen interests instead of text, never both', () => {
    const picked = withInput({ talk_about_code: 'sports_surf', talk_about: 'ignored' });
    expect(picked.ok).toBe(true);
    if (picked.ok) {
      expect(picked.data.talk_about_code).toBe('sports_surf');
      expect(picked.data.talk_about).toBeNull();
    }
    const notMine = withInput({ talk_about_code: 'sports_tennis', talk_about: '' });
    expect(notMine.ok || notMine.errors.talk_about).toBe('required');
    const unknown = withInput({ talk_about_code: 'music_polka', talk_about: '' });
    expect(unknown.ok || unknown.errors.talk_about).toBe('required');
    const neither = withInput({ talk_about_code: '', talk_about: '  ' });
    expect(neither.ok || neither.errors.talk_about).toBe('required');
  });

  it('flags empty and too long text fields', () => {
    const result = withInput({ name: ' ', city: 'x'.repeat(81), whatsapp: '912345678', instagram: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.name).toBe('required');
      expect(result.errors.city).toBe('tooLong');
      expect(result.errors.whatsapp).toBe('whatsapp');
      expect(result.errors.instagram).toBeUndefined();
    }
  });
});

describe('optional instagram', () => {
  it('stores an empty handle as null and still checks a given one', () => {
    const empty = withInput({ instagram: '  ' });
    expect(empty.ok && empty.data.instagram).toBeNull();
    const bad = withInput({ instagram: 'ana silva' });
    expect(bad.ok || bad.errors.instagram).toBe('instagram');
  });

  it('stores WhatsApp numbers as E.164', () => {
    const r = withInput({ whatsapp: '0055 (11) 98765-4321' });
    expect(r.ok && r.data.whatsapp).toBe('+5511987654321');
  });
});
