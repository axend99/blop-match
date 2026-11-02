import { Button, Text } from '@react-email/components';
import { getDict, type Lang } from '@/lib/i18n';
import EmailLayout from './EmailLayout';

const P = { fontSize: 16, lineHeight: '24px', margin: '0 0 12px' };

// final_call: the closing e-mail of the study, to people with reviews still to send.
export default function FinalEmail({ name, pending, lang, url }: { name: string; pending: number; lang: Lang; url: string }) {
  const t = getDict(lang).emails;
  const c = t.finalCall;

  return (
    <EmailLayout lang={lang} preview={c.subject} footer={t.footer}>
      <Text style={{ fontSize: 18, fontWeight: 600, margin: '0 0 12px' }}>{c.greeting(name)}</Text>
      <Text style={P}>{c.talk}</Text>
      <Text style={P}>{c.ending}</Text>
      <Text style={P}>{c.important}</Text>
      <Text style={{ ...P, fontWeight: 600 }}>{c.deadline(pending)}</Text>
      <Button
        href={url}
        style={{ backgroundColor: '#5b3cf5', color: '#ffffff', borderRadius: 999, padding: '14px 28px', fontSize: 16, fontWeight: 600, margin: '4px 0 20px' }}
      >
        {c.button}
      </Button>
      <Text style={P}>
        {c.signoff}
        <br />
        {c.team}
      </Text>
      <Text style={{ fontSize: 12, lineHeight: '18px', color: '#6b6478', margin: '0 0 16px' }}>{c.smallPrint}</Text>
    </EmailLayout>
  );
}
