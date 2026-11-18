import Link from 'next/link';
import type { Dict } from '@/lib/i18n/en';

// Top navigation of the participant area: matches, reviews (each match + the app) and the
// leaderboard (v2 only, the password game). `pending` shows how many reviews wait.
export default function StudyTabs({
  t,
  active,
  pending,
  showLeaderboard,
}: {
  t: Dict['tabs'];
  active: 'matches' | 'reviews' | 'leaderboard';
  pending: number;
  showLeaderboard: boolean;
}) {
  const tabs = [
    { key: 'matches', href: '/me', label: t.matches },
    { key: 'reviews', href: '/me/reviews', label: t.reviews, badge: pending },
    ...(showLeaderboard ? [{ key: 'leaderboard', href: '/me/leaderboard', label: t.leaderboard }] : []),
  ] as const;
  return (
    <nav aria-label={t.label} className="flex gap-1 rounded-full bg-white p-1 shadow-sm">
      {tabs.map((tab) => {
        const on = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={on ? 'page' : undefined}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2.5 text-center text-sm font-semibold ${
              on ? 'bg-violet text-white' : 'text-midnight/70'
            }`}
          >
            {tab.label}
            {'badge' in tab && tab.badge > 0 && (
              <span className={`min-w-5 rounded-full px-1.5 text-xs leading-5 ${on ? 'bg-white text-violet' : 'bg-pink text-midnight'}`}>
                {tab.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
