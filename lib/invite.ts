import { canonicalEmail } from '@/lib/emailCanonical';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A list pasted in /admin (one per line, or separated by commas, semicolons or spaces), in
// lower case and without repeats. "Name <a@b.com>" keeps just the address.
export function parseEmailList(text: string): { valid: string[]; invalid: string[] } {
  const valid = new Set<string>();
  const invalid = new Set<string>();
  for (const raw of text.split(/[\s,;]+/)) {
    const value = raw.replace(/^<|>$/g, '').trim().toLowerCase();
    if (!value) continue;
    if (EMAIL.test(value)) valid.add(value);
    else invalid.add(value);
  }
  return { valid: [...valid], invalid: [...invalid] };
}

// Who still gets the invitation, compared by mailbox (a.b@gmail.com = ab@gmail.com, see
// canonicalEmail): one per mailbox, not invited before, not banned and not already in BLOP Match.
// The three sets hold canonical addresses.
export function pendingInvites(
  emails: string[],
  { invited, banned, participants }: { invited: Set<string>; banned: Set<string>; participants: Set<string> },
) {
  const toSend: string[] = [];
  const seen = new Set<string>();
  const skipped = { invited: 0, banned: 0, participant: 0 };
  for (const email of emails) {
    const mailbox = canonicalEmail(email);
    if (seen.has(mailbox)) continue;
    seen.add(mailbox);
    if (invited.has(mailbox)) skipped.invited++;
    else if (banned.has(mailbox)) skipped.banned++;
    else if (participants.has(mailbox)) skipped.participant++;
    else toSend.push(email);
  }
  return { toSend, skipped };
}
