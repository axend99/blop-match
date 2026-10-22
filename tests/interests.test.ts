import { describe, expect, it } from 'vitest';
import { CATEGORIES, INTERESTS, MAX_PER_CATEGORY, interestByCode, interestsByCategory } from '@/lib/interests';
import { interestLabel } from '@/lib/i18n';

const PREFIX = {
  music: 'music_',
  sports: 'sports_',
  fitness: 'fit_',
  movies: 'movies_',
  animals: 'animals_',
  food: 'food_',
  activities: 'act_',
  hobbies: 'hob_',
};

describe('interests catalog', () => {
  it('has unique codes', () => {
    const codes = INTERESTS.map((i) => i.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('uses the 8 categories, each with enough items to pick the max', () => {
    expect(CATEGORIES).toHaveLength(8);
    expect(new Set(INTERESTS.map((i) => i.category))).toEqual(new Set(CATEGORIES));
    for (const c of CATEGORIES) expect(interestsByCategory(c).length).toBeGreaterThanOrEqual(MAX_PER_CATEGORY);
  });

  it('prefixes every code according to its category', () => {
    for (const i of INTERESTS) expect(i.code.startsWith(PREFIX[i.category])).toBe(true);
  });

  it('has short EN and PT labels (no parentheses), cuisines named as food', () => {
    for (const i of INTERESTS) {
      expect(i.en && i.pt).toBeTruthy();
      expect(i.en + i.pt).not.toMatch(/[()]/);
    }
    expect(interestLabel('food_japanese', 'en')).toBe('Japanese food');
    expect(interestLabel('food_japanese', 'pt')).toBe('Comida japonesa');
  });

  it('keeps cooking, dancing and languages only once, in hobbies', () => {
    expect(interestByCode('hob_cooking')?.category).toBe('hobbies');
    expect(INTERESTS.filter((i) => /cook|danc|language/i.test(i.en)).map((i) => i.category)).toEqual(['hobbies', 'hobbies', 'hobbies']);
  });
});
