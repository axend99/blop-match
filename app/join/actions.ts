'use server';

import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { createElement } from 'react';
import WelcomeEmail from '@/emails/WelcomeEmail';
import { getMyParticipant, getUser } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { getDict, interestLabel } from '@/lib/i18n';
import { interestByCode } from '@/lib/interests';
import { getLang, setLang } from '@/lib/i18n/server';
import { validateProfile, type FieldErrors, type ProfileInput } from '@/lib/profile';
import { siteUrl } from '@/lib/site';
import { suggestTalkAbout, type SuggestionResult } from '@/lib/talkSuggestion';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { isBanned, mailboxAlerts, verifyNewProfile } from '@/lib/verification';

export type JoinState = { errors?: FieldErrors; failed?: boolean };

export async function createProfile(input: Omit<ProfileInput, 'lang'>): Promise<JoinState> {
  const lang = await getLang();
  const result = validateProfile({ ...input, lang });
  if (!result.ok) return { errors: result.errors };

  const user = await getUser();
  if (!user) redirect('/login');
  if (await getMyParticipant()) redirect('/me');
  if (!user.email) return { failed: true };
  if (await isBanned(user.email)) {
    await (await createClient()).auth.signOut();
    redirect('/login?error=banned');
  }
  // Same mailbox as a banned address or another profile: joins, but waits for an admin.
  const mailbox = await mailboxAlerts(user.email, user.id);

  const profile = result.data;
  const supabase = createServiceClient();
  const { data: participant, error } = await supabase
    .from('participants')
    // Held until the AI check of the name and texts comes back clean (lib/verification.ts).
    .insert({ ...profile, user_id: user.id, email: user.email, consent_at: new Date().toISOString(), pending_review: true })
    .select('id')
    .single();

  if (error) {
    // Unique user_id: a double submit already created the profile.
    if (error.code === '23505') redirect('/me');
    console.error('[join] insert failed', error);
    return { failed: true };
  }

  let mailboxHeld = false; // alerts could not be stored: skip the automatic release
  if (mailbox.length) {
    const { error: flagError } = await supabase
      .from('content_flags')
      .insert(mailbox.map((row) => ({ ...row, participant_id: participant.id, match_id: null })));
    if (flagError) console.error('[join] mailbox alerts not stored', flagError);
    mailboxHeld = Boolean(flagError);
  }

  try {
    await sendEmail({
      participantId: participant.id,
      kind: 'welcome',
      to: user.email,
      subject: getDict(profile.lang).emails.welcome.subject,
      react: createElement(WelcomeEmail, { name: profile.name, lang: profile.lang, url: `${siteUrl()}/me` }),
    });
  } catch (err) {
    console.error('[join] welcome email failed', err);
  }

  // AI check of the name and texts; matching runs right after if it is clean (also fills the
  // slots of people already waiting). Otherwise the profile waits for an admin.
  after(async () => {
    if (mailboxHeld) return; // stays pending; an admin approves from the Verificação tab
    try {
      await verifyNewProfile(participant.id, profile);
    } catch (err) {
      console.error('[join] verification failed', err);
    }
  });

  await setLang(profile.lang);
  redirect('/me');
}

// "Write it for me": an AI sentence for "what I want to talk about", about one of the
// person's chosen interests. Signed-in people without a profile only.
export async function suggestTalk(code: string): Promise<SuggestionResult> {
  const user = await getUser();
  if (!user || !interestByCode(code) || (await getMyParticipant())) return { error: 'failed' };
  const lang = await getLang();
  return suggestTalkAbout(user.id, { interest: interestLabel(code, lang), lang });
}
