import { describe, expect, it } from 'vitest';
import { CATEGORIES, INTERESTS, MAX_PER_CATEGORY, interestsByCategory } from '@/lib/interests';
import { interestLabel } from '@/lib/i18n';

const PREFIX = { music: 'music_', sports: 'sports_', food: 'food_', hobbies: 'hob_' };

describe('interests catalog', () => {
  it('has unique codes', () => {
    const codes = INTERESTS.map((i) => i.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('uses only the 4 categories, each with enough items to pick the max', () => {
    expect(new Set(INTERESTS.map((i) => i.category))).toEqual(new Set(CATEGORIES));
    for (const c of CATEGORIES) {
      expect(interestsByCategory(c).length).toBeGreaterThanOrEqual(MAX_PER_CATEGORY);
    }
  });

  it('prefixes every code according to its category', () => {
    for (const i of INTERESTS) expect(i.code.startsWith(PREFIX[i.category])).toBe(true);
  });

  it('has EN and PT labels', () => {
    expect(INTERESTS).toHaveLength(57);
    expect(interestLabel('food_veggie', 'pt')).toBe('Vegetariana e Vegana');
    expect(interestLabel('food_veggie', 'en')).toBe('Vegetarian & Vegan');
  });
});
