import 'server-only';
import { createElement } from 'react';
import GuessAlertEmail from '@/emails/GuessAlertEmail';
import { sendEmail } from '@/lib/email';
import { MAX_GUESSES } from '@/lib/game';
import { checkGuess } from '@/lib/guessCheck';
import { getDict, isLang } from '@/lib/i18n';
import { guessCounts, guessIsRight } from '@/lib/password';
import { siteUrl } from '@/lib/site';
import { createServiceClient } from '@/lib/supabase/service';

export type GuessOutcome = { ok: true; right: boolean; attempt: number; left: number } | { ok: false; error: 'full' | 'repeat' | 'failed' };

// Saves one guess of the other person's password (up to MAX_GUESSES per match, none after a right
// one) and says at once whether it was right (translations count). Callers check that the match is
// mine and that I'm in v2.
export async function addGuess({ matchId, meId, guess }: { matchId: string; meId: string; guess: string }): Promise<GuessOutcome> {
  const supabase = createServiceClient();
  const [{ data: match }, { data: previous }] = await Promise.all([
    supabase.from('matches').select('a_id, b_id').eq('id', matchId).maybeSingle(),
    supabase.from('password_guesses').select('guess, is_right').eq('match_id', matchId).eq('guesser_id', meId),
  ]);
  if (!match || (match.a_id !== meId && match.b_id !== meId)) return { ok: false, error: 'failed' };
  const tries = previous ?? [];
  const otherId = match.a_id === meId ? match.b_id : match.a_id;
  const { data: other } = await supabase.from('participants').select('password').eq('id', otherId).maybeSingle();
  const password = other?.password ?? null;
  if (tries.length >= MAX_GUESSES || tries.some((p) => guessCounts(p.is_right, p.guess, password))) return { ok: false, error: 'full' };
  if (tries.some((p) => guessIsRight(p.guess, guess))) return { ok: false, error: 'repeat' };

  const isRight = await checkGuess(guess, password);
  const { error } = await supabase
    .from('password_guesses')
    .insert({ match_id: matchId, guesser_id: meId, attempt: tries.length + 1, guess, is_right: isRight });
  if (error) {
    if (error.code !== '23505') console.error('[guess] insert failed', error);
    return { ok: false, error: 'failed' };
  }
  const right = guessCounts(isRight, guess, password);
  return { ok: true, right, attempt: tries.length + 1, left: right ? 0 : MAX_GUESSES - tries.length - 1 };
}

// "X tried to guess your password 👀": once per match and guesser (email_log blocks repeats).
export async function sendGuessAlert({ matchId, guesserId }: { matchId: string; guesserId: string }): Promise<void> {
  const supabase = createServiceClient();
  const { data: match } = await supabase.from('matches').select('a_id, b_id').eq('id', matchId).maybeSingle();
  if (!match) return;
  const targetId = match.a_id === guesserId ? match.b_id : match.a_id;
  const [{ data: target }, { data: guesser }, { data: review }] = await Promise.all([
    supabase.from('participants').select('id, name, email, lang, active, deleted_at').eq('id', targetId).maybeSingle(),
    supabase.from('participants').select('name').eq('id', guesserId).maybeSingle(),
    supabase.from('reviews').select('id').eq('match_id', matchId).eq('reviewer_id', targetId).maybeSingle(),
  ]);
  // Nothing to find out for someone who already rated (they see the result on the match page).
  if (!target?.email || !target.active || target.deleted_at || !guesser || review) return;
  const lang = isLang(target.lang) ? target.lang : 'en';
  await sendEmail({
    participantId: target.id,
    kind: 'guess_alert',
    matchId,
    to: target.email,
    subject: getDict(lang).emails.guessAlert.subject(guesser.name),
    react: createElement(GuessAlertEmail, {
      name: target.name,
      partnerName: guesser.name,
      lang,
      url: `${siteUrl()}/login?next=/me/match/${matchId}`,
      reportUrl: `${siteUrl()}/login?next=/me/report/${matchId}`,
    }),
  });
}
