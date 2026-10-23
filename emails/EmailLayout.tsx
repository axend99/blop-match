import { Body, Button, Container, Head, Html, Link, Preview, Section, Text } from '@react-email/components';
import { BLOP_WEBSITE } from '@/lib/site';

const COLORS = { midnight: '#1e1530', violet: '#5b3cf5', paper: '#f5f2ef' };

export default function EmailLayout({
  lang,
  preview,
  buttonLabel,
  buttonUrl,
  footer,
  report,
  children,
}: {
  lang: string;
  preview: string;
  buttonLabel: string;
  buttonUrl: string;
  footer: string;
  report?: { text: string; link: string; url: string }; // "Report this person" (match e-mails)
  children: React.ReactNode;
}) {
  return (
    <Html lang={lang}>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: COLORS.paper, color: COLORS.midnight, fontFamily: 'Helvetica, Arial, sans-serif', margin: 0, padding: '24px 0' }}>
        <Container style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px' }}>
          <Text style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, margin: '0 0 24px' }}>
            bl<span style={{ color: COLORS.violet }}>o</span>p
          </Text>
          <Section style={{ backgroundColor: '#ffffff', borderRadius: 24, padding: 24 }}>
            {children}
            <Button
              href={buttonUrl}
              style={{ backgroundColor: COLORS.violet, color: '#ffffff', borderRadius: 999, padding: '14px 28px', fontSize: 16, fontWeight: 600, marginTop: 8 }}
            >
              {buttonLabel}
            </Button>
          </Section>
          {report && (
            <Text style={{ fontSize: 13, color: '#6b6478', textAlign: 'center', marginTop: 16 }}>
              {report.text}{' '}
              <Link href={report.url} style={{ color: '#6b6478', textDecoration: 'underline' }}>
                {report.link}
              </Link>
            </Text>
          )}
          <Text style={{ fontSize: 12, color: '#6b6478', textAlign: 'center', marginTop: 24 }}>
            {footer} ·{' '}
            <Link href={BLOP_WEBSITE} style={{ color: '#6b6478', textDecoration: 'underline' }}>
              meetblop.com
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
