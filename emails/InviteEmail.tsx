import { Button, Hr, Link, Text } from '@react-email/components';
import { getDict } from '@/lib/i18n';
import { BLOP_INSTAGRAM } from '@/lib/site';
import EmailLayout from './EmailLayout';

const P = { fontSize: 16, lineHeight: '24px', margin: '0 0 12px' };

// Invitation to try BLOP Match for people on the BLOP waiting list. We don't know their
// language, so it is in English with the Portuguese below.
export default function InviteEmail({ url }: { url: string }) {
  const en = getDict('en').emails.invite;
  const pt = getDict('pt').emails.invite;
  const block = (t: typeof en) => (
    <>
      <Text style={{ fontSize: 18, fontWeight: 600, margin: '0 0 12px' }}>{t.greeting}</Text>
      <Text style={P}>{t.intro}</Text>
      <Text style={P}>{t.invite}</Text>
      <Text style={P}>{t.how}</Text>
      <Text style={P}>{t.help}</Text>
    </>
  );

  return (
    <EmailLayout lang="en" preview={en.intro} buttonLabel={pt.button} buttonUrl={url} footer={`${en.footer} ${pt.footer}`}>
      {block(en)}
      <Button
        href={url}
        style={{ backgroundColor: '#5b3cf5', color: '#ffffff', borderRadius: 999, padding: '14px 28px', fontSize: 16, fontWeight: 600 }}
      >
        {en.button}
      </Button>
      <Text style={{ ...P, margin: '16px 0 0' }}>
        Instagram:{' '}
        <Link href={BLOP_INSTAGRAM} style={{ color: '#5b3cf5', textDecoration: 'underline' }}>
          @meetblop
        </Link>
        <br />
        {en.signoff}
      </Text>
      <Hr style={{ borderColor: '#e5e0ea', margin: '24px 0' }} />
      <div lang="pt">{block(pt)}</div>
    </EmailLayout>
  );
}
