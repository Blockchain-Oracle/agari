import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { SymbolView } from "expo-symbols";
import { ACCOUNT_MENU } from "@/lib/copy";
import { Logo } from "~/components/logos/Logo";
import { AgariMark } from "~/components/shell/AgariMark";
import { RADIUS, TYPE, useTheme } from "~/theme";

/** Step 2: a Window's life on one line — the opening print, the lock, the settling print — with a moving "now". */
export function WindowTimeline() {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const t = useSharedValue(reduce ? 0.55 : 0);
  useEffect(() => {
    if (!reduce) t.value = withRepeat(withTiming(1, { duration: 5_000, easing: Easing.linear }), -1, false);
  }, [t, reduce]);
  const now = useAnimatedStyle(() => ({ left: `${t.value * 100}%` }));
  const stops = [
    { at: "0%", label: "Opens", line: "at a print" },
    { at: "82%", label: "Locks", line: "no new calls" },
    { at: "100%", label: "Settles", line: "oracle print" },
  ] as const;
  return (
    <View style={[styles.card, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
      <View style={styles.track}>
        <View style={[styles.rail, { backgroundColor: color.hairline }]} />
        <Animated.View style={[styles.now, { backgroundColor: color.accent }, now]} />
        {stops.map((stop) => (
          <View key={stop.label} style={[styles.stop, { left: stop.at, borderColor: color.ink, backgroundColor: color.ground }]} />
        ))}
      </View>
      <View style={styles.labels}>
        {stops.map((stop) => (
          <View key={stop.label} style={styles.label}>
            <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{stop.label}</Text>
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>{stop.line}</Text>
          </View>
        ))}
      </View>
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>Up and Down are separate contracts, each with its own price from the book. The ticket shows the exact cost and the most you can lose before you sign.</Text>
    </View>
  );
}

/** Step 3: who signs — a wallet app on the phone, or the practice key. */
export function WalletsArt() {
  const { color } = useTheme();
  const tile = (child: React.ReactNode, name: string) => (
    <View style={styles.wallet}>
      <View style={[styles.walletArt, { backgroundColor: color.surface1, borderColor: color.hairline }]}>{child}</View>
      <Text style={[TYPE.caption, { color: color.ink }]}>{name}</Text>
    </View>
  );
  return (
    <View style={[styles.card, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
      <View style={styles.wallets}>
        {tile(<Logo brand="phantom" size={52} radius={RADIUS.lg} />, "Phantom")}
        {tile(<Logo brand="solflare" size={52} radius={RADIUS.lg} />, "Solflare")}
        {tile(<AgariMark width={25} height={25} />, "Practice")}
      </View>
      <View style={styles.lock}>
        <SymbolView name={{ ios: "lock.shield", android: "shield_lock" }} size={18} tintColor={color.accent} />
        <Text style={[TYPE.caption, styles.flex, { color: color.inkSecondary }]}>Agari never holds your funds and nothing signs for you. Every order is a transaction you approve.</Text>
      </View>
    </View>
  );
}

/** Step 4: where money sits — one spendable number, every other pool labelled beneath it and never added in. */
export function PoolsArt() {
  const { color } = useTheme();
  const rows = [
    { name: ACCOUNT_MENU.wallet, line: "What you can bet right now", strong: true },
    { name: "In resting orders", line: "Locked until they fill or you cancel" },
    { name: "Venue payout credit", line: "Spent first on your next buy in that Window" },
  ];
  return (
    <View style={[styles.paper, { backgroundColor: color.cream, borderColor: color.creamHairline }]}>
      {rows.map((row, index) => (
        <View key={row.name} style={[styles.pool, index > 0 && { borderTopColor: color.creamHairline, borderTopWidth: StyleSheet.hairlineWidth }]}>
          <View style={styles.flex}>
            <Text style={[row.strong ? TYPE.title : TYPE.bodyStrong, { color: color.creamInk }]}>{row.name}</Text>
            <Text style={[TYPE.caption, { color: color.creamInk, opacity: 0.7 }]}>{row.line}</Text>
          </View>
          {row.strong ? <SymbolView name={{ ios: "checkmark.circle.fill", android: "check_circle" }} size={20} tintColor={color.accent} /> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 14 },
  paper: { borderRadius: RADIUS.lg, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 4 },
  track: { height: 22, justifyContent: "center", marginHorizontal: 8 },
  rail: { height: 2, borderRadius: 1 },
  now: { position: "absolute", width: 10, height: 10, borderRadius: 5, marginLeft: -5 },
  stop: { position: "absolute", width: 14, height: 14, borderRadius: 7, borderWidth: 2, marginLeft: -7 },
  labels: { flexDirection: "row", justifyContent: "space-between" },
  label: { alignItems: "center", gap: 1, flex: 1 },
  wallets: { flexDirection: "row", justifyContent: "space-around" },
  wallet: { alignItems: "center", gap: 6 },
  walletArt: { width: 60, height: 60, borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  lock: { flexDirection: "row", gap: 10, alignItems: "center" },
  pool: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 10 },
  flex: { flex: 1 },
});
