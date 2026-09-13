// The Masayume mark: 正夢 — "the dream that comes true".
//
// A crescent (the dream) opening upward into a single vermilion point (the call that
// landed). Identity is the one thing that is ours rather than the reference's, so the
// glyph is Masayume's own — but it keeps the reference's drawing grammar exactly: the
// same 266×322 footprint the shell CSS sizes against, rounded caps, confident stroke
// weights, figure on currentColor so it is cream on ink and ink on cream, and exactly
// one vermilion accent.
//
// Single source of truth. Every surface that shows the mark imports this.
export default function MasayumeMark({
  className,
  figure = "currentColor",
  dot = "var(--vermilion)",
  title,
}: {
  className?: string;
  /** colour of the figure. Defaults to currentColor so it follows the theme. */
  figure?: string;
  /** colour of the realised point. Defaults to the vermilion token. */
  dot?: string;
  /** accessible name; when omitted the mark is decorative (aria-hidden). */
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 266 322"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      {/* The crescent: an arc open at the top, the dream still unclosed. It carries the
          whole mark on its own — an interior stem muddles into an anchor at the size the
          header actually renders it, which is under twenty device pixels wide. */}
      <path
        d="M56 120 A 88 88 0 1 0 210 120"
        stroke={figure}
        fill="none"
        strokeWidth="34"
        strokeLinecap="round"
      />
      {/* the realised point, held in the crescent's opening */}
      <circle cx="133" cy="62" r="30" style={{ fill: dot }} />
    </svg>
  );
}
