import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import { SymbolView } from "expo-symbols";
import { Platform, Share, StyleSheet, Text, View } from "react-native";
import { INSTALL } from "@/features/install/copy";
import { Button, Card, haptic, Row, Rows, Screen, SectionHeader } from "~/components/kit";
import { AgariMark } from "~/components/shell/AgariMark";
import { pushToast } from "~/components/toast/store";
import { marketsEnv, SITE_URL } from "~/lib/env";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

const WEB_HOST = new URL(SITE_URL).host;
const [WEB_META, DEVNET_META] = INSTALL.meta;

/** web DownloadPage.tsx's head, from the phone: the eyebrow says where Agari also runs; the title and line are web's. */
function Head() {
  const { color } = useTheme();
  return (
    <View style={styles.head}>
      <Text style={[styles.eyebrow, { color: color.accent }]}>AGARI ON YOUR OTHER DEVICES</Text>
      <Text style={[TYPE.display, { color: color.ink }]} accessibilityRole="header">
        {INSTALL.titleLead}
        <Text style={{ color: color.accent }}>{INSTALL.titleEm}</Text>
      </Text>
      <Text style={[TYPE.body, { color: color.inkSecondary }]}>{INSTALL.line}</Text>
    </View>
  );
}

/** What this install is: the app's own version and platform, and the network it trades on. */
function ThisPhone() {
  const version = Constants.expoConfig?.version ?? "—";
  const os = `${Platform.OS === "ios" ? "iOS" : "Android"} ${String(Platform.Version)}`;
  return (
    <>
      <SectionHeader index="01" title="This phone" desc="You are in the native app — every screen here is drawn on the phone." />
      <Rows>
        <Row label="App" value={`Agari ${version}`} />
        <Row label="Platform" value={os} />
        <Row label="Network" value={`Solana ${marketsEnv.cluster}`} tone="accent" hint={DEVNET_META?.note} />
      </Rows>
    </>
  );
}

/** The web app for a computer: the address to type, copy or send to yourself, and web's own install note. */
function OnAComputer() {
  const { color } = useTheme();
  const copy = async () => {
    await Clipboard.setStringAsync(SITE_URL);
    haptic.success();
    pushToast({ tone: "neutral", title: "Link copied", description: SITE_URL });
  };
  return (
    <>
      <SectionHeader index="02" title="On a computer" desc={WEB_META ? `${WEB_META.label} · ${WEB_META.note}` : undefined} />
      <Card>
        <View style={styles.urlRow}>
          <SymbolView name={{ ios: "desktopcomputer", android: "computer" }} size={22} tintColor={color.accent} />
          <Text style={[TYPE.dataLg, styles.url, { color: color.ink }]} selectable>
            {WEB_HOST}
          </Text>
        </View>
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{INSTALL.manualHint}</Text>
        <View style={styles.actions}>
          <Button label="Copy link" icon={{ ios: "doc.on.doc", android: "content_copy" }} onPress={() => void copy()} variant="secondary" style={styles.action} />
          <Button
            label="Send to…"
            icon={{ ios: "square.and.arrow.up", android: "share" }}
            onPress={() => void Share.share({ message: `Agari — ${SITE_URL}`, url: SITE_URL })}
            variant="outline"
            style={styles.action}
          />
        </View>
      </Card>
    </>
  );
}

/** Another phone: an invite build from the team (no store listing), or web's own install path — Safari's Add to Home Screen, or the browser menu. */
function OnAnotherPhone() {
  const { color } = useTheme();
  return (
    <>
      <SectionHeader index="03" title="On another phone" desc="The native app has no store listing: ask the team for an invite build. Or open the web app there and install it from the browser." />
      <Card>
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>iPhone · {INSTALL.cta.ios}</Text>
        {INSTALL.iosSteps.map((step, index) => (
          <View key={step} style={styles.stepRow}>
            <Text style={[styles.stepNum, { color: color.accent, borderColor: color.accentDim }]}>{index + 1}</Text>
            <Text style={[TYPE.body, styles.stepText, { color: color.ink }]}>{step}</Text>
          </View>
        ))}
        <View style={[styles.rule, { backgroundColor: color.hairline }]} />
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>Android · {INSTALL.cta.manual}</Text>
        <Text style={[TYPE.body, { color: color.inkSecondary }]}>{INSTALL.manualHint}</Text>
      </Card>
    </>
  );
}

/**
 * `/download` — web features/install, turned round for the phone: the app is already here, so the page is about
 * Agari's other doors (the web app on a computer, another phone), then web's three points and its foot, word for word.
 */
export function DownloadScreen() {
  const { color } = useTheme();
  return (
    <Screen title={INSTALL.title}>
      <Head />
      <ThisPhone />
      <OnAComputer />
      <OnAnotherPhone />
      <SectionHeader index="04" title="Everywhere Agari runs" />
      {INSTALL.points.map((point) => (
        <Card key={point.title}>
          <View style={styles.point}>
            <AgariMark width={22} height={22} />
            <Text style={[TYPE.title, { color: color.ink }]}>{point.title}</Text>
          </View>
          <Text style={[TYPE.body, { color: color.inkSecondary }]}>{point.body}</Text>
        </Card>
      ))}
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{INSTALL.foot}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: 10 },
  eyebrow: { fontFamily: FONT.data, fontSize: 10.5, letterSpacing: 1.8 },
  urlRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  url: { flexShrink: 1 },
  actions: { flexDirection: "row", gap: 8 },
  action: { flex: 1 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepNum: {
    fontFamily: FONT.dataStrong,
    fontSize: 12,
    width: 24,
    height: 24,
    lineHeight: 22,
    textAlign: "center",
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  stepText: { flex: 1 },
  rule: { height: StyleSheet.hairlineWidth },
  point: { flexDirection: "row", alignItems: "center", gap: 10 },
});
