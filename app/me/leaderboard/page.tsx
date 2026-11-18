import StudyTabs from '@/components/StudyTabs';
import { getMyStudy } from '@/lib/myStudy';
import { redirect } from 'next/navigation';
import { getMyParticipant, getUser } from '@/lib/auth';
import { nicknameLabel, PRIZE_PLACES } from '@/lib/game';
import { loadGame, type BoardRow } from '@/lib/gameService';
import { getDict } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';

// Password game leaderboard (v2): top 10 and, below, my own place if I'm not in it. People appear
// with their first name only if they chose to; otherwise with their nickname.
export default async function LeaderboardPage() {
  if (!(await getUser())) redirect('/login?next=/me/leaderboard');
  const me = await getMyParticipant();
  if (!me) redirect('/join');
  if (me.cohort !== 'v2') redirect('/me');
  const t = getDict(await getLang());
  const game = await loadGame(me.id);
  const label = (r: BoardRow) => r.firstName ?? nicknameLabel(r.nickname, t.game);

  const Row = ({ r }: { r: BoardRow }) => (
    <li className={`flex items-center gap-3 rounded-2xl p-3 ${r.isMe ? 'bg-violet text-white' : 'bg-white'}`}>
      <span className="w-10 shrink-0 text-center text-lg font-bold">{r.rank <= PRIZE_PLACES ? ['🥇', '🥈', '🥉'][r.rank - 1] : `${r.rank}.`}</span>
      <span className="min-w-0 flex-1 truncate font-medium">
        {label(r)}
        {r.isMe && ` (${t.game.you})`}
      </span>
      <span className="shrink-0 font-semibold">{t.game.points(r.points)}</span>
    </li>
  );

  return (
    <div className="space-y-6">
      <StudyTabs t={t.tabs} active="leaderboard" pending={(await getMyStudy(me)).pending} showLeaderboard />
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{t.game.boardTitle}</h1>
        <p className="text-midnight/70">{t.game.boardIntro}</p>
        <p className="rounded-2xl bg-lime/60 p-3 font-medium">{t.game.prize}</p>
        <p className="text-sm text-midnight/70">{t.game.pointsHow}</p>
      </div>
      {game.top.length === 0 ? (
        <p className="rounded-3xl bg-white p-6 text-center">{t.game.boardEmpty}</p>
      ) : (
        <ol className="space-y-2">
          {game.top.map((r, i) => (
            <Row key={i} r={r} />
          ))}
        </ol>
      )}
      {game.me && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-midnight/70">{t.game.youOutside}</h2>
          <ol>
            <Row r={game.me} />
          </ol>
        </div>
      )}
    </div>
  );
}
