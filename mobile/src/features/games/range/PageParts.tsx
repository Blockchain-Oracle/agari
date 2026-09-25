import type { Reading } from "@agari/core/schemas";
import { formatUtc } from "@agari/core/units";
import { router, type Href } from "expo-router";
import { TriangleAlert, Wallet } from "lucide-react-native";
import { useMemo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { STALE_REASON_LABEL, staleLine } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { ErrorState, LoadingState, type LoadingShape } from "~/components/kit";
import { PageTitle, Press, SectionHead, useGamesTokens } from "~/features/games/frame";
import { FONT, useTheme } from "~/theme";
import { rangeTokens, type RangeTokens } from "~/theme/web/games-range";

/** The Range family's computed web colours beside the games frame's and the app's own roles. */
export function useRangeTokens() {
  const { name } = useTheme();
  const games = useGamesTokens();
  const r: RangeTokens = useMemo(() => rangeTokens(name), [name]);
  return { ...games, r };
}

/** parlay-page.css `.pl-hero`: the vermilion-80 mono eyebrow (10 px, 0.22em), the page title, 48 below. */
export function PlHero({ eyebrow, title }: { eyebrow: string; title: string }) {
  const { r } = useRangeTokens();
  return (
    <View style={styles.hero}>
      <Text style={[styles.eyebrow, { color: r.eyebrow }]}>{eyebrow.toUpperCase()}</Text>
      <PageTitle>{title}</PageTitle>
    </View>
  );
}

/** `.pl-block`: a numbered section head, then its body 24 below; 32 to the next block. */
export function PlBlock({ number, title, desc, children }: { number: string; title: string; desc?: string; children: ReactNode }) {
  return (
    <View style={styles.block} accessibilityLabel={title}>
      <SectionHead number={number} title={title} desc={desc} />
      {children}
    </View>
  );
}

/** `.pl-how`: the three "how it pays" cards — the circled numeral, the line, the sentence. */
export function HowCards({ cards }: { cards: readonly { n: string; t: string; d: string }[] }) {
  const { t, color } = useRangeTokens();
  return (
    <View style={styles.how}>
      {cards.map((card) => (
        <View key={card.n} style={[styles.howCard, { borderColor: t.cardBorder, backgroundColor: t.cardBg }]}>
          <Text style={[styles.howN, { color: color.accent }]}>{card.n}</Text>
          <Text style={[styles.howT, { color: color.ink }]}>{card.t}</Text>
          <Text style={[styles.howD, { color: color.inkMuted }]}>{card.d}</Text>
        </View>
      ))}
    </View>
  );
}

/** `.pl-connect`: the wallet glyph, what connecting unlocks, and web's Connect button. */
export function ConnectPlate({ title, sub }: { title: string; sub: string }) {
  const { t, r, color } = useRangeTokens();
  const session = useWalletSession();
  return (
    <View style={[styles.connect, { borderColor: t.cardBorder, backgroundColor: r.plate }]}>
      <Wallet size={32} color={color.inkDisabled} strokeWidth={2} style={styles.connectIcon} />
      <Text style={[styles.connectTitle, { color: color.inkSecondary }]}>{title}</Text>
      <Text style={[styles.connectSub, { color: color.inkDisabled }]}>{sub}</Text>
      <Press
        onPress={() => router.push("/connect" as Href)}
        disabled={session.isConnecting}
        accessibilityRole="button"
        style={[styles.connectBtn, { backgroundColor: color.accent }]}
      >
        <Text style={[styles.connectLabel, { color: color.onAccent }]}>{session.isConnecting ? "Reconnecting…" : "Connect"}</Text>
      </Press>
    </View>
  );
}

/** `.pl-slip-empty`: the dashed plate a slip with nothing on it shows. */
export function SlipEmpty({ children }: { children: string }) {
  const { t, r, color } = useRangeTokens();
  return (
    <View style={[styles.slipEmpty, { borderColor: t.cardBorder, backgroundColor: r.slipEmpty }]}>
      <Text style={[styles.slipEmptyText, { color: color.inkDisabled }]}>{children.toUpperCase()}</Text>
    </View>
  );
}

/** web's `CapabilityPending` (shell.css): what the mode is, what it waits on, and the way out meanwhile. */
export function CapabilityPending({ eyebrow, title, dependency, children }: { eyebrow: string; title: string; dependency: string; children: ReactNode }) {
  const { r, color } = useRangeTokens();
  return (
    <View style={styles.cp}>
      <Text style={[styles.cpEyebrow, { color: color.accent }]}>{eyebrow.toUpperCase()}</Text>
      <Text style={[styles.cpTitle, { color: color.ink }]} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.cpBody}>{children}</View>
      <Text style={[styles.cpMeta, { color: color.inkMuted, borderTopColor: r.cpRule }]}>Not connected yet · waiting on {dependency}</Text>
      <Press onPress={() => router.push("/markets" as Href)} accessibilityRole="link" style={styles.cpActionWrap}>
        <Text style={[styles.cpAction, { color: color.accent }]}>MAKE A CALL ON THE MARKETS →</Text>
      </Press>
    </View>
  );
}

