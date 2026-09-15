"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The line under a held control (D-095). The disabled control already says "Not available in your
 * region" — its label IS the blocker — so this note only adds what the visitor can still do and where
 * to read why. One component so the sentence is written once for the ticket, the schedule, the faucet,
 * the private desk and trade-from-x.
 */
export const REGION_NOTE = {
  line: "Funded actions are closed in your region. Reading stays open.",
  link: "How it works",
  href: "/how-it-works",
} as const;

export function RegionNote({ className }: { className?: string }) {
  return (
    <p className={cn("type-caption text-ink-secondary", className)}>
      {REGION_NOTE.line}{" "}
      <Link href={REGION_NOTE.href} className="text-ink underline underline-offset-2" data-cursor="hover">
        {REGION_NOTE.link}
      </Link>
    </p>
  );
}
