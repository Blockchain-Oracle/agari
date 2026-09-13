"use client";

import { ExternalLinkIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { DEMO } from "./copy";

/**
 * The page's small parts — ported from `reference/yosuku/app/demo/page.tsx` L17–43.
 *
 * `Reveal` is the reference's framer-motion `whileInView` rise (`{ once: true,
 * margin: '-80px' }`) as an IntersectionObserver flipping a data attribute; the
 * motion itself is CSS in `demo.css`, and a reader who asked for less of it gets the
 * content in place. No second animation library, as with the Tutorial and Trader Edge.
 */

/** The reference observes with `margin: '-80px'` — a block rises once its top clears the fold by that much. */
const REVEAL_MARGIN = 80;

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="demo-eyebrow">{children}</div>;
}

export function Serif({ children }: { children: ReactNode }) {
  return <span className="demo-serif">{children}</span>;
}

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** The hero's blocks rise on mount (`animate="show"`), not on scroll. */
  immediate?: boolean;
}

export function Reveal({ children, className, immediate = false }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (immediate) {
      setShown(true);
      return;
    }
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: `-${REVEAL_MARGIN}px` },
    );
    io.observe(element);
    return () => io.disconnect();
  }, [immediate]);

  return (
    <div ref={ref} className={cn("demo-reveal", className)} data-shown={shown || reduced}>
      {children}
    </div>
  );
}

export function Kicker({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="demo-kicker">
      {icon}
      <span className="demo-kicker-text">{children}</span>
    </div>
  );
}

interface FrameProps {
  src: string;
  alt: string;
  phone?: boolean;
  className?: string;
}

/**
 * A real capture of the running product, and it says when it was taken. The reference
 * frames its screenshots the same way; the caption is ours, because a picture of the
 * product is evidence only while it is dated.
 */
export function Frame({ src, alt, phone = false, className }: FrameProps) {
  return (
    <figure className={cn("demo-frame", phone && "phone", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a static capture; no optimisation pipeline needed */}
      <img src={src} alt={alt} />
      <figcaption className="demo-frame-caption">{DEMO.frame.caption(DEMO.capturedOn)}</figcaption>
    </figure>
  );
}

interface ProofLinkProps {
  href: string;
  label: string;
  /** The hash or address the link opens; its first characters are printed beside the label. */
  reference: string;
}

/** `ScanLink` in the reference: an explorer link with the head of its hash beside the label. */
export function ProofLink({ href, label, reference }: ProofLinkProps) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="demo-proof-link" data-cursor="hover">
      <ExternalLinkIcon className="demo-proof-icon" aria-hidden />
      <span>{label}</span>
      <span className="demo-proof-hash numbers">{reference.slice(0, 8)}…</span>
    </a>
  );
}
