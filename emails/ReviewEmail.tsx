import { Text } from '@react-email/components';
import { getDict, type Lang } from '@/lib/i18n';
import EmailLayout from './EmailLayout';

// review_open and review_reminder share this layout; only the texts change.
export default function ReviewEmail({
  kind,
  name,
  lang,
  url,
}: {
  kind: 'reviewOpen' | 'reviewReminder';
  name: string;
  lang: Lang;
  url: string;
}) {
  const t = getDict(lang).emails;
  const copy = t[kind];

  return (
    <EmailLayout lang={lang} preview={copy.subject} buttonLabel={copy.button} buttonUrl={url} footer={t.footer}>
      <Text style={{ fontSize: 18, fontWeight: 600, margin: '0 0 12px' }}>{copy.greeting(name)}</Text>
      <Text style={{ fontSize: 16, lineHeight: '24px', margin: '0 0 12px' }}>{copy.body}</Text>
    </EmailLayout>
  );
}