/** `.cp-body` paragraphs. */
export function CpText({ children }: { children: string }) {
  const { color } = useRangeTokens();
  return <Text style={[styles.cpText, { color: color.inkSecondary }]}>{children}</Text>;
}

/** web's `ReadingBoundary`: a skeleton only while nothing is known, the diagnosis on a failure, the stale tick after. */
export function ReadingBoundary<T>({ reading, shape = "plate", children }: { reading: Reading<T> | null | undefined; shape?: LoadingShape; children: (value: T) => ReactNode }) {
  const { color } = useRangeTokens();
  if (!reading) return <LoadingState shape={shape} />;
  if (!reading.ok) return <ErrorState diagnosis={reading.error} />;
  return (
    <>
      {children(reading.value)}
      {reading.stale ? (
        <View style={styles.stale} accessibilityRole="text" accessibilityLiveRegion="polite">
          <TriangleAlert size={14} color={color.warning} />
          <Text style={[styles.staleText, { color: color.warning }]}>{staleLine(formatUtc(reading.asOfMs, { withSeconds: false }), STALE_REASON_LABEL[reading.staleReason ?? "refresh-failed"])}</Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  hero: { marginBottom: 48 },
  eyebrow: { marginBottom: 16, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 2.2 },
  block: { marginBottom: 32 },
  how: { gap: 16 },
  howCard: { borderRadius: 16, borderWidth: 1, padding: 20 },
  howN: { marginBottom: 8, fontFamily: FONT.headingHeavy, fontSize: 24, lineHeight: 24 },
  howT: { marginBottom: 6, fontFamily: FONT.heading, fontSize: 14, lineHeight: 22.4 },
  howD: { fontFamily: FONT.body, fontSize: 12, lineHeight: 19.5 },
  connect: { borderRadius: 16, borderWidth: 1, padding: 32, alignItems: "center" },
  connectIcon: { marginBottom: 12 },
  connectTitle: { marginBottom: 4, fontFamily: FONT.body, fontSize: 14, lineHeight: 22.4, textAlign: "center" },
  connectSub: { marginBottom: 16, fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2, textAlign: "center" },
  connectBtn: { height: 48, paddingHorizontal: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  connectLabel: { fontFamily: FONT.bodyMedium, fontSize: 15, lineHeight: 22.5 },
  slipEmpty: { borderRadius: 16, borderWidth: 1, borderStyle: "dashed", padding: 32 },
  slipEmptyText: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 0.55, textAlign: "center" },
  cp: { paddingVertical: 48 },
  cpEyebrow: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.76 },
  cpTitle: { marginTop: 12, fontFamily: FONT.heading, fontSize: 28, lineHeight: 32.2, letterSpacing: -0.56 },
  cpBody: { marginTop: 12, gap: 12 },
  cpText: { fontFamily: FONT.body, fontSize: 15, lineHeight: 24 },
  cpMeta: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6 },
  cpActionWrap: { marginTop: 16, alignSelf: "flex-start" },
  cpAction: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.76 },
  stale: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  staleText: { fontFamily: FONT.body, fontSize: 13, lineHeight: 19 },
});
