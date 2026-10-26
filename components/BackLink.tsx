import Link from 'next/link';
import { NAV_BUTTON } from '@/lib/ui';
import { getMyParticipant, getUser } from '@/lib/auth';
import type { Dict } from '@/lib/i18n/en';

// "← Back" for the info pages: to the matches with a profile, to sign-up when logged in
// without one, home otherwise.
export default async function BackLink({ t }: { t: Dict }) {
  const user = await getUser();
  const me = user ? await getMyParticipant() : null;
  const [href, label] = me ? ['/me', t.match.back] : user ? ['/join', t.common.backToJoin] : ['/', t.common.backHome];
  return (
    <Link href={href} className={NAV_BUTTON}>
      ← {label}
    </Link>
  );
}
