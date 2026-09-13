"use client";

import { useEffect, useState } from "react";
import { STRATEGIES } from "./copy";
import { createDryReadSession, type DryRead } from "./dry-read-session";

export type { DryRead } from "./dry-read-session";

/** One click, one real model call; editing the draft makes any previous read obsolete. */
export function useDryRead(draftKey = "") {
  const [state, setState] = useState<DryRead>({ status: "idle" });
  const [session] = useState(() => createDryReadSession(setState, STRATEGIES.studio.agent.dry.unreadable));
  useEffect(() => { session.reset(); return session.cancel; }, [draftKey, session]);
  return { state, read: session.read, reset: session.reset };
}
