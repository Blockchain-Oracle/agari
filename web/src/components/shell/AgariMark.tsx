// Window Cut: a market window interrupted by the outcome that breaks its edge.
// Keep this geometry aligned with brand/agari-mark.svg and the docs/X renderers.
export const AGARI_MARK_FIGURE = "M0 0H151L183 32V61H139V44H44V176H176V82H220V220H0Z";
export const AGARI_MARK_OUTCOME = "M173 0H220V47Z";

export default function AgariMark({
  className,
  figure = "currentColor",
  accent = "var(--vermilion)",
  title,
}: {
  className?: string;
  /** Colour of the window. Defaults to currentColor so it follows the theme. */
  figure?: string;
  /** Colour of the separated outcome corner. */
  accent?: string;
  /** Accessible name; when omitted the mark is decorative. */
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 220 220"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      <path d={AGARI_MARK_FIGURE} fill={figure} />
      <path d={AGARI_MARK_OUTCOME} fill={accent} />
    </svg>
  );
}
