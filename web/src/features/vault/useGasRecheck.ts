"use client";

import { useSubmitter } from "@agari/markets/react";
import { useEffect } from "react";

const RECHECK_MS = 12_000;

/**
 * A wallet short of gas is re-checked on its own (S23): the flag used to clear only on the next write, which the
 * flag itself blocked. While `short`, the lane's gas check runs every 12 s and `clear` fires once it passes.
 */
export function useGasRecheck(short: boolean, lane: "vault" | "private", clear: () => void): void {
  const submitter = useSubmitter();
  useEffect(() => {
    if (!short || !submitter) return;
    let stopped = false;
    const tick = async () => {
      const gas = await submitter.checkGas(lane).catch(() => null);
      if (!stopped && gas?.ok) clear();
    };
    const id = window.setInterval(() => void tick(), RECHECK_MS);
    void tick();
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [short, submitter, lane, clear]);
}
