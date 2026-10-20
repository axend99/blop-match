import { Text } from '@react-email/components';
import { getDict, type Lang } from '@/lib/i18n';
import EmailLayout from './EmailLayout';

export default function NewMatchEmail({ name, lang, url }: { name: string; lang: Lang; url: string }) {
  const t = getDict(lang).emails;

  return (
    <EmailLayout lang={lang} preview={t.newMatch.title} buttonLabel={t.button} buttonUrl={url} footer={t.footer}>
      <Text style={{ fontSize: 18, fontWeight: 600, margin: '0 0 12px' }}>{t.newMatch.greeting(name)}</Text>
      <Text style={{ fontSize: 22, fontWeight: 700, margin: '0 0 12px' }}>{t.newMatch.title}</Text>
      <Text style={{ fontSize: 16, lineHeight: '24px', margin: '0 0 12px' }}>{t.newMatch.body}</Text>
    </EmailLayout>
  );
}
