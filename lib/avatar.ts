import { CATEGORIES, type Category } from '@/lib/interests';
import { countByCategory } from '@/lib/profile';

// A participant's Blop is dressed for the category with the most interests. Ties are common
// (up to 5 per category), so they prefer categories with their own picture (not animals,
// for now) and are then broken by a stable hash of the list.
const NO_PICTURE: Category[] = ['animals'];
export function avatarCategory(interests: string[]): Category | null {
  if (interests.length === 0) return null;
  const counts = countByCategory(interests);
  const max = Math.max(...CATEGORIES.map((c) => counts[c]));
  if (max === 0) return null;
  const tied = CATEGORIES.filter((c) => counts[c] === max);
  const top = tied.some((c) => !NO_PICTURE.includes(c)) ? tied.filter((c) => !NO_PICTURE.includes(c)) : tied;

  let hash = 0;
  for (const ch of [...interests].sort().join(',')) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return top[hash % top.length];
}
