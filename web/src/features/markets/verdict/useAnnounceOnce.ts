import { useEffect, useRef, useState } from "react";

/** Fills a polite live region once per mount, so a verdict is announced exactly once per settlement (UX-DR16). */
export function useAnnounceOnce(text: string): string {
  const first = useRef(text);
  const [announced, setAnnounced] = useState("");
  useEffect(() => {
    setAnnounced(first.current);
  }, []);
  return announced;
}
