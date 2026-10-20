import { describe, expect, it } from 'vitest';
import { avatarCategory } from '@/lib/avatar';
import { interestsByCategory, type Category } from '@/lib/interests';

const pick = (category: Category, n: number, offset = 0) =>
  interestsByCategory(category).slice(offset, offset + n).map((i) => i.code);

describe('avatarCategory', () => {
  it('returns null without interests', () => {
    expect(avatarCategory([])).toBeNull();
  });

  it('picks the category with the most interests', () => {
    const interests = [...pick('music', 3), ...pick('sports', 3), ...pick('food', 6), ...pick('hobbies', 4)];
    expect(avatarCategory(interests)).toBe('food');
  });

  it('breaks ties stably, whatever the order', () => {
    const interests = [...pick('music', 3), ...pick('sports', 3), ...pick('food', 3), ...pick('hobbies', 3)];
    expect(avatarCategory([...interests].reverse())).toBe(avatarCategory(interests));
  });

  it('does not always pick the first category on ties', () => {
    const results = new Set<Category | null>();
    for (let offset = 0; offset < 8; offset++) {
      const interests = (['music', 'sports', 'food', 'hobbies'] as Category[]).flatMap((c) => pick(c, 3, offset));
      results.add(avatarCategory(interests));
    }
    expect(results.size).toBeGreaterThan(1);
  });
});
