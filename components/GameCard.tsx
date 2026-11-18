import Link from 'next/link';
import { setLeaderboardName } from '@/app/me/actions';
import { BADGES, nicknameLabel } from '@/lib/game';
import type { GameState } from '@/lib/gameService';
import type { Dict } from '@/lib/i18n/en';

// /me: the person's password, points, place on the leaderboard and badges (v2 only).
export default function GameCard({ game, password, name, t }: { game: GameState; password: string; name: string; t: Dict }) {
  const g = t.game;
  const earned = new Set(game.score.badges);
  return (
    <section className="space-y-4 rounded-3xl bg-lime/60 p-5">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-midnight/70">🤫 {t.password.reminderTitle}</h2>
        <p className="text-2xl font-bold">{password}</p>
        <p className="text-sm text-midnight/80">{t.password.reminderBody}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4">
        <div>
          <p className="text-2xl font-bold">{g.points(game.score.points)}</p>
          <p className="text-sm text-midnight/70">{game.rank ? g.rank(game.rank) : g.noRank}</p>
        </div>
        <Link href="/me/leaderboard" className="rounded-full bg-violet px-5 py-2.5 font-semibold text-white active:scale-[0.98]">
          {g.leaderboardLink}
        </Link>
      </div>
      <p className="text-xs text-midnight/70">{g.pointsHow}</p>
      <p className="font-medium">{g.prize}</p>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-midnight/70">{g.badgesTitle}</h3>
        <ul className="grid grid-cols-2 gap-2">
          {BADGES.map((b) => (
            <li key={b} className={`rounded-2xl p-3 ${earned.has(b) ? 'bg-violet text-white' : 'bg-white/60 text-midnight/50'}`}>
              <p className="font-semibold">
                {earned.has(b) ? '🏅' : '🔒'} {g.badges[b].name}
              </p>
              <p className={`text-xs ${earned.has(b) ? 'text-white/85' : ''}`}>{g.badges[b].desc}</p>
            </li>
          ))}
        </ul>
      </div>

      <form action={setLeaderboardName} className="space-y-1 text-sm">
        <p className="text-midnight/80">{g.appearAs(game.showName ? name : nicknameLabel(game.nickname, g))}</p>
        <input type="hidden" name="show" value={game.showName ? '0' : '1'} />
        <button type="submit" className="font-medium text-violet underline">
          {game.showName ? g.useNickname : g.showName}
        </button>
      </form>
    </section>
  );
}
