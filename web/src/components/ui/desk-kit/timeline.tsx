"use client";

import { Check } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The desk kit's sequences (S22, D-127), from 21st: Interactive Timeline (#28276) and Agent Activity (#29318) for the
 * record, Onboarding Steps with Progress (#29458) for the studio, and Empty State (#1435).
 */

export type NodeTone = "acted" | "declined" | "quiet" | "asked" | "stopped" | "error" | "neutral";

/** A vertical rail of nodes; children are `TimelineNode`s and `TimelineDay` labels. Entries rise in, one after another. */
export function Timeline({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <ol className={cn("dkit-timeline", className)} aria-label={label}>
      {children}
    </ol>
  );
}

export function TimelineDay({ children }: { children: ReactNode }) {
  return <li className="dkit-timeline-day">{children}</li>;
}

export function TimelineNode({ icon, tone, index = 0, children, className }: { icon: ReactNode; tone: NodeTone; index?: number; children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.li
      className={cn("dkit-timeline-node", className)}
      data-tone={tone}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: reduce ? 0 : Math.min(index, 10) * 0.035, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="dkit-timeline-icon" aria-hidden>{icon}</span>
      <div className="dkit-timeline-body">{children}</div>
    </motion.li>
  );
}

export interface StepItem {
  label: string;
  hint?: string;
}

/** Numbered steps joined by a progress line; done steps show a check and can be revisited, later ones cannot. */
export function StepProgress({ steps, current, onPick, label }: { steps: readonly StepItem[]; current: number; onPick: (step: number) => void; label: string }) {
  const reduce = useReducedMotion();
  const fraction = steps.length > 1 ? (current - 1) / (steps.length - 1) : 0;
  return (
    <nav className="dkit-steps" aria-label={label}>
      <div className="dkit-steps-rail" aria-hidden>
        <motion.span className="dkit-steps-rail-fill" initial={false} animate={{ scaleX: fraction }} transition={{ duration: reduce ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }} />
      </div>
      <ol>
        {steps.map((s, i) => {
          const n = i + 1;
          const state = n < current ? "done" : n === current ? "current" : "next";
          return (
            <li key={s.label} data-state={state} aria-current={state === "current" ? "step" : undefined}>
              <button type="button" disabled={state !== "done"} onClick={() => onPick(n)}>
                <span className="dkit-step-badge">{state === "done" ? <Check className="size-3.5" strokeWidth={3} /> : n}</span>
                <span className="dkit-step-text">
                  <span className="dkit-step-label">{s.label}</span>
                  {s.hint && <span className="dkit-step-hint">{s.hint}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** A calm empty state: a mark, a line, a sentence and an optional action. */
export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="dkit-empty">
      <span className="dkit-empty-icon" aria-hidden>{icon}</span>
      <p className="dkit-empty-title">{title}</p>
      {body && <p className="dkit-empty-body">{body}</p>}
      {action}
    </div>
  );
}
