"use client";

import type { Side } from "@masayume/core/types";
import { Button } from "@/components/ui/button";
import { TICKET } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { SIDE_CLASSES, SIDE_WORD, SIDES } from "../side-styles";

interface SideSegmentsProps {
  side: Side | null;
  onSelect: (side: Side) => void;
}

/** Tap-is-the-choice: the two sides read as one control, and the word never leaves the wash (color law). */
export function SideSegments({ side, onSelect }: SideSegmentsProps) {
  return (
    <div role="radiogroup" aria-label={TICKET.sideLabel} className="grid grid-cols-2 gap-2">
      {SIDES.map((option) => (
        <Button
          key={option}
          role="radio"
          aria-checked={side === option}
          aria-pressed={side === option}
          variant="outline"
          size="lg"
          onClick={() => onSelect(option)}
          className={cn("type-body-strong", SIDE_CLASSES[option])}
        >
          {SIDE_WORD[option]}
        </Button>
      ))}
    </div>
  );
}
