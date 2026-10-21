'use client';

// The match page's contact buttons. They stay plain links (they work without JavaScript);
// a tap is also reported for the study's metrics, without delaying the link.
function report(matchId: string, channel: 'whatsapp' | 'instagram') {
  const body = JSON.stringify({ matchId, channel });
  try {
    if (navigator.sendBeacon?.('/api/contact-click', body)) return;
  } catch {
    // fall back below
  }
  fetch('/api/contact-click', { method: 'POST', body, keepalive: true, credentials: 'same-origin' }).catch(() => {});
}

export default function ContactButtons({
  matchId,
  whatsapp,
  instagram,
  labels,
}: {
  matchId: string;
  whatsapp: string | null;
  instagram: string | null;
  labels: { whatsapp: string; instagram: string };
}) {
  return (
    <div className="space-y-3">
      {whatsapp && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => report(matchId, 'whatsapp')}
          className="block rounded-full bg-[#25d366] px-6 py-4 text-lg font-semibold text-midnight"
        >
          {labels.whatsapp}
        </a>
      )}
      {instagram && (
        <a
          href={instagram}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => report(matchId, 'instagram')}
          className="block rounded-full bg-violet px-6 py-4 text-lg font-semibold text-white"
        >
          {labels.instagram}
        </a>
      )}
    </div>
  );
}
