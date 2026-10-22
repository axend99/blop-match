import Image, { type StaticImageData } from 'next/image';
import type { Category } from '@/lib/interests';
import activities from '@/public/blop/activities.webp';
import fitness from '@/public/blop/fitness.webp';
import food from '@/public/blop/food.webp';
import hobbies from '@/public/blop/hobbies.webp';
import movies from '@/public/blop/movies.webp';
import music from '@/public/blop/music.webp';
import plain from '@/public/blop/plain.webp';
import sports from '@/public/blop/sports.webp';

// The BLOP mascot. Each participant's Blop is dressed for their top interest category
// (lib/avatar.ts); null, or a category without its own picture yet (animals), shows the
// plain Blop.
const PICTURES: Record<Category, StaticImageData> = {
  music,
  sports,
  fitness,
  movies,
  animals: plain,
  food,
  activities,
  hobbies,
};

export default function Blop({
  variant,
  label,
  className = '',
}: {
  variant: Category | null;
  label?: string; // omit when the Blop is decorative (e.g. inside a labelled link)
  className?: string;
}) {
  return (
    <Image
      src={variant ? PICTURES[variant] : plain}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      sizes="(min-width: 640px) 224px, 50vw"
      className={`object-contain ${className}`}
    />
  );
}
