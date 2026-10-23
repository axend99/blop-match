'use client';

import { Analytics } from '@vercel/analytics/next';

// Anonymous page-view counts (Vercel Web Analytics, no cookies), to see where visitors drop off.
// Admin pages and auth links are left out: their URLs can carry access tokens. Query strings are
// dropped for the same reason.
export default function PageAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        const url = new URL(event.url);
        if (/^\/(admin|auth|go)(\/|$)/.test(url.pathname)) return null;
        return { ...event, url: url.origin + url.pathname };
      }}
    />
  );
}
