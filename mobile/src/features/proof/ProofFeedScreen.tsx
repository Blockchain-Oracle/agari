import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { sourceChips } from "@/features/proof/feed";
import { PROOF_FEED as F } from "@/features/proof/feed-copy";
import { FEED_LIMIT } from "@/features/proof/useProofFeed";
import { useProofFeed } from "@/features/proof/useProofFeed";
import { useWhen } from "@/lib/when";
import { Button, Chips, EmptyState, LoadingState, Screen, SectionHeader } from "~/components/kit";
import { FONT, TYPE, useTheme } from "~/theme";
import { FeedRowView } from "./FeedRowView";

/** Rows drawn at first; the rest of the read opens a page at a time (web's PAGE). */
const PAGE = 40;

/**
 * `/proof` — web's ProofFeedScreen (features/proof/ProofFeedScreen.tsx): every settled Window across every lane, newest
 * first, filterable by the sources the rows actually hold, each opening its print proof. One cached index read.
 */
export function ProofFeedScreen() {
  const { color } = useTheme();
  const client = useQueryClient();
  const when = useWhen();
  const reading = useProofFeed();
  const [source, setSource] = useState<string>(F.all);
  const [shown, setShown] = useState(PAGE);
  const rows = reading?.ok ? reading.value : null;
  const chips = rows ? sourceChips(rows) : [];
  const active = source === F.all || chips.includes(source) ? source : F.all;
  const filtered = rows ? (active === F.all ? rows : rows.filter((r) => r.sourceName === active)) : [];
  const visible = filtered.slice(0, shown);
  const pick = (next: string) => {
    setSource(next);
    setShown(PAGE);
  };

  return (
    <Screen title={F.title} onRefresh={() => client.invalidateQueries({ queryKey: ["agari", "proof", "feed", FEED_LIMIT] })}>
      <SectionHeader index={F.section.index} title={F.section.title} desc={F.section.desc} />
      <Text style={[TYPE.body, { color: color.inkSecondary }]}>{F.intro}</Text>

      {reading !== null && !reading.ok ? (
        <EmptyState why={F.unreachable} action={{ label: "Try again", onPress: () => void client.invalidateQueries({ queryKey: ["agari", "proof", "feed", FEED_LIMIT] }) }} />
      ) : (
        <>
          {chips.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel={F.filters}>
              <Chips options={[F.all, ...chips].map((chip) => ({ value: chip, label: chip }))} value={active} onPick={pick} />
            </ScrollView>
          ) : null}
          <Text style={[styles.count, { color: color.inkMuted }]}>{rows ? F.tableTitle(visible.length, filtered.length).toUpperCase() : F.loading}</Text>
          {rows === null ? <LoadingState shape="list" label={F.loading} /> : null}
          {rows !== null && filtered.length === 0 ? <EmptyState why={active === F.all ? F.none : F.noneFor(active)} /> : null}
          <View>
            {visible.map((row) => (
              <FeedRowView key={row.market} row={row} when={when} />
            ))}
          </View>
          {filtered.length > visible.length ? (
            <Button label={F.more(Math.min(PAGE, filtered.length - visible.length))} variant="outline" onPress={() => setShown((n) => n + PAGE)} />
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  count: { fontFamily: FONT.data, fontSize: 10.5, letterSpacing: 1.4 },
});
