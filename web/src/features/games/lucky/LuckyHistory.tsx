"use client";

import { isOk } from "@masayume/core/schemas";
import { formatBaseUnits } from "@masayume/core/units";
import { txUrl } from "@masayume/core/urls";
import { Pager } from "@/components/chrome";
import { Hash, useNowMs } from "@/components/data";
import { useVenue } from "@/features/markets";
import { timeAgo } from "@/features/markets/history/time-ago";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { usePager } from "@/lib/use-pager";
import { useWalletSession } from "@/lib/wallet-session";
import { GAMES } from "../copy";
import { LUCKY } from "./copy";
import type { LuckyRowWire } from "./lucky-wire";
import { useLuckyHistory } from "./useLuckyHistory";
import "../duel/duel.css";
import "./lucky.css";

/** Eight spins a page, the portfolio's own page size, with the shared pager beneath. */
const PAGE_SIZE = 8;
const NO_ROWS: readonly LuckyRowWire[] = [];

/**
 * The Lucky section of `/games/history`: every spin this wallet made, newest first, in the duel's row
 * grammar — the result word the chain (or the book, or the player) gave it, the draw, what was staked
 * and what the tape measured, the transaction, and when. Under the title, the streak the settled rows
 * add up to. Nothing here is a verdict the chain has not given: a live row says live, an unconfirmed
 * send says so, and a refusal names its reason.
 */
export function LuckyHistory() {
  const { address } = useWalletSession();
  const { boot } = useVenue();
  const nowMs = useNowMs();
  const { feed } = useLuckyHistory(address ?? null);
  const pager = usePager(feed?.rows ?? NO_ROWS, PAGE_SIZE);
  const words = LUCKY.history;
  const decimals = boot && isOk(boot) ? boot.value.collateral.decimals : null;
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "";
  const money = (base: string | null) => (base === null || decimals === null ? "—" : formatBaseUnits(BigInt(base), decimals, { maxDp: 2, minDp: 0 }));

  return (
    <section className="container gm-page" aria-label={words.title}>
      <header className="du-head lk-history-head">
        <div>
          <span className="gm-eyebrow">{LUCKY.eyebrow}</span>
          <h2 className="du-title">
            {words.title}
            <span className="accent">.</span>
          </h2>
        </div>
        {feed?.configured && (
          <p className="lk-history-streak">
            <span>
              {words.streak}
              <b>{feed.streak}</b>
            </span>
            <span>
              {words.best}
              <b>{feed.best}</b>
            </span>
          </p>
        )}
      </header>
      {!address ? (
        <p className="du-body">{words.connect}</p>
      ) : feed === null ? (
        <p className="du-body">{words.loading}</p>
      ) : !feed.configured ? (
        <p className="du-refusal">{words.notConfigured}</p>
      ) : feed.rows.length === 0 ? (
        <p className="du-body">{words.empty}</p>
      ) : (
        <>
          <ul className="du-history">
            {pager.slice.map((row) => (
              <li key={row.drawId}>
                <div className="du-history-row" data-verdict={verdictOf(row)}>
                  <span className="du-history-verdict">{words.results[row.result] ?? row.result}</span>
                  <span className="du-history-main">
                    <span className="du-v">{row.asset && row.side && row.multiplier ? words.line(row.asset, SIDE_WORD[row.side], row.multiplier) : words.undealt}</span>
                    <span className="du-k">
                      {row.costBase ? words.cost(money(row.costBase), symbol) : words.stake(money(row.stakeBase), symbol)}
                      {row.quantityRaw ? ` · ${words.contracts(money(row.quantityRaw))}` : ""}
                      {row.refusal && (row.result === "refused" || row.result === "unknown") ? ` · ${words.refusal[row.refusal] ?? row.refusal}` : ""}
                    </span>
                  </span>
                  <span className="lk-history-side">
                    {row.txHash ? (
                      <span className="du-v">
                        <Hash value={row.txHash} href={txUrl(row.txHash)} />
                      </span>
                    ) : (
                      <span className="du-v">—</span>
                    )}
                    <span className="du-k">{nowMs > 0 && row.createdAtMs > 0 ? timeAgo(row.createdAtMs, nowMs) : ""}</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <Pager pager={pager} className="lk-pager" />
        </>
      )}
      <p className="du-foot">{GAMES.history.body}</p>
    </section>
  );
}

/** The row's colour follows the chain's word, not the player's hope: won and lost only; everything else is the row's own hue. */
function verdictOf(row: LuckyRowWire): string {
  if (row.result === "won" || row.result === "lost") return row.result;
  if (row.result === "pending" || row.result === "placed") return "live";
  return row.result;
}
