import type { Dict } from '@/lib/i18n/en';

// Pre-filled WhatsApp message for the match page: leads with what the other person wants
// to talk about, then up to 3 shared interests. Written in the sender's language.

const MAX_SHARED = 3;

function list(items: string[], and: string): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`;
}

export function whatsappMessage(args: {
  t: Dict['match'];
  me: string;
  them: string;
  // An interest label (already translated) or the other person's own words.
  topic: { label: string } | { text: string } | null;
  shared: string[]; // translated labels
}): string {
  const { t, me, them, topic } = args;
  const shared = list(args.shared.slice(0, MAX_SHARED), t.and);
  const parts = [t.waHello(them, me)];
  if (topic) {
    parts.push(t.waTopic('label' in topic ? topic.label : `“${topic.text}”`));
    if (shared) parts.push(t.waShared(shared));
  } else {
    parts.push(shared ? t.waOnlyShared(shared) : t.waGeneric);
  }
  return parts.join(' ');
}

export function whatsappLink(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
}
