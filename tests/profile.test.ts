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
  age_range: '25-30',
  time_in_city: '2y+',
  origin: 'other_country',
  interests: [
    'music_rock', 'music_pop', 'music_indie',
    'sports_gym', 'sports_surf', 'sports_padel',
    'food_japanese', 'food_wine', 'food_brunch',
    'hob_beach', 'hob_bars', 'hob_travel',
  ],
  other_text: { music: '  80s synth ', sports: '   ' },
  consent: true,
};

const withInput = (patch: Partial<ProfileInput>) => validateProfile({ ...VALID, ...patch });

describe('whatsapp', () => {
  it('normalizes spaces, dashes, parentheses and 00 prefix', () => {
    expect(normalizeWhatsapp(' +351 912-345-678 ')).toBe('+351912345678');
    expect(normalizeWhatsapp('(+55) 11 98765.4321')).toBe('+5511987654321');
    expect(normalizeWhatsapp('00351912345678')).toBe('+351912345678');
  });

  it('accepts E.164 only', () => {
    expect(isValidWhatsapp('+351912345678')).toBe(true);
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
    });
    expect(result.data.interests).toHaveLength(12);
    expect(result.data.other_text).toEqual({ music: '80s synth' });
  });

  it('requires 3 to 6 interests in every category', () => {
    const two = withInput({ interests: VALID.interests.filter((c) => c !== 'music_indie') });
    expect(two.ok).toBe(false);
    if (!two.ok) expect(two.errors.music).toBe('interests');

    const seven = withInput({
      interests: [...VALID.interests, 'sports_tennis', 'sports_running', 'sports_cycling', 'sports_yoga'],
    });
    expect(seven.ok).toBe(false);
    if (!seven.ok) {
      expect(seven.errors.sports).toBe('interests');
      expect(seven.errors.music).toBeUndefined();
    }
  });

  it('does not count duplicates', () => {
    const result = withInput({
      interests: [...VALID.interests.filter((c) => c !== 'music_indie'), 'music_rock'],
    });
    expect(result.ok).toBe(false);
  });

  it('rejects unknown codes and codes counted in the wrong category', () => {
    expect(withInput({ interests: [...VALID.interests, 'music_polka'] }).ok).toBe(false);
    // A food item does not fill the music quota.
    const swapped = withInput({
      interests: [...VALID.interests.filter((c) => c !== 'music_indie'), 'food_indian'],
    });
    expect(swapped.ok).toBe(false);
    if (!swapped.ok) expect(swapped.errors.music).toBe('interests');
  });

  it('requires consent and the enum fields', () => {
    const result = withInput({ consent: false, age_range: '17', origin: '', lang: 'fr' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.consent).toBe('consent');
      expect(result.errors.age_range).toBe('required');
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

  it('flags empty and too long text fields', () => {
    const result = withInput({ name: ' ', city: 'x'.repeat(81), whatsapp: '912345678', instagram: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.name).toBe('required');
      expect(result.errors.city).toBe('tooLong');
      expect(result.errors.whatsapp).toBe('whatsapp');
      expect(result.errors.instagram).toBe('required');
    }
  });
});
