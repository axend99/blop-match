import Link from 'next/link';
import type { Dict } from '@/lib/i18n/en';
import { formatDate, reviewOpensAt } from '@/lib/site';

// Review state of a match. With `matchId` (outside another link) the open state is a button
// to the form; inside a card, which is already a link, it stays text.
export default function ReviewStatus({
  t,
  lang,
  createdAt,
  reviewed,
  matchId,
}: {
  t: Dict['me'];
  lang: string;
  createdAt: string;
  reviewed: boolean;
  matchId?: string;
}) {
  if (reviewed) return <span className="text-sm font-semibold text-violet">{t.reviewed}</span>;
  const opensAt = reviewOpensAt(createdAt);
  if (matchId && opensAt <= new Date()) {
    return (
      <Link
        href={`/me/review/${matchId}`}
        className="block rounded-full border-2 border-violet px-6 py-4 text-center text-lg font-semibold text-violet"
      >
        {t.rate}
      </Link>
    );
  }
  return (
    <span className="text-sm text-midnight/60">
      {opensAt <= new Date() ? t.rate : t.rateFrom(formatDate(opensAt, lang))}
    </span>
  );
}
