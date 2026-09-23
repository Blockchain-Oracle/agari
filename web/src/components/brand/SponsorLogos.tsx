/**
 * The two sponsors' own marks (S25, used with their permission): PreStocks' wordmark and hexagon as served by
 * prestocks.com (`/brand/sponsors/*.svg`, their violet), Pyth's mark and wordmark as its docs site draws them, inked in
 * `currentColor` so they take the surrounding text colour in either theme. Every mark carries its name for assistive tech.
 */
import { cn } from "@/lib/utils";

const PYTH_PATHS = [
  "M40.424 11.512a3.824 3.824 0 0 1-1.565 1.38c-.68.33-1.439.47-2.192.47H28.62v5.227h-2.402V5.4h10.449c.808 0 1.539.156 2.192.469.66.308 1.182.762 1.566 1.361.385.601.575 1.315.575 2.137 0 .821-.19 1.537-.575 2.144ZM38.71 9.386c0-.656-.218-1.161-.651-1.517-.435-.361-1.019-.541-1.754-.541h-7.78v4.108h7.78c.735 0 1.32-.179 1.754-.533.433-.361.651-.861.651-1.517ZM87.196 5.4v5.507h9.884V5.4h2.42v13.189h-2.42v-5.562h-9.884v5.562h-2.412V5.4ZM48.744 5.4l4.4 5.841h.051L57.59 5.4h2.902v.398l-6.143 7.828v4.959h-2.421v-4.959l-6.142-7.828V5.4ZM79.998 5.4v2.084h-6.149v11.105h-2.421V7.484h-6.149V5.4ZM11.857 9.599c0 1.325-1.072 2.4-2.394 2.4v2.4a4.794 4.794 0 0 0 4.787-4.8c0-2.651-2.144-4.8-4.787-4.8A4.797 4.797 0 0 0 4.676 9.6v12L7.07 24V9.6c0-1.325 1.071-2.4 2.393-2.4a2.397 2.397 0 0 1 2.394 2.4Z",
  "M9.464 0a9.51 9.51 0 0 0-4.787 1.285 9.591 9.591 0 0 0-2.393 1.966A9.577 9.577 0 0 0-.11 9.6v7.2l2.394 2.4V9.6a7.189 7.189 0 0 1 7.18-7.2c3.966 0 7.18 3.224 7.18 7.2s-3.216 7.2-7.18 7.2v2.4c5.288 0 9.573-4.298 9.573-9.6S14.752 0 9.464 0Z",
] as const;

type MarkProps = { className?: string; title?: string };

/** Pyth's "P" alone (`wordmark` adds the letters): the path set clipped to its first 20 units. */
export function PythLogo({ className, wordmark = false, title = "Pyth" }: MarkProps & { wordmark?: boolean }) {
  return (
    <svg viewBox={wordmark ? "0 0 100 24" : "0 0 20 24"} fill="currentColor" role={title ? "img" : undefined} aria-label={title || undefined} aria-hidden={title ? undefined : true} className={cn("sponsor-mark", className)}>
      {PYTH_PATHS.map((d) => (
        <path key={d.slice(0, 12)} d={d} />
      ))}
    </svg>
  );
}

/** PreStocks' hexagon (`wordmark` for the full lockup), as their site serves it. */
export function PreStocksLogo({ className, wordmark = false, title = "PreStocks" }: MarkProps & { wordmark?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element -- a fixed-colour vector at text size; next/image adds nothing
  return <img src={wordmark ? "/brand/sponsors/prestocks-logo.svg" : "/brand/sponsors/prestocks-mark.svg"} alt={title} className={cn("sponsor-mark", className)} />;
}
