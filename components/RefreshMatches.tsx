'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// New matches are created in the background (right after sign-up and by the daily run), so the
// matches page refreshes itself: whenever the person comes back to the tab, and every 15 s for
// a few minutes while they are still waiting for their first match.
export default function RefreshMatches({ waiting }: { waiting: boolean }) {
  const router = useRouter();
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    let ticks = 0;
    const timer = waiting
      ? setInterval(() => {
          if (++ticks > 20) clearInterval(timer!);
          else if (document.visibilityState === 'visible') router.refresh();
        }, 15_000)
      : undefined;
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      if (timer) clearInterval(timer);
    };
  }, [router, waiting]);
  return null;
}
