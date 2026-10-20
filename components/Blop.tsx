import type { Category } from '@/lib/interests';

// The BLOP mascot drawn in SVG. Each participant's Blop wears the accessory of their top
// interest category (lib/avatar.ts); null draws the plain Blop.
// Gradient ids are fixed, so repeated <Blop>s on one page share identical definitions.

const OUTLINE = '#6a4fd0';
const INK = '#2a1f4a';

export default function Blop({
  variant,
  label,
  className = '',
}: {
  variant: Category | null;
  label?: string; // omit when the Blop is decorative (e.g. inside a labelled link)
  className?: string;
}) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  return (
    <svg viewBox="-4 -14 212 214" {...a11y} className={className}>
      <defs>
        <linearGradient id="blop-body" x1="0.15" y1="0.1" x2="0.85" y2="0.95">
          <stop offset="0" stopColor="#f6d3f6" />
          <stop offset="0.45" stopColor="#d2bdf8" />
          <stop offset="1" stopColor="#a9b8f6" />
        </linearGradient>
        <radialGradient id="blop-glow" cx="0.4" cy="0.35" r="0.6">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {variant === 'sports' && <Ball />}

      {/* body */}
      <path
        d="M44 156c-12-2-15-24-10-52C42 58 70 34 104 34c36 0 62 26 66 64 2 16 3 26 10 33 9 9 3 25-12 24-14 4-30 3-46 5-22 2-44 1-58-1-8-1-14-1-20-3Z"
        fill="url(#blop-body)"
        stroke={OUTLINE}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M44 156c-12-2-15-24-10-52C42 58 70 34 104 34c36 0 62 26 66 64 2 16 3 26 10 33 9 9 3 25-12 24-14 4-30 3-46 5-22 2-44 1-58-1-8-1-14-1-20-3Z"
        fill="url(#blop-glow)"
      />
      {/* shine and sparkles on the skin */}
      <ellipse cx="72" cy="58" rx="13" ry="7" fill="#fff" opacity="0.75" transform="rotate(-25 72 58)" />
      <circle cx="94" cy="50" r="3" fill="#fff" opacity="0.7" />
      <circle cx="150" cy="128" r="2.5" fill="#fff" opacity="0.6" />
      <circle cx="140" cy="140" r="1.8" fill="#fff" opacity="0.6" />
      <circle cx="62" cy="140" r="2" fill="#fff" opacity="0.6" />

      {/* cheeks */}
      <ellipse cx="68" cy="116" rx="11" ry="7" fill="#f59ac0" opacity="0.55" />
      <ellipse cx="146" cy="116" rx="11" ry="7" fill="#f59ac0" opacity="0.55" />

      {variant === 'hobbies' ? <Glasses3D /> : <Eyes />}

      {/* smile */}
      <path d="M96 114c2 9 20 9 22 0Z" fill={INK} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M101 119c3 3 10 3 13 0-3-2-10-2-13 0Z" fill="#f27a9a" />

      {variant === 'music' && <Headphones />}
      {variant === 'sports' && <Headband />}
      {variant === 'food' && <ChefHat />}
    </svg>
  );
}

function Eyes() {
  return (
    <g>
      <circle cx="84" cy="96" r="11" fill={INK} />
      <circle cx="130" cy="96" r="11" fill={INK} />
      <circle cx="88" cy="91" r="4" fill="#fff" />
      <circle cx="134" cy="91" r="4" fill="#fff" />
      <circle cx="80" cy="101" r="1.8" fill="#fff" opacity="0.8" />
      <circle cx="126" cy="101" r="1.8" fill="#fff" opacity="0.8" />
    </g>
  );
}

function Headphones() {
  return (
    <g>
      <path d="M40 104C40 52 72 24 107 24s67 28 67 80" fill="none" stroke="#1e1530" strokeWidth="9" strokeLinecap="round" />
      <path d="M40 104C40 52 72 24 107 24s67 28 67 80" fill="none" stroke="#5b3cf5" strokeWidth="3" strokeLinecap="round" />
      <rect x="26" y="90" width="24" height="38" rx="11" fill="#1e1530" />
      <rect x="164" y="90" width="24" height="38" rx="11" fill="#1e1530" />
      <rect x="31" y="97" width="9" height="24" rx="4.5" fill="#e3a6f5" />
      <rect x="174" y="97" width="9" height="24" rx="4.5" fill="#e3a6f5" />
      <path d="M190 70l6-4v14" fill="none" stroke="#5b3cf5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="192" cy="81" r="4" fill="#5b3cf5" />
    </g>
  );
}

function Headband() {
  return (
    <g>
      <path d="M46 74c34-18 88-20 120-2l-2 15c-34-16-82-15-116 2Z" fill="#d4f53c" stroke="#1e1530" strokeWidth="3" strokeLinejoin="round" />
      <path d="M58 76c28-11 70-12 98-1" fill="none" stroke="#1e1530" strokeWidth="2" opacity="0.35" />
      {/* sweat drop */}
      <path d="M163 96c4 6 6 10 6 13a6 6 0 0 1-12 0c0-3 2-7 6-13Z" fill="#7cc7ff" stroke="#3f8fd8" strokeWidth="1.5" />
    </g>
  );
}

function Ball() {
  return (
    <g>
      <circle cx="176" cy="168" r="17" fill="#fff" stroke="#1e1530" strokeWidth="3" />
      <path d="M176 159l8 5-3 10h-10l-3-10Z" fill="#1e1530" />
      <path d="M176 151v8M184 164l8-3M181 174l5 8M171 174l-5 8M168 164l-8-3" stroke="#1e1530" strokeWidth="2" />
    </g>
  );
}

function ChefHat() {
  return (
    <g>
      <rect x="74" y="34" width="62" height="22" rx="5" fill="#fff" stroke="#1e1530" strokeWidth="3" />
      <path
        d="M76 38c-16-2-22-20-10-28 6-4 14-3 18 1 3-10 15-15 25-10 8-8 22-6 27 4 12-2 20 12 12 22-3 6-10 9-16 9Z"
        fill="#fff"
        stroke="#1e1530"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M92 40v12M106 40v12M120 40v12" stroke="#d9d4e6" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

function Glasses3D() {
  return (
    <g>
      <path d="M50 78h112l-2 28H120l-6-7h-14l-6 7H52Z" fill="#fff" stroke="#1e1530" strokeWidth="3" strokeLinejoin="round" />
      <rect x="60" y="84" width="34" height="16" rx="4" fill="#e53950" opacity="0.9" />
      <rect x="120" y="84" width="34" height="16" rx="4" fill="#2f6bff" opacity="0.9" />
      <path d="M50 82l-12 6M162 82l12 6" stroke="#1e1530" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}
