"use client";

import { roundsToCsv, type SettledRound } from "@masayume/core/projection";
import { useCallback } from "react";
import { notify } from "@/lib/toast";
import { HISTORY } from "./copy";

/** Builds the CSV in the browser from the rows on screen — the same rounds, full precision, no server. */
export function useCsvDownload(rounds: readonly SettledRound[], address: string) {
  return useCallback(() => {
    try {
      const blob = new Blob([roundsToCsv(rounds)], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = HISTORY.csvName(address);
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      notify.warning(HISTORY.csvFailed);
    }
  }, [rounds, address]);
}
