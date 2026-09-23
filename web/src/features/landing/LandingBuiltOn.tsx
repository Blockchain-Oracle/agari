"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { PreStocksLogo, PythLogo } from "@/components/brand/SponsorLogos";
import { proofHref } from "@/lib/routes";
import { namesLine, type SourceTally } from "./built-on";
import { LANDING } from "./copy";
import { useBuiltOn } from "./useBuiltOn";
import "./built-on.css";

const COUNT = new Intl.NumberFormat("en-US");

interface ColumnProps {
  /** The sponsor's own wordmark; its alt text is the name. */
  logo: ReactNode;
  figure: string;
  tally: SourceTally | null;
  what: string | null;
  proof: string | null;
  /** The line under the figure while the count is not in: reading, or the index's silence. */
  pending: string;
}

function Column({ logo, figure, tally, what, proof, pending }: ColumnProps) {
  const { builtOn } = LANDING;
  return (
    <div className="lp-built-col">
      <p className="lp-built-name">{logo}</p>
      <p className="lp-built-figure">
        <span className="lp-built-num numbers">{tally ? COUNT.format(tally.windows) : "—"}</span>
        <span className="lp-built-unit">
          {figure} <span className="lp-built-since">{builtOn.since}</span>
        </span>
      </p>
      {(what ?? pending) && <p className="lp-built-what">{what ?? pending}</p>}
      {proof && (
        <Link href={proofHref(proof)} className="lp-link lp-built-proof" data-cursor="hover">
          {builtOn.proof}
        </Link>
      )}
    </div>
  );
}

/**
 * The band under the hero (S25): the two sources the venue's Windows settle on, by their own wordmarks, each with the
 * count of Windows its prints closed and a link to the newest one's print proof. The figures are the index's print mix
 * (`/status`'s read), so nothing here is written by hand.
 */
export function LandingBuiltOn() {
  const { builtOn } = LANDING;
  const reading = useBuiltOn();
  const value = reading?.ok ? reading.value : null;
  const pending = reading === null ? builtOn.reading : value ? "" : builtOn.unread;
  const pre = value?.tally.prestocks ?? null;
  const pyth = value?.tally.pyth ?? null;
  return (
    <div className="lp-built">
      <p className="section-eyebrow lp-built-label">{builtOn.label}</p>
      <Column
        logo={<PreStocksLogo wordmark title={builtOn.prestocks.name} className="lp-built-logo is-prestocks" />}
        figure={builtOn.prestocks.figure}
        tally={pre}
        what={pre && pre.windows > 0 ? builtOn.prestocks.what(namesLine(pre.names), pre.baskets.length) : null}
        proof={value?.proof.prestocks ?? null}
        pending={pending}
      />
      <Column
        logo={<PythLogo wordmark title={builtOn.pyth.name} className="lp-built-logo is-pyth" />}
        figure={builtOn.pyth.figure}
        tally={pyth}
        what={pyth && pyth.windows > 0 ? builtOn.pyth.what(namesLine(pyth.names)) : null}
        proof={value?.proof.pyth ?? null}
        pending={pending}
      />
    </div>
  );
}
