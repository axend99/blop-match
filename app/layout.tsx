import type { Metadata, Viewport } from 'next';
import { Outfit } from 'next/font/google';
import Link from 'next/link';
import { BLOP_WEBSITE } from '@/lib/site';
import BlopLogo from '@/components/BlopLogo';
import PageAnalytics from '@/components/PageAnalytics';
import LangSwitcher from '@/components/LangSwitcher';
import SignOutButton from '@/components/SignOutButton';
import { getUser } from '@/lib/auth';
import { getDict } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import './globals.css';

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict(await getLang());
  return { title: t.appName, description: t.meta.description };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f5f2ef',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  const t = getDict(lang);
  const user = await getUser();

  return (
    <html lang={lang} className={outfit.variable}>
      <body className="min-h-dvh bg-paper text-midnight antialiased">
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4">
          <header className="flex items-center justify-between py-4">
            <Link href="/" aria-label={t.appName}>
              <BlopLogo />
            </Link>
            <div className="flex items-center gap-2">
              {user && <SignOutButton label={t.common.signOut} />}
              <LangSwitcher current={lang} label={t.languageLabel} />
            </div>
          </header>
          <main className="flex-1 py-6">{children}</main>
          <footer className="flex justify-center gap-4 py-6 text-sm text-neutral-500">
            <Link href="/about" className="underline">
              {t.footer.about}
            </Link>
            <Link href="/privacy" className="underline">
              {t.footer.privacy}
            </Link>
            <a href={BLOP_WEBSITE} target="_blank" rel="noopener noreferrer" className="underline">
              meetblop.com
            </a>
          </footer>
        </div>
        <PageAnalytics />
      </body>
    </html>
  );
}
