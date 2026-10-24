import { Text } from '@react-email/components';
import { getDict, type Lang } from '@/lib/i18n';
import EmailLayout from './EmailLayout';

const P = { fontSize: 16, lineHeight: '24px', margin: '0 0 12px' };

// match_nudge: "have you talked to your match?", the day before the review request.
export default function MatchNudgeEmail({
  name,
  partnerName,
  sharedItem,
  lang,
  url,
  reportUrl,
}: {
  name: string;
  partnerName: string;
  sharedItem?: string; // one interest they share, as a conversation starter (none for some controls)
  lang: Lang;
  url: string;
  reportUrl: string;
}) {
  const t = getDict(lang).emails;
  const copy = t.matchNudge;

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
      {sharedItem && <Text style={P}>{copy.hint(sharedItem)}</Text>}
      <Text style={P}>{copy.next}</Text>
    </EmailLayout>
  );
}
