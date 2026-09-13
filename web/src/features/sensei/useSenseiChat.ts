"use client";

import { useCallback, useRef, useState } from "react";
import { SENSEI_INTRO, SENSEI_UI } from "./copy";
import type { SenseiMessage, SenseiSnapshot } from "./protocol";

/** 4+ asks inside 3 minutes is the reference's tilt cue for the brake (L182–183). */
const RESTLESS_WINDOW_MS = 180_000;
const RESTLESS_ASKS = 4;
/** The route enforces the same ceiling; trimming here keeps the request small too. */
const HISTORY_TURNS = 12;

export interface SenseiChat {
  messages: SenseiMessage[];
  loading: boolean;
  /** Index of the reply currently typing itself in, or -1. */
  typingIndex: number;
  send: (text: string) => Promise<void>;
  doneTyping: () => void;
}

/**
 * The conversation, and the one piece of judgement that lives on the client.
 *
 * `restless` is computed here because only the browser can see the *pace* of
 * asking — four questions in three minutes is a tilt cue, and the brake in
 * Sensei's system prompt is told about it. It is a count of local timestamps; no
 * identity is attached to it and nothing about it is stored.
 */
export function useSenseiChat(snapshot: SenseiSnapshot | null): SenseiChat {
  const [messages, setMessages] = useState<SenseiMessage[]>([SENSEI_INTRO]);
  const [loading, setLoading] = useState(false);
  const [typingIndex, setTypingIndex] = useState(-1);
  const sendTimes = useRef<number[]>([]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const now = Date.now();
      sendTimes.current = [...sendTimes.current, now].filter((stamp) => now - stamp < RESTLESS_WINDOW_MS);
      const restless = sendTimes.current.length >= RESTLESS_ASKS;

      const next: SenseiMessage[] = [...messages, { role: "user", content: trimmed }];
      setMessages(next);
      setLoading(true);

      try {
        const response = await fetch("/api/sensei", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            messages: next.slice(-HISTORY_TURNS).map(({ role, content }) => ({ role, content })),
            snapshot,
            restless,
          }),
        });
        const body = (await response.json()) as { reply?: string; error?: string };
        // An unconfigured or unreachable brain says so in Sensei's own voice and in
        // the thread, rather than as a toast the conversation does not account for —
        // but flagged, so nothing downstream mistakes the notice for a read.
        const ok = response.ok && Boolean(body.reply);
        const content = ok ? body.reply! : (body.error ?? SENSEI_UI.network);
        setMessages((prior) => [...prior, ok ? { role: "assistant", content } : { role: "assistant", content, failed: true }]);
        setTypingIndex(next.length);
      } catch {
        setMessages((prior) => [...prior, { role: "assistant", content: SENSEI_UI.network, failed: true }]);
      } finally {
        setLoading(false);
      }
    },
    [messages, snapshot, loading],
  );

  return { messages, loading, typingIndex, send, doneTyping: useCallback(() => setTypingIndex(-1), []) };
}
