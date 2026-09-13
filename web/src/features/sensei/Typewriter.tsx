"use client";

import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";

const WORD_MS = 24;

/**
 * Sensei's reply revealing itself word by word — reference `SenseiDock.tsx` L42–58.
 *
 * Split on `(\s+)` so whitespace is its own token and the text reflows exactly as
 * it will when finished; splitting on words alone makes the paragraph jump each
 * time a line breaks.
 *
 * The reference reads `prefers-reduced-motion` once at module scope, so a change of
 * setting never reaches it and SSR sees the wrong value. This subscribes.
 */
export function Typewriter({ text, onDone, onType }: { text: string; onDone: () => void; onType?: () => void }) {
  const reduced = usePrefersReducedMotion();
  const words = text.split(/(\s+)/);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (reduced) {
      onDone();
      return;
    }
    setShown(0);
    let index = 0;
    const id = setInterval(() => {
      index += 1;
      setShown(index);
      onType?.();
      if (index >= words.length) {
        clearInterval(id);
        onDone();
      }
    }, WORD_MS);
    return () => clearInterval(id);
    // Restart only when the text itself changes; the callbacks are per-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, reduced]);

  if (reduced) return <>{text}</>;

  return (
    <>
      {words.slice(0, shown).join("")}
      {shown < words.length && <span className="sd-caret" aria-hidden />}
    </>
  );
}
