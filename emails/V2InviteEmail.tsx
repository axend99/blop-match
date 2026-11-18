import { Text } from '@react-email/components';
import { getDict, type Lang } from '@/lib/i18n';
import EmailLayout from './EmailLayout';

const P = { fontSize: 16, lineHeight: '24px', margin: '0 0 12px' };

// v2_invite: v1 people are invited to join round 2 (sent once, from /admin).
export default function V2InviteEmail({ name, lang, url }: { name: string; lang: Lang; url: string }) {
  const t = getDict(lang).emails;
  const copy = t.v2Invite;
  return (
    <EmailLayout lang={lang} preview={copy.subject} buttonLabel={copy.button} buttonUrl={url} footer={t.footer}>
      <Text style={{ fontSize: 18, fontWeight: 600, margin: '0 0 12px' }}>{copy.greeting(name)}</Text>
      <Text style={P}>{copy.body}</Text>
      {copy.news.map((item) => (
        <Text key={item} style={{ ...P, paddingLeft: 12 }}>
          • {item}
        </Text>
      ))}
      <Text style={P}>{copy.next}</Text>
    </EmailLayout>
  );
}
