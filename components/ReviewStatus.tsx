import type { Dict } from '@/lib/i18n/en';
import { formatDate, reviewOpensAt } from '@/lib/site';

// Phase 3 shows when the review opens; Phase 4 turns the open state into a link to the form.
export default function ReviewStatus({
  t,
  lang,
  createdAt,
  reviewed,
}: {
  t: Dict['me'];
  lang: string;
  createdAt: string;
  reviewed: boolean;
}) {
  if (reviewed) return <span className="text-sm font-semibold text-violet">{t.reviewed}</span>;
  const opensAt = reviewOpensAt(createdAt);
  return (
    <span className="text-sm text-midnight/60">
      {opensAt <= new Date() ? t.rate : t.rateFrom(formatDate(opensAt, lang))}
    </span>
  );
}
