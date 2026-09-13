"use client";

// The thin line above the page.
//
// One statement at a time, quietly, changing only occasionally. It borrows the ticker's
// material rather than inventing a louder one, so it reads as furniture, and spends its
// single point of colour on the one word you might act on. It can be dismissed, which is
// the difference between a message and a nag; the dismissal sticks.
//
// Truth correction vs. the reference: Yosuku advertises a native iOS app here. Masayume has
// no native build (native is Blocked — no native source), so claiming one would be false.
// The installable PWA is real, and testnet collateral is a fact worth stating up front.
import { usePathname } from "next/navigation";
import Link from "next/link";
import { isIslandRoute } from "./ShellChrome";
import { useEffect, useState } from "react";

const KEY = "masayume.appstrip.dismissed";
const ROTATE_MS = 7000;

// Statements, not slogans. Each is a fact that survives being read twice.
const LINES = ["Masayume installs as a web app", "Somnia testnet — test funds only"];

export default function AppStrip() {
  const pathname = usePathname();
  const [gone, setGone] = useState(true); // assume dismissed until storage says otherwise: avoids a flash
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    try {
      setGone(localStorage.getItem(KEY) === "1");
    } catch {
      setGone(false);
    }
  }, []);

  useEffect(() => {
    if (gone) return;
    const t = setTimeout(() => setShown(true), 60); // let it arrive rather than snap in
    return () => clearTimeout(t);
  }, [gone]);

  useEffect(() => {
    if (gone || LINES.length < 2) return;
    const id = setInterval(() => setI((n) => (n + 1) % LINES.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [gone]);

  // A strip inviting you to the page you are already reading is noise.
  const hidden = gone || !!pathname?.startsWith("/download");

  // Tell the stylesheet whether the strip is actually there. Every fixed offset on the site is
  // computed off --appstrip, so when the strip is absent that height has to collapse or the
  // header hangs in empty space with nothing above it.
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.strip = hidden ? "off" : "on";
    return () => {
      delete el.dataset.strip;
    };
  }, [hidden]);

  if (hidden) return null;

  // Islands paint their own top edge; the strip would sit over it.
  if (isIslandRoute(pathname)) return null;

  return (
    <div className={`appstrip ${shown ? "is-in" : ""}`} role="region" aria-label="Install Masayume">
      <Link className="appstrip-msg" href="/download" data-cursor="hover">
        {/* A phone, not chevrons — the strip is about installing, so the mark is the thing
            itself. The pulse lives on the screen fill so it reads as a device waking up. */}
        <svg className="appstrip-lead" viewBox="0 0 14 20" aria-hidden="true">
          <rect x="1.2" y="1.2" width="11.6" height="17.6" rx="2.6" />
          <path d="M5.6 3.6h2.8" />
          <path d="M7 16.2h0.01" />
        </svg>
        {/* Keyed so React swaps the node and the CSS animation re-runs on each change. */}
        <span className="appstrip-line" key={i}>
          {LINES[i]}
        </span>
        <span className="appstrip-go">
          Get it
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </Link>
      <button
        type="button"
        className="appstrip-x"
        onClick={() => {
          try {
            localStorage.setItem(KEY, "1");
          } catch {
            /* storage unavailable — dismissal still applies for this page */
          }
          setGone(true);
        }}
        aria-label="Dismiss"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
