import { nameOf, type DeskRecordBody } from "@agari/core/desk";
import type { PreIpoSymbol } from "@agari/core/market";
import { SymbolView } from "expo-symbols";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { namesIn } from "@/features/desk/activity/activity-model";
import { DESK } from "@/features/desk/copy";
import { RECORD } from "@/features/desk/copy-record";
import { DECISION } from "@/features/desk/decision/copy-decision";
import { stamp, tokensText, usdText } from "@/features/desk/format";
import type { DecisionWire } from "@/features/desk/protocol";
import { haptic } from "~/components/kit";
import { RADIUS, TYPE, useTheme } from "~/theme";
import { LogoStack, RadialGauge, StatusDot, TONE, TONE_ICON, toneInk, toneWash } from "../kit";

/** "$50 of Anthropic" for a buy, "0.4718 Anthropic" for a sell; null when the check had no candidate. */
function amountLine(body: DeskRecordBody | null): { side: "buy" | "sell"; text: string } | null {
  const c = body?.candidate;
  if (!c) return null;
  const name = nameOf(c.symbol);
  return c.side === "buy" ? { side: "buy", text: DECISION.wouldBuy(usdText(c.amountIn), name) } : { side: "sell", text: DECISION.wouldSell(tokensText(c.amountIn), name) };
}

/** The decision's hero (web's decision/DecisionHero.tsx): the verdict in its tone, the companies, the amount, how sure. */
export function DecisionHero({ decision, body, zone }: { decision: DecisionWire; body: DeskRecordBody | null; zone: string | null }) {
  const { color } = useTheme();
  const { record } = decision;
  const tone = TONE[record.outcome];
  const ink = toneInk(tone, color);
  const names: PreIpoSymbol[] = body?.candidate ? [body.candidate.symbol] : namesIn(record.summary);
  const amount = amountLine(body);
  const confidence = body?.timing?.decision?.confidencePercent ?? null;
  const practice = record.mode === "practice";
  useEffect(() => {
    if (tone === "acted") haptic.heavy();
  }, [tone]);
  return (
    <View style={[styles.hero, { backgroundColor: toneWash(tone, color), borderColor: ink }]} accessibilityLabel={RECORD.outcome[record.outcome]}>
      <View style={styles.top}>
        <View style={[styles.icon, { borderColor: ink }]}>
          <SymbolView name={TONE_ICON[tone] as never} size={16} tintColor={ink} weight="bold" />
        </View>
        <Text style={[TYPE.title, styles.grow, { color: ink }]}>{RECORD.outcome[record.outcome]}</Text>
        <StatusDot tone={practice ? "practice" : "live"} label={DESK.modes[record.mode]} />
      </View>
      <View style={styles.subject}>
        <View style={styles.grow}>
          {names.length > 0 ? <LogoStack symbols={names} names={names.map((s) => nameOf(s))} size={30} max={4} /> : null}
          <Text style={[TYPE.headline, { color: color.ink }]} accessibilityRole="header">
            {amount ? `${DECISION.side[amount.side]} ${amount.text}` : names.length > 0 ? names.map((s) => nameOf(s)).join(" · ") : RECORD.outcome[record.outcome]}
          </Text>
        </View>
        <RadialGauge value={confidence ?? 0} size={80} stroke={7} tone={tone === "acted" ? "profit" : tone === "error" || tone === "stopped" ? "loss" : "accent"} label={confidence === null ? RECORD.decision.noModel : `${confidence}% ${DECISION.sure}`}>
          <Text style={[TYPE.dataLg, { color: color.ink }]}>{confidence === null ? "—" : `${confidence}%`}</Text>
          <Text style={[TYPE.caption, { color: color.inkMuted, fontSize: 11 }]}>{confidence === null ? DECISION.noModel : DECISION.sure}</Text>
        </RadialGauge>
      </View>
      <Text style={[TYPE.body, { color: color.inkSecondary }]}>{record.summary}</Text>
      <Text style={[TYPE.data, { color: color.inkMuted }]}>
        {DECISION.seq(record.seq)} · {stamp(record.decidedAtSec, zone)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 16, gap: 12 },
  top: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  grow: { flex: 1, gap: 8 },
  subject: { flexDirection: "row", alignItems: "center", gap: 12 },
});
