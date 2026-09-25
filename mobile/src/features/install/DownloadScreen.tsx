import { Platform, StyleSheet, Text, View } from "react-native";
import { ExplorePage } from "~/features/explore/ExplorePage";
import { AgariMark } from "~/components/shell/AgariMark";
import { FONT, useTheme } from "~/theme";
import { downloadTokens } from "~/theme/web/explore/download";
import { APP_INSTALL } from "./copy";
import { InstallCta } from "./InstallCta";
import { PhoneShot } from "./PhoneShot";

/** `ui-serif` italic under web's title `em`: Georgia on iOS, the system serif on Android. */
const SERIF = Platform.select({ ios: "Georgia", default: "serif" });

/**
 * `/download` — web DownloadPage.tsx as it draws at 402 px (`.dl-*`, part-18.css): the phone capture, then the
 * eyebrow, the title with its serif italic, the line, the pill CTA and the meta row; the three points over a rule and
 * the foot. The app is already installed, so the CTA expands, as web's does, into where else Agari installs, and the
 * meta row names where Agari runs.
 */
export function DownloadScreen() {
  const { name, color } = useTheme();
  const t = downloadTokens(name);

  return (
    <ExplorePage title={APP_INSTALL.title} style={styles.dl}>
      <PhoneShot />

      <View style={styles.copy}>
        <Text style={[styles.eyebrow, { color: color.inkMuted }]}>{APP_INSTALL.eyebrow}</Text>
        <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
          {APP_INSTALL.titleLead}
          <Text style={[styles.titleEm, { color: color.accent }]}>{APP_INSTALL.titleEm}</Text>
        </Text>
        <Text style={[styles.line, { color: color.inkSecondary }]}>{APP_INSTALL.line}</Text>

        <InstallCta />

        <View style={styles.meta}>
          {APP_INSTALL.meta.map((item) => (
            <View key={item.label} style={styles.metaItem}>
              <Text style={[styles.metaLabel, { color: color.accent }]}>{item.label}</Text>
              <Text style={[styles.metaNote, { color: color.inkMuted }]}>{item.note}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.points, { borderTopColor: t.pointsRule }]}>
        {APP_INSTALL.points.map((point) => (
          <View key={point.title}>
            <AgariMark width={22} height={22} figure={color.accent} />
            <Text style={[styles.pointTitle, { color: color.ink }]}>{point.title}</Text>
            <Text style={[styles.pointBody, { color: color.inkMuted }]}>{point.body}</Text>
          </View>
        ))}
      </View>

      <Text style={[styles.foot, { color: color.inkDisabled }]}>{APP_INSTALL.foot}</Text>
    </ExplorePage>
  );
}

const styles = StyleSheet.create({
  // .dl (28 20.1 90) around .dl-hero's 20.1 top; the page frame adds the dock floor under the 90.
  dl: { paddingHorizontal: 20, paddingTop: 48, paddingBottom: 202 },
  copy: { marginTop: 44 },
  eyebrow: { fontFamily: FONT.bodyStrong, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.98, marginBottom: 12 },
  title: { fontFamily: FONT.headingHeavy, fontSize: 39, lineHeight: 40, letterSpacing: -1.365, marginTop: 14 },
  titleEm: { fontFamily: SERIF, fontStyle: "italic", fontWeight: "500", letterSpacing: -1.365 },
  line: { fontFamily: FONT.body, fontSize: 14.7, lineHeight: 24.255, marginTop: 22 },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: 20, marginTop: 40 },
  metaItem: { gap: 5 },
  metaLabel: { fontFamily: FONT.data, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.54, textTransform: "uppercase" },
  metaNote: { fontFamily: FONT.body, fontSize: 12.9, lineHeight: 20.64 },
  points: { gap: 22, marginTop: 60, paddingTop: 30, borderTopWidth: 1 },
  pointTitle: { fontFamily: FONT.heading, fontSize: 16.2, lineHeight: 25.92, letterSpacing: -0.162, marginTop: 16, marginBottom: 8 },
  pointBody: { fontFamily: FONT.body, fontSize: 13.8, lineHeight: 22.08, maxWidth: 296 },
  foot: { fontFamily: FONT.body, fontSize: 12.6, lineHeight: 21.42, marginTop: 46 },
});
