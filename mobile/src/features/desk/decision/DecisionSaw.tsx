import { nameOf, type DeskRecordBody, type RecordEvidenceItem } from "@agari/core/desk";
import { ArrowRight, Check, CircleCheck, CircleX, OctagonAlert, X } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { RECORD } from "@/features/desk/copy-record";
import { DECISION } from "@/features/desk/decision/copy-decision";
import { pct, tokensText, usdText } from "@/features/desk/format";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT } from "~/theme";
import { DT, LinearWash, useDeskTheme } from "../kit";
import { DcBadge, Facts, Subhead } from "./parts";
import { PriceStrip } from "./PriceStrip";

const D = RECORD.decision;
type Body = DeskRecordBody;
const find = <K extends RecordEvidenceItem["kind"]>(body: Body, kind: K) => body.evidence.find((e): e is Extract<RecordEvidenceItem, { kind: K }> => e.kind === kind);

/** Section 3 (web's DecisionSaw.tsx `WhatItSaw`): the price strip, then the prices and their age, the mark, the drift, the cost, the flags, the limits left, and what stopped it. */
export function WhatItSaw({ body, ceilingBps = null }: { body: Body; ceilingBps?: number | null }) {
  const { color, t } = useDeskTheme();
  const S = D.saw;
  const c = body.candidate;
  if (!c) return <Text style={[DT.body, { color: color.inkSecondary }]}>{S.nothing}</Text>;
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
      {price ? <PriceStrip spot={price.spot} mark={price.mark} mean30m={price.mean30m} index={price.index} ceilingBps={ceilingBps} /> : null}
      <Facts rows={rows} />
      {body.blockers.length > 0 ? (
        <View style={styles.blockers}>
          <Subhead>{S.blockers}</Subhead>
          {body.blockers.map((b) => (
            <View key={b.rule} style={[styles.blocker, { backgroundColor: t.warnWash }]}>
              <OctagonAlert size={16} color={color.warning} style={styles.lineIcon} />
              <Text style={[styles.blockerText, { color: color.warning }]}>{b.text}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </>
  );
}

/** Section 4: the chosen option raised and badged, each turned-down one under it with its reason. */
export function Options({ body }: { body: Body }) {
  const { color } = useDeskTheme();
  const O = D.options;
  const decision = body.timing?.decision ?? null;
  if (!decision) return <Text style={[DT.body, { color: color.inkSecondary }]}>{body.timing?.error ? RECORD.decision.happened.failed(body.timing.error) : O.noModel}</Text>;
  return (
    <View style={styles.options}>
      <View style={[styles.option, { borderColor: color.accent, boxShadow: `0 10px 30px -18px ${color.accent}, 0 0 0 1px ${color.accent}` }]}>
        <LinearWash from={color.accentWash} until={0.8} radius={13} />
        <View style={styles.optionHead}>
          <Text style={[styles.optionName, { color: color.ink }]}>
            {O[decision.option]}
            {decision.partPercent ? ` · ${O.part(decision.partPercent)}` : ""}
          </Text>
          <DcBadge tone="chosen" icon={Check}>{DECISION.chosen}</DcBadge>
        </View>
        <Text style={[styles.headline, { color: color.ink }]}>{decision.headline}</Text>
        {decision.reasons.length > 0 ? (
          <View style={styles.reasons}>
            {decision.reasons.map((r) => (
              <View key={r.text} style={styles.reason}>
                <Text style={[styles.reasonText, { color: color.inkSecondary }]}>•</Text>
                <Text style={[styles.reasonText, styles.grow, { color: color.inkSecondary }]}>{r.text}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {decision.waitFor ? <Text style={[DT.caption, { color: color.inkSecondary }]}>{O.waitFor(decision.waitFor)}</Text> : null}
      </View>
      {decision.rejected.map((r) => (
        <View key={r.option} style={[styles.option, styles.rest, { borderColor: color.hairline }]}>
          <View style={styles.optionHead}>
            <Text style={[styles.optionName, { color: color.ink }]}>{O[r.option]}</Text>
            <DcBadge icon={X}>{DECISION.turnedDown}</DcBadge>
          </View>
          <Text style={[DT.caption, { color: color.inkSecondary }]}>{r.reason}</Text>
        </View>
      ))}
      {decision.warnings.length > 0 ? (
        <Text style={[DT.caption, { color: color.inkMuted }]}>
          {O.warnings}: {decision.warnings.join(" ")}
        </Text>
      ) : null}
    </View>
  );
}

/** `.dc-check` at phone width: the mark, the label, the figure under it. */
function CheckRow({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  const { color, t } = useDeskTheme();
  const Icon = ok ? CircleCheck : CircleX;
  return (
    <View style={[styles.check, { backgroundColor: ok ? color.surface2 : t.checkBad }]}>
      <Icon size={18} color={ok ? color.profit : color.loss} />
      <View style={styles.grow}>
        <Text style={[styles.checkText, { color: color.inkSecondary }]}>{label}</Text>
        <Text style={[styles.checkText, styles.b, { color: color.ink }]}>{value}</Text>
      </View>
    </View>
  );
}

/** Section 5: "plain arithmetic, not an assistant", as a checklist. */
export function LimitsCheck({ body }: { body: Body }) {
  const { color } = useDeskTheme();
  const L = D.limits;
  const g = body.gate;
  const allow = g?.result === "allow";
  const Gate = allow ? CircleCheck : CircleX;
  return (
    <>
      <Text style={[DT.caption, { color: color.inkMuted }]}>{L.arithmetic}</Text>
      {!g ? (
        <Text style={[DT.body, { color: color.inkSecondary }]}>{L.nothing}</Text>
      ) : (
        <>
          <View style={styles.gate}>
            <Gate size={20} color={allow ? color.profit : color.loss} />
            <Text style={[styles.gateText, { color: allow ? color.profit : color.loss }]}>{allow ? L.passed : L.refused(g.reasons.join("; "))}</Text>
          </View>
          <View style={styles.checks}>
            {g.reasons.map((r) => (
              <CheckRow key={r} ok={false} label={r} value={DECISION.refused} />
            ))}
            <CheckRow ok={allow} label={L.counted} value={usdText(g.counted)} />
            <CheckRow ok={allow} label={L.floor} value={body.candidate?.side === "sell" ? usdText(g.oracleFloor) : tokensText(g.oracleFloor)} />
            <CheckRow ok={g.premiumOk} label={L.premiumOk} value={g.premiumOk ? L.ok : L.no} />
          </View>
        </>
      )}
    </>
  );
}

/** `.dc-leg`: one side of the trade, the company's mark or the USDC disc beside the figure. */
function Leg({ symbol, label, value }: { symbol: string | null; label: string; value: string }) {
  const { color } = useDeskTheme();
  return (
    <View style={[styles.leg, { borderColor: color.hairline }]}>
      {symbol ? (
        <AssetDisc asset={symbol} size={36} />
      ) : (
        <View style={[styles.usdc, { backgroundColor: color.markUsdc }]}>
          <Text style={[styles.usdcText, { color: color.markGlyph }]}>$</Text>
        </View>
      )}
      <View style={styles.legText}>
        <Text style={[styles.legLabel, { color: color.inkMuted }]}>{label}</Text>
        <Text style={[styles.legValue, { color: color.ink }]}>{value}</Text>
      </View>
    </View>
  );
}

/** Section 6: the cost shown before acting — the spend flowing into what it should receive, then the fine print. */
export function CostShown({ body }: { body: Body }) {
  const { color } = useDeskTheme();
  const C = D.cost;
  const p = body.preview;
  const c = body.candidate;
  const sell = c?.side === "sell";
  if (!p) return null;
  const sym = c?.symbol ?? "";
  return (
    <View style={styles.cost}>
      <View style={styles.flow} accessibilityLabel={DECISION.flow}>
        <Leg symbol={sell ? sym : null} label={C.spend} value={sell ? `${tokensText(p.amountIn)} ${sym}` : `${usdText(p.amountIn)} USDC`} />
        <View style={[styles.arrow, { backgroundColor: color.surface2 }]}>
          <ArrowRight size={16} color={color.accent} />
        </View>
        <Leg symbol={sell ? null : sym} label={C.receive} value={sell ? `${usdText(p.expectedOut)} USDC` : `${tokensText(p.expectedOut)} ${sym}`} />
      </View>
      <Facts rows={[[C.least, sell ? `${usdText(p.minOut)} USDC` : `${tokensText(p.minOut)} ${sym}`], [C.slippage, pct(p.slippageBps)]]} />
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  lineIcon: { marginTop: 2 },
  blockers: { gap: 8 },
  blocker: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  blockerText: { flex: 1, fontFamily: FONT.body, fontSize: 14, lineHeight: 22.4 },
  options: { gap: 10 },
  option: { gap: 8, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, borderRadius: 14 },
  rest: { opacity: 0.86 },
  optionHead: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 },
  optionName: { fontFamily: FONT.headingHeavy, fontSize: 14, lineHeight: 22.4 },
  headline: { fontFamily: FONT.body, fontSize: 15.5, lineHeight: 23.25 },
  reasons: { gap: 6, paddingLeft: 4 },
  reason: { flexDirection: "row", gap: 8 },
  reasonText: { fontFamily: FONT.body, fontSize: 13, lineHeight: 19.5 },
  gate: { flexDirection: "row", alignItems: "center", gap: 10 },
  gateText: { flex: 1, fontFamily: FONT.bodyStrong, fontSize: 15, lineHeight: 24 },
  checks: { gap: 6 },
  check: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10 },
  checkText: { fontFamily: FONT.body, fontSize: 13.5, lineHeight: 21.6 },
  b: { fontFamily: FONT.bodyStrong, fontVariant: ["tabular-nums"] },
  cost: { gap: 12 },
  flow: { gap: 10 },
  arrow: { alignSelf: "center", width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", transform: [{ rotate: "90deg" }] },
  leg: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderRadius: 14 },
  usdc: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  usdcText: { fontFamily: FONT.headingHeavy, fontSize: 17 },
  legText: { flex: 1, minWidth: 0, gap: 2 },
  legLabel: { fontFamily: FONT.body, fontSize: 10.5, lineHeight: 16.8, letterSpacing: 1.05, textTransform: "uppercase" },
  legValue: { fontFamily: FONT.headingHeavy, fontSize: 16, lineHeight: 25.6 },
});
