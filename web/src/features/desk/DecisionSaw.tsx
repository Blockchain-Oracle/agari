"use client";

import { nameOf, type DeskRecordBody, type RecordEvidenceItem } from "@agari/core/desk";
import { ArrowRight, Check, CircleCheck, CircleX, OctagonAlert, X } from "lucide-react";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { RECORD } from "./copy-record";
import { DECISION } from "./decision/copy-decision";
import { PriceStrip } from "./decision/PriceStrip";
import { pct, tokensText, usdText } from "./format";

const D = RECORD.decision;
type Body = DeskRecordBody;
const find = <K extends RecordEvidenceItem["kind"]>(body: Body, kind: K) => body.evidence.find((e): e is Extract<RecordEvidenceItem, { kind: K }> => e.kind === kind);

/** Section 3 (plan §5.9): the price strip, then the prices and their age, the mark and the premium, Pyth's index when entitled, the drift, the cost at this size, the flags, the limits left. */
export function WhatItSaw({ body, ceilingBps = null }: { body: Body; ceilingBps?: number | null }) {
  const S = D.saw;
  const c = body.candidate;
  if (!c) return <p className="type-body text-ink-secondary">{S.nothing}</p>;
  const name = nameOf(c.symbol);
  const price = find(body, "price");
  const cost = find(body, "cost");
  const status = find(body, "status");
  const position = find(body, "position");
  const limits = find(body, "limits");
  const rows: Array<[string, string]> = [];
  if (price) {
    rows.push([`${S.price} · ${name}`, `${usdText(price.spot)} · ${price.referenceAgeSec === null ? S.ageUnknown : S.ageSec(price.referenceAgeSec)}`]);
    if (price.mark !== null) rows.push([S.mark, `${usdText(price.mark)}${price.premiumBps === null ? "" : ` · ${price.premiumBps >= 0 ? S.premium(pct(price.premiumBps)) : S.discount(pct(price.premiumBps))}`}`]);
    // A feed the venue may not read has no row: nothing on screen explains a licence (the owner's rule).
    if (price.index !== null) rows.push([S.index, `${usdText(price.index)}${price.indexPremiumBps === null ? "" : ` · ${pct(price.indexPremiumBps)}`}`]);
    rows.push([S.mean, `${usdText(price.mean30m)} · ${price.inLine ? S.inLine : S.gap(pct(price.gapBps))}`]);
  }
  if (position) rows.push([name, S.drift(pct(position.weightBps), pct(position.targetBps), pct(position.thresholdBps))]);
  if (cost) rows.push([S.cost, cost.costBps === null ? S.costNone : `${S.costValue(pct(cost.costBps))}${cost.routeAccounts === null ? "" : ` · ${S.route(cost.routeAccounts)}`}`]);
  if (status) rows.push([S.status, `${status.mintPaused === null ? S.pauseUnknown : status.mintPaused ? S.paused : S.open}${status.accountFrozen ? ` · ${S.frozen}` : ""} · ${S.reference} ${status.referenceFresh ? S.fresh : S.stale}`]);
  if (limits) rows.push([S.limitsLeft, S.limitsLine(usdText(limits.perActionCap), usdText(limits.remainingToday), usdText(limits.deskCash))]);
  return (
    <>
      {price && <PriceStrip spot={price.spot} mark={price.mark} mean30m={price.mean30m} index={price.index} ceilingBps={ceilingBps} />}
      <dl className="dc-facts">
        {rows.map(([label, value]) => (
          <div key={label} className="dc-fact">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {body.blockers.length > 0 && (
        <div className="dc-blockers">
          <span className="dc-subhead">{S.blockers}</span>
          {body.blockers.map((b) => (
            <p key={b.rule} className="dc-blocker"><OctagonAlert aria-hidden />{b.text}</p>
          ))}
        </div>
      )}
    </>
  );
}

/** Section 4: the chosen option raised and badged, each turned-down one beside it with its reason. */
export function Options({ body }: { body: Body }) {
  const O = D.options;
  const decision = body.timing?.decision ?? null;
  if (!decision) return <p className="type-body text-ink-secondary">{body.timing?.error ? RECORD.decision.happened.failed(body.timing.error) : O.noModel}</p>;
  return (
    <div className="dc-options">
      <div className="dc-option" data-chosen="">
        <span className="dc-option-head">
          <span className="dc-option-name">{O[decision.option]}{decision.partPercent ? ` · ${O.part(decision.partPercent)}` : ""}</span>
          <span className="dc-badge" data-tone="chosen"><Check aria-hidden />{DECISION.chosen}</span>
        </span>
        <p className="dc-option-headline">{decision.headline}</p>
        {decision.reasons.length > 0 && (
          <ul className="dc-reasons">
            {decision.reasons.map((r) => (
              <li key={r.text}>{r.text}</li>
            ))}
          </ul>
        )}
        {decision.waitFor && <p className="type-caption text-ink-secondary">{O.waitFor(decision.waitFor)}</p>}
      </div>
      {decision.rejected.length > 0 && (
        <div className="dc-options-rest">
          {decision.rejected.map((r) => (
            <div key={r.option} className="dc-option">
              <span className="dc-option-head">
                <span className="dc-option-name">{O[r.option]}</span>
                <span className="dc-badge"><X aria-hidden />{DECISION.turnedDown}</span>
              </span>
              <p className="type-caption text-ink-secondary">{r.reason}</p>
            </div>
          ))}
        </div>
      )}
      {decision.warnings.length > 0 && <p className="type-caption text-ink-muted">{O.warnings}: {decision.warnings.join(" ")}</p>}
    </div>
  );
}

function CheckRow({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <li className="dc-check" data-ok={ok ? "" : undefined}>
      {ok ? <CircleCheck aria-hidden /> : <CircleX aria-hidden />}
      <span className="dc-check-label">{label}</span>
      <b>{value}</b>
    </li>
  );
}

/** Section 5: "plain arithmetic, not an assistant", as a checklist. */
export function LimitsCheck({ body }: { body: Body }) {
  const L = D.limits;
  const g = body.gate;
  return (
    <>
      <p className="type-caption text-ink-muted">{L.arithmetic}</p>
      {!g ? (
        <p className="type-body text-ink-secondary">{L.nothing}</p>
      ) : (
        <>
          <p className="dc-gate" data-ok={g.result === "allow" ? "" : undefined}>
            {g.result === "allow" ? <CircleCheck aria-hidden /> : <CircleX aria-hidden />}
            {g.result === "allow" ? L.passed : L.refused(g.reasons.join("; "))}
          </p>
          <ul className="dc-checks">
            {g.reasons.map((r) => (
              <CheckRow key={r} ok={false} label={r} value={DECISION.refused} />
            ))}
            <CheckRow ok={g.result === "allow"} label={L.counted} value={usdText(g.counted)} />
            <CheckRow ok={g.result === "allow"} label={L.floor} value={body.candidate?.side === "sell" ? usdText(g.oracleFloor) : tokensText(g.oracleFloor)} />
            <CheckRow ok={g.premiumOk} label={L.premiumOk} value={g.premiumOk ? L.ok : L.no} />
          </ul>
        </>
      )}
    </>
  );
}

function Leg({ symbol, label, value }: { symbol: string | null; label: string; value: string }) {
  return (
    <div className="dc-leg">
      <span className="dc-leg-mark" aria-hidden>{symbol ? <AssetDisc asset={symbol} className="dc-leg-disc" /> : <span className="dc-leg-usdc">$</span>}</span>
      <span className="dc-leg-text">
        <span className="dc-leg-label">{label}</span>
        <b>{value}</b>
      </span>
    </div>
  );
}

/** Section 6: the cost, shown before acting — the spend flowing into what it should receive, then the fine print. */
export function CostShown({ body }: { body: Body }) {
  const C = D.cost;
  const p = body.preview;
  const c = body.candidate;
  const sell = c?.side === "sell";
  if (!p) return null;
  const sym = c?.symbol ?? "";
  const spend = sell ? `${tokensText(p.amountIn)} ${sym}` : `${usdText(p.amountIn)} USDC`;
  const receive = sell ? `${usdText(p.expectedOut)} USDC` : `${tokensText(p.expectedOut)} ${sym}`;
  return (
    <div className="dc-cost">
      <div className="dc-flow" aria-label={DECISION.flow}>
        <Leg symbol={sell ? sym : null} label={C.spend} value={spend} />
        <span className="dc-flow-arrow" aria-hidden><ArrowRight /></span>
        <Leg symbol={sell ? null : sym} label={C.receive} value={receive} />
      </div>
      <dl className="dc-facts">
        <div className="dc-fact"><dt>{C.least}</dt><dd>{sell ? `${usdText(p.minOut)} USDC` : `${tokensText(p.minOut)} ${sym}`}</dd></div>
        <div className="dc-fact"><dt>{C.slippage}</dt><dd>{pct(p.slippageBps)}</dd></div>
      </dl>
    </div>
  );
}
