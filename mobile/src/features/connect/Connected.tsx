import { isOk } from "@agari/core/schemas";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";
import { SymbolView } from "expo-symbols";
import { useBalancePlate } from "@/features/markets/balance/useBalancePlate";
import { formatAccountAddress } from "@/providers/wallet/emoji-avatar";
import { Button, Row, Rows } from "~/components/kit";
import { useAccountBalances } from "~/components/wallet/account-rows";
import { Avatar } from "~/components/wallet/Avatar";
import { RADIUS, TYPE, useTheme } from "~/theme";

/**
 * The landing after a wallet connects: whose account it is, what it holds right now, and the obvious next step —
 * test funds when the wallet is empty, the markets otherwise.
 */
export function Connected({ address, walletName, onFunds, onDone }: { address: string; walletName: string; onFunds: () => void; onDone: () => void }) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const balances = useAccountBalances();
  const plate = useBalancePlate();
  const reading = plate.kind === "connected" ? plate.reading : null;
  const sheet = reading && isOk(reading) ? reading.value : null;
  const empty = sheet !== null && sheet.spendableBase === 0n && (sheet.vaultBase ?? 0n) === 0n;
  const pop = useSharedValue(reduce ? 1 : 0.4);
  useEffect(() => {
    if (!reduce) pop.value = withSpring(1, { damping: 11, stiffness: 180 });
  }, [pop, reduce]);
  const badge = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <View>
        <Avatar address={address} size={78} />
        <Animated.View style={[styles.badge, { backgroundColor: color.profit, borderColor: color.ground }, badge]}>
          <SymbolView name={{ ios: "checkmark", android: "check" }} size={14} tintColor={color.ground} weight="bold" />
        </Animated.View>
      </View>
      <Text style={[TYPE.headline, { color: color.ink }]}>Connected</Text>
      <Text style={[TYPE.body, { color: color.inkSecondary }]}>
        {walletName} · {formatAccountAddress(address)}
      </Text>
      <View style={[styles.card, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
        <Rows>
          {balances.map((row) => (
            <Row key={row.label} label={row.label} value={row.amount} />
          ))}
        </Rows>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>Solana devnet · test tUSDC with no real-money value.</Text>
      </View>
      <View style={styles.actions}>
        {empty ? <Button label="Get test funds" icon={{ ios: "plus.circle.fill", android: "add_circle" }} onPress={onFunds} /> : null}
        <Button label={sheet === null ? "Continue" : empty ? "Look around first" : "Start trading"} variant={empty ? "secondary" : "primary"} onPress={onDone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 10, paddingTop: 16 },
  badge: { position: "absolute", right: -4, bottom: -4, width: 30, height: 30, borderRadius: 15, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  card: { alignSelf: "stretch", borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8, marginTop: 8 },
  actions: { alignSelf: "stretch", gap: 10, marginTop: 6 },
});
