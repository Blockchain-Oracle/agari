import { ADVICE_COPY } from "@agari/core/copy";
import { router, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RECORD } from "@/features/desk/copy-record";
import { AGENTS, STRATEGIES } from "@/features/strategies/copy";
import { useRefreshStrategies, useStrategies } from "@/features/strategies/useStrategies";
import { ExplorePage } from "~/features/explore/ExplorePage";
import { CapabilityPending, ReadingBoundary } from "~/features/strategies/States";
import { DeskPill, ST, useStrat } from "~/features/strategies/ui";
import { FONT } from "~/theme";
import { AgentsBoard } from "./AgentsBoard";

const go = (href: string) => router.push(href as Href);

/**
 * `/agents` — web's features/strategies/AgentsScreen.tsx and app/agents/page.tsx: the Agari / Agents crumb, the
 * leaderboard headline and intro, the two-purses card that opens the desk, the three entry pills, then the board (or
 * web's CapabilityPending when the registry is not deployed) and ADVICE_COPY.notAdvice under the container.
 */
export function AgentsScreen() {
  const { t, color } = useStrat();
  const reading = useStrategies();
  const refresh = useRefreshStrategies();
  return (
    <ExplorePage title={AGENTS.title} onRefresh={refresh} style={styles.page}>
      <View style={styles.container}>
        <View style={styles.crumb}>
          <Pressable onPress={() => router.navigate("/" as Href)} accessibilityRole="link">
            <Text style={[styles.crumbText, { color: color.inkMuted }]}>{AGENTS.crumb.root}</Text>
          </Pressable>
          <Text style={[styles.crumbText, { color: color.inkDisabled }]}>/</Text>
          <Text style={[styles.crumbText, { color: color.ink }]}>{AGENTS.crumb.here}</Text>
        </View>
        <Text style={[styles.h1, { color: color.ink }]} accessibilityRole="header">
          {AGENTS.headline}
        </Text>
        <Text style={[ST.textSmRelaxed, styles.intro, { color: color.inkSecondary }]}>{AGENTS.intro}</Text>
        <View style={[styles.panel, { backgroundColor: color.ground, borderColor: t.ink(0.08) }]}>
          <Text style={[ST.textSmRelaxed, { color: color.ink }]}>{RECORD.hooks.agents.body}</Text>
          <DeskPill label={RECORD.hooks.agents.cta} on onPress={() => go("/desk")} />
        </View>
        <View style={styles.entry} accessibilityLabel="Agent actions">
          <DeskPill label="Create an agent →" onPress={() => go("/strategies")} />
          <DeskPill label="Copy a strategy →" onPress={() => router.push({ pathname: "/strategies", params: { view: "copy" } })} />
          <DeskPill label="Your strategies →" onPress={() => router.push({ pathname: "/strategies", params: { view: "yours" } })} />
        </View>
        <ReadingBoundary reading={reading} retry={refresh}>
          {(payload) =>
            payload.deployed ? (
              <AgentsBoard payload={payload} />
            ) : (
              <CapabilityPending eyebrow={AGENTS.title} title={AGENTS.title} dependency={AGENTS.notDeployed.dependency} body={STRATEGIES.notDeployed.body} />
            )
          }
        </ReadingBoundary>
      </View>
      <Text style={[ST.caption, styles.advice, { color: color.inkMuted }]}>{ADVICE_COPY.notAdvice}</Text>
    </ExplorePage>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 0 },
  container: { paddingTop: 28, paddingBottom: 48, paddingHorizontal: 18 },
  crumb: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 28 },
  crumbText: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.98, textTransform: "uppercase" },
  h1: { fontFamily: FONT.headingHeavy, fontSize: 36, lineHeight: 57.6, letterSpacing: -0.9, marginBottom: 8 },
  intro: { marginBottom: 24 },
  panel: { borderWidth: 1, borderRadius: 4, padding: 20, marginBottom: 32, gap: 12 },
  entry: { flexDirection: "row", flexWrap: "wrap", gap: 9.75, marginBottom: 30 },
  advice: { paddingHorizontal: 18, paddingBottom: 40 },
});
