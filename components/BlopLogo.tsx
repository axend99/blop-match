// "blop" wordmark: the "o" is the pair of overlapping violet and pink circles.
export default function BlopLogo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center text-2xl font-bold tracking-tight text-midnight ${className}`}>
      <span aria-hidden="true" className="inline-flex items-center">
        bl
        <svg viewBox="0 0 34 20" className="mx-px h-[0.8em] w-[1.36em]">
          <circle cx="10" cy="10" r="10" fill="#5b3cf5" fillOpacity="0.85" />
          <circle cx="24" cy="10" r="10" fill="#e3a6f5" fillOpacity="0.8" />
        </svg>
        p
      </span>
      <span className="sr-only">BLOP</span>
    </span>
  );
}
