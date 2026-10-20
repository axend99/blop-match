import { CATEGORIES, type Category } from '@/lib/interests';
import { countByCategory } from '@/lib/profile';

// A participant's Blop wears the accessory of the category with the most interests.
// Ties are common (3–6 per category), so they are broken by a stable hash of the list.
export function avatarCategory(interests: string[]): Category | null {
  if (interests.length === 0) return null;
  const counts = countByCategory(interests);
  const max = Math.max(...CATEGORIES.map((c) => counts[c]));
  if (max === 0) return null;
  const top = CATEGORIES.filter((c) => counts[c] === max);

  let hash = 0;
  for (const ch of [...interests].sort().join(',')) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return top[hash % top.length];
}
