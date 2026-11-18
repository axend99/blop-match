import { Text } from '@react-email/components';
import { getDict, type Lang } from '@/lib/i18n';
import EmailLayout from './EmailLayout';

const P = { fontSize: 16, lineHeight: '24px', margin: '0 0 12px' };

// guess_alert: "X tried to guess your password" (once per match), without saying if they got it.
export default function GuessAlertEmail({
  name,
  partnerName,
  lang,
  url,
  reportUrl,
}: {
  name: string;
  partnerName: string;
  lang: Lang;
  url: string;
  reportUrl: string;
}) {
  const t = getDict(lang).emails;
  const copy = t.guessAlert;

  return (
    <EmailLayout
      lang={lang}
      preview={copy.subject(partnerName)}
      buttonLabel={copy.button}
      buttonUrl={url}
      footer={t.footer}
      report={{ text: t.report, link: t.reportLink, url: reportUrl }}
    >
      <Text style={{ fontSize: 18, fontWeight: 600, margin: '0 0 12px' }}>{copy.greeting(name)}</Text>
      <Text style={P}>{copy.body(partnerName)}</Text>
      <Text style={P}>{copy.next}</Text>
    </EmailLayout>
  );
}
