'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Header "Sign in" for people without a session, so returning participants find their way to
// their matches. Hidden on the sign-in pages themselves.
export default function SignInLink({ label }: { label: string }) {
  const path = usePathname();
  if (path === '/login' || path.startsWith('/auth')) return null;
  return (
    <Link href="/login" className="rounded-full bg-violet px-4 py-1.5 text-sm font-semibold text-white shadow-sm active:scale-[0.98]">
      {label}
    </Link>
  );
}
