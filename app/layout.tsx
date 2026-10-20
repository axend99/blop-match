import type { Metadata, Viewport } from 'next';
import { Outfit } from 'next/font/google';
import Link from 'next/link';
import BlopLogo from '@/components/BlopLogo';
import LangSwitcher from '@/components/LangSwitcher';
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

  return (
    <html lang={lang} className={outfit.variable}>
      <body className="min-h-dvh bg-paper text-midnight antialiased">
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4">
          <header className="flex items-center justify-between py-4">
            <Link href="/" aria-label={t.appName}>
              <BlopLogo />
            </Link>
            <LangSwitcher current={lang} label={t.languageLabel} />
          </header>
          <main className="flex-1 py-6">{children}</main>
          <footer className="py-6 text-center text-sm text-neutral-500">
            <Link href="/privacy" className="underline">
              {t.footer.privacy}
            </Link>
          </footer>
        </div>
      </body>
    </html>
  );
}
