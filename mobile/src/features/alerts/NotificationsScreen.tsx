import { router } from "expo-router";
import { Platform, StyleSheet, Switch, Text, View } from "react-native";
import { PUSH_KINDS, type PushKind } from "@/features/push/protocol";
import { haptic, Screen } from "~/components/kit";
import { LoadingState, SectionHeader, WebButton } from "~/components/portfolio/web";
import { FONT, useTheme } from "~/theme";
import { CHROME } from "~/theme/chrome";
import { WEB_TYPE } from "~/theme/web/portfolio";
import { ALERTS } from "./copy";
import { usePushSettings } from "./usePushSettings";

const short = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`;

/**
 * More → Notifications (S26.4, phone-only). Web has no page for it, so it speaks web's language: the `/news` page head
 * (display title, one sentence), numbered `SectionHeader`s, and the `rounded-lg border bg-surface-1 p-4` panel the
 * states use, with web's shadcn buttons — push on or off, which news this phone hears, and the Lock Screen extras.
 */
export function NotificationsScreen() {
  const { color } = useTheme();
  const push = usePushSettings();
  const { state, busy, error } = push;
  const kinds: readonly PushKind[] = state.phase === "on" || state.phase === "other-wallet" ? state.reg.kinds : [];
  const panel = [styles.panel, { backgroundColor: color.surface1, borderColor: color.hairline }];

  const toggle = (kind: PushKind, on: boolean) => {
    haptic.select();
    void push.setKinds(on ? PUSH_KINDS.filter((k) => k === kind || kinds.includes(k)) : kinds.filter((k) => k !== kind));
  };

  return (
    <Screen title={ALERTS.title} contentStyle={styles.page}>
      <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
        {ALERTS.title}
      </Text>
      <Text style={[styles.intro, { color: color.inkSecondary }]}>{ALERTS.intro}</Text>

      <View style={styles.section}>
        <SectionHeader index="01" title={ALERTS.title} />
        {state.phase === "loading" ? <LoadingState shape="plate" label={ALERTS.title} /> : null}

        {state.phase === "off" ? (
          <View style={panel}>
            <Text style={[WEB_TYPE.body, { color: color.ink }]}>{push.connected ? ALERTS.signNote : ALERTS.connectFirst}</Text>
            {push.connected ? (
              <WebButton label={busy ? ALERTS.switching : ALERTS.on} onPress={() => void push.turnOn()} disabled={busy} block />
            ) : (
              <WebButton label="Connect" onPress={() => router.push("/connect")} />
            )}
          </View>
        ) : null}

        {state.phase === "on" || state.phase === "other-wallet" ? (
          <View style={panel}>
            <Text style={[WEB_TYPE.bodyStrong, { color: color.ink }]} accessibilityLiveRegion="polite">
              {state.phase === "on" ? ALERTS.following(short(state.reg.wallet)) : ALERTS.otherWallet(short(state.reg.wallet))}
            </Text>
            {state.phase === "other-wallet" ? (
              <WebButton label={busy ? ALERTS.switching : ALERTS.moveHere} variant="secondary" size="sm" onPress={() => void push.turnOn(kinds.length ? [...kinds] : undefined)} disabled={busy} />
            ) : null}
            {PUSH_KINDS.map((kind) => (
              <View key={kind} style={[styles.switchRow, { borderTopColor: color.hairline }]}>
                <View style={styles.switchCopy}>
                  <Text style={[WEB_TYPE.bodyStrong, { color: color.ink }]}>{ALERTS.kinds[kind].label}</Text>
                  <Text style={[WEB_TYPE.caption, { color: color.inkSecondary }]}>{ALERTS.kinds[kind].hint}</Text>
                </View>
                <Switch
                  value={kinds.includes(kind)}
                  disabled={busy}
                  onValueChange={(on) => toggle(kind, on)}
                  trackColor={{ true: color.accent, false: color.surface2 }}
                  thumbColor={color.onAccent}
                  ios_backgroundColor={color.surface2}
                  accessibilityLabel={ALERTS.kinds[kind].label}
                />
              </View>
            ))}
            <WebButton label={busy ? ALERTS.switching : ALERTS.off} variant="ghost" size="sm" onPress={() => void push.turnOff()} disabled={busy} />
          </View>
        ) : null}

        {error ? (
          <Text style={[WEB_TYPE.caption, { color: color.warning }]} accessibilityLiveRegion="assertive" selectable>
            {error}
          </Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <SectionHeader index="02" title={ALERTS.live.title} desc={Platform.OS === "ios" ? ALERTS.live.body : ALERTS.live.android} />
      </View>
      {Platform.OS === "ios" ? (
        <View style={styles.section}>
          <SectionHeader index="03" title={ALERTS.widget.title} desc={ALERTS.widget.body} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 18, paddingTop: 48, paddingBottom: 96 + CHROME.dockClearance, gap: 0 },
  title: { fontFamily: FONT.headingHeavy, fontSize: 36, lineHeight: 39.6, letterSpacing: -0.9, marginBottom: 8 },
  intro: { fontFamily: FONT.body, fontSize: 14, lineHeight: 21.7 },
  section: { gap: 16, marginTop: 32 },
  panel: { gap: 12, borderRadius: 12, borderWidth: 1, padding: 16 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 12, borderTopWidth: 1 },
  switchCopy: { flex: 1, gap: 2 },
});
