"use client";

import { Sparkles, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { CREDITED_EVENT, FUNDING } from "./copy";
import type { CreditedDetail } from "./credited";
import "./funding.css";

/**
 * The reference's `CreditWelcome`: a one-time celebratory card when an address is credited for the first
 * time, auto-dismissed after eight seconds because it is a moment, not a wall. Routine credits after that
 * are a toast (`useFaucet` already raises one). Fired by `announceCredit`, never by a page.
 */
export function CreditWelcome() {
  const reduced = useReducedMotion();
  const [credit, setCredit] = useState<CreditedDetail | null>(null);

  useEffect(() => {
    const onCredited = (event: Event) => {
      const detail = (event as CustomEvent<CreditedDetail>).detail;
      if (!detail?.firstTime) return;
      setCredit(detail);
    };
    window.addEventListener(CREDITED_EVENT, onCredited);
    return () => window.removeEventListener(CREDITED_EVENT, onCredited);
  }, []);

  useEffect(() => {
    if (!credit) return;
    const timer = setTimeout(() => setCredit(null), 8_000);
    return () => clearTimeout(timer);
  }, [credit]);

  const close = () => setCredit(null);
  return (
    <AnimatePresence>
      {credit && (
        <motion.div className="credit-root" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="credit-scrim" onClick={close} />
          <motion.div
            className="credit-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="credit-title"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.97 }}
            transition={{ type: "spring", damping: 20, stiffness: 280 }}
          >
            <button type="button" onClick={close} aria-label={FUNDING.welcome.close} className="credit-close" data-cursor="hover">
              <X className="h-4 w-4" />
            </button>
            <motion.div
              className="credit-badge"
              initial={reduced ? { scale: 1 } : { scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", damping: 12, stiffness: 240, delay: 0.05 }}
            >
              <Sparkles className="h-6 w-6" />
            </motion.div>
            <span className="credit-eyebrow">{FUNDING.welcome.eyebrow}</span>
            <h2 id="credit-title" className="credit-title">
              {FUNDING.welcome.title(credit.amountText, credit.symbol)}
            </h2>
            <p className="credit-body">{FUNDING.welcome.body}</p>
            <button type="button" onClick={close} className="fund-cta-vermilion" data-cursor="hover">
              {FUNDING.welcome.cta}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
