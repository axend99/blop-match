import { Text } from '@react-email/components';
import { getDict, type Lang } from '@/lib/i18n';
import EmailLayout from './EmailLayout';

export default function WaitlistEmail({ name, lang, url }: { name: string; lang: Lang; url: string }) {
  const t = getDict(lang).emails;

  return (
    <EmailLayout lang={lang} preview={t.waitlist.body} buttonLabel={t.waitlist.button} buttonUrl={url} footer={t.footer}>
      <Text style={{ fontSize: 18, fontWeight: 600, margin: '0 0 12px' }}>{t.waitlist.greeting(name)}</Text>
      <Text style={{ fontSize: 16, lineHeight: '24px', margin: '0 0 12px' }}>{t.waitlist.body}</Text>
    </EmailLayout>
  );
}
