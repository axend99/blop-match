import type { Dict } from '@/lib/i18n/en';

// Pre-filled WhatsApp message for the match page: leads with what the other person wants
// to talk about, then up to 3 other shared interests. Written in the sender's language.

const MAX_SHARED = 3;

export type Label = { code: string; label: string };
// One of their interests (translated label) or their own words.
export type Topic = Label | { text: string } | null;

export function whatsappMessage(args: { t: Dict['match']; me: string; them: string; topic: Topic; shared: Label[] }): string {
  const { t, me, them, topic } = args;
  // The topic is often a shared interest too: don't repeat it in the list.
  const topicCode = topic && 'code' in topic ? topic.code : null;
  const shared = args.shared
    .filter((s) => s.code !== topicCode)
    .slice(0, MAX_SHARED)
    .map((s) => s.label)
    .join(', ');

  const parts = [t.waHello(them, me)];
  if (topic) {
    parts.push('code' in topic ? t.waTopic(topic.label) : t.waTopicText(topic.text));
    if (shared) parts.push(t.waShared(shared));
  } else {
    parts.push(shared ? t.waOnlyShared(shared) : t.waGeneric);
  }
  return parts.join(' ');
}

export function whatsappLink(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
}
