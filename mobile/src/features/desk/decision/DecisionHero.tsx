import { nameOf, type DeskRecordBody } from "@agari/core/desk";
import type { PreIpoSymbol } from "@agari/core/market";
import { StyleSheet, Text, View } from "react-native";
import { namesIn } from "@/features/desk/activity/activity-model";
import { DESK } from "@/features/desk/copy";
import { RECORD } from "@/features/desk/copy-record";
import { DECISION } from "@/features/desk/decision/copy-decision";
import { stamp, tokensText, usdText } from "@/features/desk/format";
import type { DecisionWire } from "@/features/desk/protocol";
import { FONT } from "~/theme";
import { cmix, fade } from "~/theme/web/products/desk-cockpit";
import { LogoStack, RadialGauge, RadialWash, StatusDot, TONE, TONE_LUCIDE, useDeskTheme } from "../kit";

/** "$50 of Anthropic" for a buy, "0.4718 Anthropic" for a sell; null when the check had no candidate. */
function amountLine(body: DeskRecordBody | null): { side: "buy" | "sell"; text: string } | null {
  const c = body?.candidate;
  if (!c) return null;
  const name = nameOf(c.symbol);
  return c.side === "buy" ? { side: "buy", text: DECISION.wouldBuy(usdText(c.amountIn), name) } : { side: "sell", text: DECISION.wouldSell(tokensText(c.amountIn), name) };
}

/**
 * The decision's hero (web's decision/DecisionHero.tsx at ≤ 640 px): the verdict in its tone with its icon and the
 * mode, the companies it was about with the amount, the summary, # and when; the model's confidence as a gauge scaled
 * to 72% in the top right corner. The card's edge and glow take the verdict's tone.
 */
export function DecisionHero({ decision, body, zone }: { decision: DecisionWire; body: DeskRecordBody | null; zone: string | null }) {
  const { color } = useDeskTheme();
  const { record } = decision;
  const tone = TONE[record.outcome];
  const toneInk = tone === "acted" ? color.profit : tone === "declined" ? color.accent : tone === "asked" ? color.warning : tone === "error" || tone === "stopped" ? color.loss : color.inkMuted;
  const quiet = tone === "quiet" || tone === "neutral";
  const Icon = TONE_LUCIDE[tone];
  const names: PreIpoSymbol[] = body?.candidate ? [body.candidate.symbol] : namesIn(record.summary);
  const amount = amountLine(body);
  const confidence = body?.timing?.decision?.confidencePercent ?? null;
  const practice = record.mode === "practice";
  return (
    <View style={[styles.hero, { backgroundColor: color.surface1, borderColor: cmix(toneInk, color.hairline, 0.45) }]} accessibilityLabel={RECORD.outcome[record.outcome]}>
      <RadialWash color={fade(toneInk, 0.16)} cx={0.25} cy={0.5} rx={0.35} ry={0.9} until={1} radius={19} />
      <View style={styles.main}>
        <View style={styles.top}>
          <View style={[styles.verdictIcon, { borderColor: quiet ? color.hairline : toneInk, backgroundColor: fade(toneInk, 0.14) }]}>
            <Icon size={16} color={toneInk} strokeWidth={tone === "acted" ? 2.75 : 2} />
          </View>
          <Text style={[styles.verdict, { color: quiet ? color.inkSecondary : toneInk }]}>{RECORD.outcome[record.outcome]}</Text>
          <StatusDot tone={practice ? "practice" : "live"} label={DESK.modes[record.mode]} />
        </View>
        <View style={styles.subject}>
          {names.length > 0 ? <LogoStack symbols={names} names={names.map((s) => nameOf(s))} size="lg" max={4} /> : null}
          <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
            {amount ? (
              <>
                <Text style={[styles.side, { color: color.inkSecondary }]}>{DECISION.side[amount.side]}</Text> {amount.text}
              </>
            ) : names.length > 0 ? (
              names.map((s) => nameOf(s)).join(" · ")
            ) : (
              RECORD.outcome[record.outcome]
            )}
          </Text>
        </View>
        <Text style={[styles.summary, { color: color.inkSecondary }]}>{record.summary}</Text>
        <View style={styles.meta}>
          <Text style={[styles.metaText, { color: color.inkMuted }]}>{DECISION.seq(record.seq)}</Text>
          <Text style={[styles.metaText, { color: color.inkMuted }]}>·</Text>
          <Text style={[styles.metaText, { color: color.inkMuted }]}>{stamp(record.decidedAtSec, zone)}</Text>
        </View>
      </View>
      <View style={styles.side96}>
        <RadialGauge
          value={confidence ?? 0}
          size={96}
          stroke={8}
          tone={confidence === null ? "accent" : tone === "acted" ? "profit" : tone === "error" || tone === "stopped" ? "loss" : "accent"}
          label={confidence === null ? RECORD.decision.noModel : `${confidence}% ${DECISION.sure}`}
        >
          <View style={styles.gaugeText}>
            <Text style={[styles.gaugeB, { color: color.ink }]}>{confidence === null ? "—" : `${confidence}%`}</Text>
            <Text style={[styles.gaugeSmall, { color: color.inkMuted }]}>{confidence === null ? DECISION.noModel : DECISION.sure}</Text>
          </View>
        </RadialGauge>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { padding: 18, borderWidth: 1, borderRadius: 20, overflow: "hidden" },
  main: { gap: 12 },
  top: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, paddingRight: 76 },
  verdictIcon: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  verdict: { fontFamily: FONT.bodyStrong, fontSize: 12, lineHeight: 19.2, letterSpacing: 1.2, textTransform: "uppercase" },
  subject: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 14 },
  title: { flexShrink: 1, fontFamily: FONT.headingHeavy, fontSize: 24, lineHeight: 26.4, letterSpacing: -0.48 },
  side: { fontFamily: FONT.heading },
  summary: { fontFamily: FONT.body, fontSize: 15, lineHeight: 23.25 },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metaText: { fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
  side96: { position: "absolute", top: 14, right: 14, width: 96, height: 96, transform: [{ scale: 0.72 }], transformOrigin: "top right" },
  gaugeText: { alignItems: "center" },
  gaugeB: { fontFamily: FONT.headingHeavy, fontSize: 20, lineHeight: 21 },
  gaugeSmall: { fontFamily: FONT.body, fontSize: 10, lineHeight: 10.5, letterSpacing: 0.8, textTransform: "uppercase" },
});
