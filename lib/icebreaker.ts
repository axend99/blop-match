import type { Dict } from '@/lib/i18n/en';

// Pre-filled WhatsApp message for the match page, in the sender's language. It is about
// what the other person wants to talk about and nothing else, so the chat starts on it.
// Only profiles without a topic (created before that field) fall back to shared interests.

const MAX_SHARED = 3;

export type Label = { code: string; label: string };
// One of their interests (translated label) or their own words.
export type Topic = Label | { text: string } | null;

export function whatsappMessage(args: { t: Dict['match']; me: string; them: string; topic: Topic; shared: Label[] }): string {
  const { t, me, them, topic } = args;
  const hello = t.waHello(them, me);
  if (topic) return `${hello} ${'code' in topic ? t.waTopic(topic.label) : t.waTopicText(topic.text)}`;
  const shared = args.shared
    .slice(0, MAX_SHARED)
    .map((s) => s.label)
    .join(', ');
  return `${hello} ${shared ? t.waOnlyShared(shared) : t.waGeneric}`;
}

export function whatsappLink(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
}
