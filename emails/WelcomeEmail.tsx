import { Text } from '@react-email/components';
import { getDict, type Lang } from '@/lib/i18n';
import EmailLayout from './EmailLayout';

export default function WelcomeEmail({ name, lang, url }: { name: string; lang: Lang; url: string }) {
  const t = getDict(lang).emails;

  return (
    <EmailLayout lang={lang} preview={t.welcome.body} buttonLabel={t.button} buttonUrl={url} footer={t.footer}>
      <Text style={{ fontSize: 18, fontWeight: 600, margin: '0 0 12px' }}>{t.welcome.greeting(name)}</Text>
      <Text style={{ fontSize: 16, lineHeight: '24px', margin: '0 0 12px' }}>{t.welcome.body}</Text>
      {t.welcome.steps.map((step, i) => (
        <Text key={i} style={{ fontSize: 16, lineHeight: '24px', margin: '0 0 8px' }}>
          {i + 1}. {step}
        </Text>
      ))}
    </EmailLayout>
  );
}
