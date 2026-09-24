import { router } from "expo-router";
import { Platform, StyleSheet, Switch, Text, View } from "react-native";
import { PUSH_KINDS, type PushKind } from "@/features/push/protocol";
import { Button, Card, haptic, LoadingState, Screen, SectionHeader } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";
import { ALERTS } from "./copy";
import { usePushSettings } from "./usePushSettings";

const short = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`;

/** More → Notifications (S26.4): push on or off for this phone, which news it hears, and the Lock Screen extras. */
export function NotificationsScreen() {
  const { color } = useTheme();
  const push = usePushSettings();
  const { state, busy, error } = push;
  const kinds: readonly PushKind[] = state.phase === "on" || state.phase === "other-wallet" ? state.reg.kinds : [];

  const toggle = (kind: PushKind, on: boolean) => {
    haptic.select();
    void push.setKinds(on ? PUSH_KINDS.filter((k) => k === kind || kinds.includes(k)) : kinds.filter((k) => k !== kind));
  };

  return (
    <Screen title={ALERTS.title}>
      <View style={styles.body}>
        <Text style={[TYPE.body, { color: color.inkSecondary }]}>{ALERTS.intro}</Text>
        {state.phase === "loading" ? <LoadingState shape="plate" label={ALERTS.title} /> : null}

        {state.phase === "off" ? (
          <Card>
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>{push.connected ? ALERTS.signNote : ALERTS.connectFirst}</Text>
            {push.connected ? (
              <Button label={busy ? ALERTS.switching : ALERTS.on} onPress={() => void push.turnOn()} disabled={busy} />
            ) : (
              <Button label="Connect" variant="secondary" onPress={() => router.push("/connect")} />
            )}
          </Card>
        ) : null}

        {state.phase === "on" || state.phase === "other-wallet" ? (
          <Card>
            <Text style={[TYPE.bodyStrong, { color: color.ink }]} accessibilityLiveRegion="polite">
              {state.phase === "on" ? ALERTS.following(short(state.reg.wallet)) : ALERTS.otherWallet(short(state.reg.wallet))}
            </Text>
            {state.phase === "other-wallet" ? <Button label={busy ? ALERTS.switching : ALERTS.moveHere} variant="secondary" onPress={() => void push.turnOn(kinds.length ? [...kinds] : undefined)} disabled={busy} /> : null}
            {PUSH_KINDS.map((kind) => (
              <View key={kind} style={styles.switchRow}>
                <View style={styles.switchCopy}>
                  <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{ALERTS.kinds[kind].label}</Text>
                  <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{ALERTS.kinds[kind].hint}</Text>
                </View>
                <Switch value={kinds.includes(kind)} disabled={busy} onValueChange={(on) => toggle(kind, on)} trackColor={{ true: color.accent, false: color.surface3 }} accessibilityLabel={ALERTS.kinds[kind].label} />
              </View>
            ))}
            <Button label={busy ? ALERTS.switching : ALERTS.off} variant="ghost" size="sm" onPress={() => void push.turnOff()} disabled={busy} />
          </Card>
        ) : null}

        {error ? (
          <Text style={[TYPE.caption, { color: color.loss }]} accessibilityLiveRegion="assertive" selectable>
            {error}
          </Text>
        ) : null}

        <SectionHeader title={ALERTS.live.title} desc={Platform.OS === "ios" ? ALERTS.live.body : ALERTS.live.android} />
        {Platform.OS === "ios" ? <SectionHeader title={ALERTS.widget.title} desc={ALERTS.widget.body} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: 16 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  switchCopy: { flex: 1, gap: 2 },
});
