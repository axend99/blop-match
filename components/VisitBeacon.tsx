'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { stepForPath } from '@/lib/visits';

// Visit funnel for /admin: tells the server once per browser session that the home page, the
// login page or the sign-up form was reached (once per tab: sessionStorage). No cookies, nothing about the person.
export default function VisitBeacon() {
  const path = usePathname();
  useEffect(() => {
    const step = stepForPath(path);
    if (!step || navigator.webdriver) return;
    try {
      const key = `blop_visit_${step}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      return; // storage blocked: skip rather than count every page load
    }
    navigator.sendBeacon?.('/api/visit', JSON.stringify({ step }));
  }, [path]);
  return null;
}
