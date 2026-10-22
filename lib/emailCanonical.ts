import { isE2eEmail } from '@/lib/e2eUsers';

// The mailbox an address really delivers to, to stop one person from using many addresses
// (or coming back after a ban): lower case, no "+tag", and for Gmail no dots and
// googlemail.com = gmail.com. The automated test accounts (blopmatch+e2e…) are kept as they are.
export function canonicalEmail(email: string): string {
  const value = email.trim().toLowerCase();
  if (isE2eEmail(value)) return value;
  const at = value.lastIndexOf('@');
  if (at < 1) return value;
  let local = value.slice(0, at).replace(/\+.*$/, '');
  let domain = value.slice(at + 1);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.replace(/\./g, '');
  return `${local}@${domain}`;
}
