/** A caret, drawn rather than typed (reference `components/portfolio/Chevron.tsx`). */
export function Chevron({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 1.5L7 5L3.5 8.5" />
    </svg>
  );
}
