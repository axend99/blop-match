import Link from 'next/link';
import { NAV_BUTTON } from '@/lib/ui';
import { notFound, redirect } from 'next/navigation';
import { submitReport } from '@/app/me/report/[matchId]/actions';
import { getMyParticipant, getUser } from '@/lib/auth';
import { getDict } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { getMyMatches } from '@/lib/myMatches';
import { MAX_REPORT_DETAILS, REPORT_REASONS } from '@/lib/report';

// Report one of your matches. Works without JavaScript (plain form and server action).
export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  const { matchId } = await params;
  // Back here after signing in (e.g. a link opened from an e-mail in another browser).
  if (!(await getUser())) redirect(`/login?next=/me/report/${encodeURIComponent(matchId)}`);
  if (!(await getMyParticipant())) redirect('/join');
  const { error, done } = await searchParams;
  const match = (await getMyMatches()).find((m) => m.match_id === matchId);
  if (!match || match.other_deleted) notFound();

  const t = getDict(await getLang());
  const back = (
    <Link href={`/me/match/${matchId}`} className={NAV_BUTTON}>
      ← {t.match.back}
    </Link>
  );

  if (done) {
    return (
      <div className="space-y-6">
        {back}
        <section className="space-y-3 rounded-3xl bg-white p-6 text-center">
          <h1 className="text-2xl font-bold">{t.report.thanksTitle}</h1>
          <p>{done === 'already' ? t.report.already : t.report.thanks}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {back}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{t.report.title(match.other_name)}</h1>
        <p className="text-midnight/70">{t.report.intro}</p>
      </div>
      <form action={submitReport.bind(null, matchId)} className="space-y-4">
        <fieldset className="space-y-2 rounded-3xl bg-white p-5" aria-invalid={error === 'reason'}>
          <legend className="float-left mb-3 w-full text-lg font-semibold">{t.report.reason}</legend>
          <div className="clear-both grid gap-2">
            {REPORT_REASONS.map((r) => (
              <label key={r} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-midnight/15 px-4 py-3 has-[:checked]:border-violet has-[:checked]:bg-violet/10">
                <input type="radio" name="reason" value={r} required className="size-4 accent-violet" />
                {t.report.reasons[r]}
              </label>
            ))}
          </div>
          {error === 'reason' && <p className="text-sm text-red-700">{t.report.chooseReason}</p>}
        </fieldset>
        <div className="space-y-2 rounded-3xl bg-white p-5">
          <label htmlFor="details" className="block text-lg font-semibold">
            {t.report.details}
          </label>
          <textarea
            id="details"
            name="details"
            rows={4}
            maxLength={MAX_REPORT_DETAILS}
            className="w-full rounded-2xl border border-midnight/15 bg-white px-4 py-3 text-base outline-none focus:border-violet focus:ring-2 focus:ring-violet/30"
          />
          {error === 'long' && <p className="text-sm text-red-700">{t.report.tooLong}</p>}
        </div>
        <button className="w-full rounded-full bg-midnight px-6 py-4 text-lg font-semibold text-white">{t.report.submit}</button>
      </form>
    </div>
  );
}
