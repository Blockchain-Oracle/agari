import { nameOf, type DeskRecordBody, type RecordEvidenceItem } from "@agari/core/desk";
import { SymbolView } from "expo-symbols";
import { StyleSheet, Text, View } from "react-native";
import { RECORD } from "@/features/desk/copy-record";
import { DECISION } from "@/features/desk/decision/copy-decision";
import { pct, tokensText, usdText } from "@/features/desk/format";
import { Row, Rows } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { TUsdcMark } from "~/components/marks/TUsdcMark";
import { RADIUS, TYPE, useTheme } from "~/theme";
import { PriceStrip } from "./PriceStrip";

const D = RECORD.decision;
type Body = DeskRecordBody;
const find = <K extends RecordEvidenceItem["kind"]>(body: Body, kind: K) => body.evidence.find((e): e is Extract<RecordEvidenceItem, { kind: K }> => e.kind === kind);

/** A label over its value, for facts too long for one line on a phone. */
function Fact({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.fact}>
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{label}</Text>
      <Text style={[TYPE.body, { color: tone ?? color.ink }]}>{value}</Text>
    </View>
  );
}

/** Section 3 (web's DecisionSaw.tsx `WhatItSaw`): the price strip, then every price, the drift, the cost, the flags. */
export function WhatItSaw({ body, ceilingBps }: { body: Body; ceilingBps: number | null }) {
  const { color } = useTheme();
  const S = D.saw;
  const c = body.candidate;
  if (!c) return <Text style={[TYPE.body, { color: color.inkSecondary }]}>{S.nothing}</Text>;
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
    if (price.index !== null) rows.push([S.index, `${usdText(price.index)}${price.indexPremiumBps === null ? "" : ` · ${pct(price.indexPremiumBps)}`}`]);
    rows.push([S.mean, `${usdText(price.mean30m)} · ${price.inLine ? S.inLine : S.gap(pct(price.gapBps))}`]);
  }
  if (position) rows.push([name, S.drift(pct(position.weightBps), pct(position.targetBps), pct(position.thresholdBps))]);
  if (cost) rows.push([S.cost, cost.costBps === null ? S.costNone : `${S.costValue(pct(cost.costBps))}${cost.routeAccounts === null ? "" : ` · ${S.route(cost.routeAccounts)}`}`]);
  if (status) rows.push([S.status, `${status.mintPaused === null ? S.pauseUnknown : status.mintPaused ? S.paused : S.open}${status.accountFrozen ? ` · ${S.frozen}` : ""} · ${S.reference} ${status.referenceFresh ? S.fresh : S.stale}`]);
  if (limits) rows.push([S.limitsLeft, S.limitsLine(usdText(limits.perActionCap), usdText(limits.remainingToday), usdText(limits.deskCash))]);
  return (
    <View style={styles.stack}>
      {price ? <PriceStrip spot={price.spot} mark={price.mark} mean30m={price.mean30m} index={price.index} ceilingBps={ceilingBps} /> : null}
      {rows.map(([label, value]) => (
        <Fact key={label} label={label} value={value} />
      ))}
      {body.blockers.length > 0 ? <Text style={[TYPE.labelMicro, { color: color.loss }]}>{S.blockers}</Text> : null}
      {body.blockers.map((b) => (
        <View key={b.rule} style={styles.line}>
          <SymbolView name={{ ios: "exclamationmark.octagon", android: "report" }} size={15} tintColor={color.loss} />
          <Text style={[TYPE.body, styles.grow, { color: color.ink }]}>{b.text}</Text>
        </View>
      ))}
    </View>
  );
}

/** Section 4 (web's `Options`): the chosen option raised and badged, each turned-down one with its reason. */
export function Options({ body }: { body: Body }) {
  const { color } = useTheme();
  const O = D.options;
  const decision = body.timing?.decision ?? null;
  if (!decision) return <Text style={[TYPE.body, { color: color.inkSecondary }]}>{body.timing?.error ? D.happened.failed(body.timing.error) : O.noModel}</Text>;
  return (
    <View style={styles.stack}>
      <View style={[styles.option, { borderColor: color.accent, backgroundColor: color.accentWash }]}>
        <View style={styles.line}>
          <Text style={[TYPE.bodyStrong, styles.grow, { color: color.ink }]}>
            {O[decision.option]}
            {decision.partPercent ? ` · ${O.part(decision.partPercent)}` : ""}
          </Text>
          <Text style={[TYPE.labelMicro, { color: color.accent }]}>{DECISION.chosen}</Text>
        </View>
        <Text style={[TYPE.body, { color: color.ink }]}>{decision.headline}</Text>
        {decision.reasons.map((r) => (
          <Text key={r.text} style={[TYPE.caption, { color: color.inkSecondary }]}>
            • {r.text}
          </Text>
        ))}
        {decision.waitFor ? <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{O.waitFor(decision.waitFor)}</Text> : null}
      </View>
      {decision.rejected.map((r) => (
        <View key={r.option} style={[styles.option, { borderColor: color.hairline }]}>
          <View style={styles.line}>
            <Text style={[TYPE.bodyStrong, styles.grow, { color: color.inkSecondary }]}>{O[r.option]}</Text>
            <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{DECISION.turnedDown}</Text>
          </View>
          <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{r.reason}</Text>
        </View>
      ))}
      {decision.warnings.length > 0 ? (
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>
          {O.warnings}: {decision.warnings.join(" ")}
        </Text>
      ) : null}
    </View>
  );
}

