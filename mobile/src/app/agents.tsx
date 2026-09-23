import { ADVICE_COPY } from "@agari/core/copy";
import { router, type Href } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { RECORD } from "@/features/desk/copy-record";
import { AGENTS, STRATEGIES } from "@/features/strategies/copy";
import { useRefreshStrategies, useStrategies } from "@/features/strategies/useStrategies";
import { Button, Card, EmptyState, Hero, ReadingView, Screen } from "~/components/kit";
import { AgentsBoard } from "~/features/agents/AgentsBoard";
import { TYPE, useTheme } from "~/theme";

const go = (href: Href) => router.push(href);

/** `/agents` — web's features/strategies/AgentsScreen.tsx: the runners ranked on entrusted capital and copy-trades. */
export default function AgentsScreen() {
  const { color } = useTheme();
  const reading = useStrategies();
  const refresh = useRefreshStrategies();
  return (
    <Screen title={AGENTS.title} onRefresh={refresh}>
      <Hero kicker={`${AGENTS.crumb.root} / ${AGENTS.crumb.here}`} title={AGENTS.headline} lead={AGENTS.intro} />
      <Card tone="cream">
        <Text style={[TYPE.body, { color: color.creamInk }]}>{RECORD.hooks.agents.body}</Text>
        <Button label={RECORD.hooks.agents.cta.replace(" →", "")} trailing="→" size="sm" onPress={() => go("/desk" as Href)} />
      </Card>
      <View style={styles.actions}>
        <Button label="Create an agent" variant="primary" onPress={() => go("/strategies")} />
        <View style={styles.pair}>
          <Button label="Copy a strategy" variant="secondary" size="sm" style={styles.flex} onPress={() => go({ pathname: "/strategies", params: { view: "copy" } })} />
          <Button label="Your strategies" variant="secondary" size="sm" style={styles.flex} onPress={() => go({ pathname: "/strategies", params: { view: "yours" } })} />
        </View>
      </View>
      <ReadingView reading={reading} loading="list" retry={refresh}>
        {(payload) => (payload.deployed ? <AgentsBoard payload={payload} /> : <EmptyState why={AGENTS.title} detail={STRATEGIES.notDeployed.body} />)}
      </ReadingView>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{ADVICE_COPY.notAdvice}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 8 },
  pair: { flexDirection: "row", gap: 8 },
  flex: { flex: 1 },
});
