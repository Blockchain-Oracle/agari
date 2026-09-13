"use client";

import { Dialog } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWalletSession } from "@/lib/wallet-session";
import { TutorialChoice } from "./TutorialChoice";
import { TUTORIAL_STEPS, TUTORIAL_UI } from "./steps";
import { useFirstRun } from "./useFirstRun";

/**
 * The first-run walkthrough — ported from reference/yosuku/components/Tutorial.tsx.
 *
 * The reference is a hand-rolled `fixed inset-0` div with a framer-motion card.
 * As with the Toast, the Base UI primitive stays and takes the reference's
 * presentation: it brings the focus trap, the labelled dialog role, inert
 * background and Escape/backdrop dismissal that the reference re-implements
 * partially (it wires Escape and a backdrop click by hand, and traps nothing).
 * Step-to-step motion is CSS keyed on the step, not a second animation library.
 *
 * On `--white`: this card's surface flips with the theme — `bg-neutral-900/95` is
 * remapped to cream in yosuku/part-14.css — so `text-white` is correct ink here.
 * That is the question to ask before writing it anywhere (see RESUME.md).
 */
export function Tutorial() {
  const { open, dismiss } = useFirstRun();
  const [step, setStep] = useState(0);
  const { address } = useWalletSession();
  const popupRef = useRef<HTMLDivElement>(null);

  const isLast = step === TUTORIAL_STEPS.length - 1;
  const current = TUTORIAL_STEPS[step];

  // The walkthrough ends by connecting. The moment that happens on the closing
  // screen, onboarding is done, so close and leave the user on the live markets.
  useEffect(() => {
    if (open && isLast && address) dismiss();
  }, [open, isLast, address, dismiss]);

  if (!open || !current) return null;

  return (
    <Dialog.Root
      open
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="tutorial-scrim" />
        <Dialog.Popup
          ref={popupRef}
          /* Default focus lands on the first tabbable element, which here is Close —
             so a welcome screen opens by pointing at the way out. Focus the dialog
             itself: the screen reader still announces the title, and Tab reaches
             Skip and Next in reading order. */
          initialFocus={popupRef}
          className="tutorial-card rounded-2xl border border-white/10 bg-neutral-900/95 backdrop-blur-xl"
        >
          {/* key={step} restarts the entry animation, the job the reference gives AnimatePresence */}
          <div key={step} className="tutorial-step">
            <div className="flex items-start justify-between gap-3 px-8 pt-8 pb-3">
              <Dialog.Title className="font-display text-2xl font-bold text-white">{current.title}</Dialog.Title>
              <Dialog.Close
                render={<Button variant="ghost" size="icon-sm" className="-mt-1 -mr-2 text-gray-600 hover:text-white" />}
                aria-label={TUTORIAL_UI.close}
              >
                <XIcon />
              </Dialog.Close>
            </div>

            <div className="px-8 py-5">
              {current.choice ? (
                <TutorialChoice description={current.description} />
              ) : (
                <Dialog.Description className="text-base leading-relaxed text-gray-400">
                  {current.description}
                </Dialog.Description>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between px-8 pb-8">
            <ol className="flex gap-1.5" aria-label={TUTORIAL_UI.progress(step + 1, TUTORIAL_STEPS.length)}>
              {TUTORIAL_STEPS.map((s, i) => (
                <li
                  key={s.title}
                  aria-current={i === step ? "step" : undefined}
                  className={cn(
                    "h-1 rounded-full transition-all",
                    i === step ? "w-6 bg-vermilion" : i < step ? "w-2 bg-white/20" : "w-2 bg-white/10",
                  )}
                />
              ))}
            </ol>

            <div className="flex gap-2">
              <Button variant="ghost" onClick={dismiss} className="text-gray-500 hover:text-white">
                {TUTORIAL_UI.skip}
              </Button>
              {/* The closing screen ends on Connect, so it carries no Next of its own. */}
              {!current.choice && (
                <Button
                  className="rounded-lg text-sm font-bold tracking-wider uppercase"
                  onClick={() => (isLast ? dismiss() : setStep(step + 1))}
                >
                  {isLast ? TUTORIAL_UI.done : TUTORIAL_UI.next}
                </Button>
              )}
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