function CheckRow({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.line}>
      <SymbolView name={ok ? { ios: "checkmark.circle", android: "check_circle" } : { ios: "xmark.circle", android: "cancel" }} size={16} tintColor={ok ? color.profit : color.loss} />
      <Text style={[TYPE.caption, styles.grow, { color: color.ink }]}>{label}</Text>
      <Text style={[TYPE.data, { color: color.ink }]}>{value}</Text>
    </View>
  );
}

/** Section 5 (web's `LimitsCheck`): "plain arithmetic, not an assistant", as a checklist. */
export function LimitsCheck({ body }: { body: Body }) {
  const { color } = useTheme();
  const L = D.limits;
  const g = body.gate;
  return (
    <View style={styles.stack}>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{L.arithmetic}</Text>
      {!g ? (
        <Text style={[TYPE.body, { color: color.inkSecondary }]}>{L.nothing}</Text>
      ) : (
        <>
          <Text style={[TYPE.bodyStrong, { color: g.result === "allow" ? color.profit : color.loss }]}>{g.result === "allow" ? L.passed : L.refused(g.reasons.join("; "))}</Text>
          {g.reasons.map((r) => (
            <CheckRow key={r} ok={false} label={r} value={DECISION.refused} />
          ))}
          <CheckRow ok={g.result === "allow"} label={L.counted} value={usdText(g.counted)} />
          <CheckRow ok={g.result === "allow"} label={L.floor} value={body.candidate?.side === "sell" ? usdText(g.oracleFloor) : tokensText(g.oracleFloor)} />
          <CheckRow ok={g.premiumOk} label={L.premiumOk} value={g.premiumOk ? L.ok : L.no} />
        </>
      )}
    </View>
  );
}

/** Section 6 (web's `CostShown`): the spend flowing into what it should receive, then the fine print. */
export function CostShown({ body }: { body: Body }) {
  const { color } = useTheme();
  const C = D.cost;
  const p = body.preview;
  const c = body.candidate;
  if (!p) return null;
  const sell = c?.side === "sell";
  const sym = c?.symbol ?? "";
  const leg = (symbol: string | null, label: string, value: string) => (
    <View style={[styles.leg, { backgroundColor: color.surface2 }]}>
      {symbol ? <AssetDisc asset={symbol} size={26} /> : <TUsdcMark size={26} />}
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{label}</Text>
      <Text style={[TYPE.data, { color: color.ink }]}>{value}</Text>
    </View>
  );
  return (
    <View style={styles.stack}>
      <View style={styles.flow} accessibilityLabel={DECISION.flow}>
        {leg(sell ? sym : null, C.spend, sell ? `${tokensText(p.amountIn)} ${sym}` : `${usdText(p.amountIn)} USDC`)}
        <SymbolView name={{ ios: "arrow.right", android: "arrow_forward" }} size={16} tintColor={color.inkMuted} />
        {leg(sell ? null : sym, C.receive, sell ? `${usdText(p.expectedOut)} USDC` : `${tokensText(p.expectedOut)} ${sym}`)}
      </View>
      <Rows>
        <Row label={C.least} value={sell ? `${usdText(p.minOut)} USDC` : `${tokensText(p.minOut)} ${sym}`} />
        <Row label={C.slippage} value={pct(p.slippageBps)} />
      </Rows>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 10 },
  fact: { gap: 2 },
  line: { flexDirection: "row", alignItems: "center", gap: 8 },
  grow: { flex: 1 },
  option: { borderWidth: 1, borderRadius: RADIUS.md, padding: 12, gap: 6 },
  flow: { flexDirection: "row", alignItems: "center", gap: 8 },
  leg: { flex: 1, borderRadius: RADIUS.md, padding: 10, gap: 4, alignItems: "flex-start" },
});
