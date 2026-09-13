"use client";

import type { ReactNode } from "react";
import { EmptyState } from "@/components/states";
import { BALANCE } from "@/lib/copy";
import { BalancePlateView } from "./BalancePlateView";
import { useBalancePlate } from "./useBalancePlate";

interface BalancePlateProps {
  /** Pool controls folded into their rows — /portfolio mounts the Trading Balance here; /markets lists the row alone. */
  panels?: { vault?: ReactNode };
  className?: string;
}

/** The live plate for the connected wallet; disconnected says so instead of showing zeros. */
export function BalancePlate({ panels, className }: BalancePlateProps) {
  const state = useBalancePlate();
  if (state.kind === "disconnected") return <EmptyState why={BALANCE.connect.why} className={className} />;
  return <BalancePlateView reading={state.reading} symbol={state.symbol} retry={state.retry} panels={panels} className={className} />;
}
