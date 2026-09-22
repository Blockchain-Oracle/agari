"use client";

import { nameOf, type DeskRecordBody, type RecordEvidenceItem } from "@agari/core/desk";
import { RECORD } from "./copy-record";
import { pct, tokensText, usdText } from "./format";

const D = RECORD.decision;
type Body = DeskRecordBody;
const find = <K extends RecordEvidenceItem["kind"]>(body: Body, kind: K) => body.evidence.find((e): e is Extract<RecordEvidenceItem, { kind: K }> => e.kind === kind);

/** Section 3 (plan §5.9): the prices and their age, the mark and the premium, Pyth's index when entitled, the drift, the cost at this size, the flags, the limits left. */
export function WhatItSaw({ body }: { body: Body }) {
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
      <div className="dk-rows">
        {rows.map(([label, value]) => (
          <div key={label} className="dk-row"><span>{label}</span><span className="text-right text-ink">{value}</span></div>
        ))}
      </div>
      {body.blockers.length > 0 && (
        <div>
          <span className="dk-panel-title">{S.blockers}</span>
          {body.blockers.map((b) => (
            <p key={b.rule} className="type-body dk-warn">{b.text}</p>
          ))}
        </div>
      )}
    </>
  );
}

/** Section 4: the four options, the chosen one marked, each turned-down one with its reason. */
export function Options({ body }: { body: Body }) {
  const O = D.options;
  const decision = body.timing?.decision ?? null;
  if (!decision) return <p className="type-body text-ink-secondary">{body.timing?.error ? RECORD.decision.happened.failed(body.timing.error) : O.noModel}</p>;
  return (
    <div className="dk-options">
      <div className="dk-option" data-chosen="">
        <span className="dk-outcome" data-tone="acted">{O[decision.option]}{decision.partPercent ? ` · ${O.part(decision.partPercent)}` : ""} · {O.chosen}</span>
        <p className="type-body text-ink">{decision.headline}</p>
        {decision.reasons.map((r) => (
          <p key={r.text} className="type-caption text-ink-secondary">{r.text}</p>
        ))}
        {decision.waitFor && <p className="type-caption text-ink-secondary">{O.waitFor(decision.waitFor)}</p>}
      </div>
      {decision.rejected.map((r) => (
        <div key={r.option} className="dk-option">
          <span className="dk-outcome" data-tone="quiet">{O[r.option]} · {O.turnedDown}</span>
          <p className="type-caption text-ink-secondary">{r.reason}</p>
        </div>
      ))}
      {decision.warnings.length > 0 && (
        <p className="type-caption text-ink-muted">{O.warnings}: {decision.warnings.join(" ")}</p>
      )}
    </div>
  );
}

/** Section 5: "plain arithmetic, not an assistant". */
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
          <p className={g.result === "allow" ? "type-body text-ink" : "type-body dk-warn"}>{g.result === "allow" ? L.passed : L.refused(g.reasons.join("; "))}</p>
          <div className="dk-rows">
            <div className="dk-row"><span>{L.counted}</span><b>{usdText(g.counted)}</b></div>
            <div className="dk-row"><span>{L.floor}</span><b>{body.candidate?.side === "sell" ? usdText(g.oracleFloor) : tokensText(g.oracleFloor)}</b></div>
            <div className="dk-row"><span>{L.premiumOk}</span><b>{g.premiumOk ? L.ok : L.no}</b></div>
          </div>
        </>
      )}
    </>
  );
}

/** Section 6: the cost, shown before acting. */
export function CostShown({ body }: { body: Body }) {
  const C = D.cost;
  const p = body.preview;
  const sell = body.candidate?.side === "sell";
  if (!p) return null;
  return (
    <div className="dk-rows">
      <div className="dk-row"><span>{C.spend}</span><b>{sell ? `${tokensText(p.amountIn)} ${body.candidate?.symbol ?? ""}` : `${usdText(p.amountIn)} USDC`}</b></div>
      <div className="dk-row"><span>{C.receive}</span><b>{sell ? `${usdText(p.expectedOut)} USDC` : `${tokensText(p.expectedOut)} ${body.candidate?.symbol ?? ""}`}</b></div>
      <div className="dk-row"><span>{C.least}</span><b>{sell ? `${usdText(p.minOut)} USDC` : `${tokensText(p.minOut)} ${body.candidate?.symbol ?? ""}`}</b></div>
      <div className="dk-row"><span>{C.slippage}</span><b>{pct(p.slippageBps)}</b></div>
    </div>
  );
}
