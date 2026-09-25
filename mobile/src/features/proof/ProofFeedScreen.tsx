import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { sourceChips } from "@/features/proof/feed";
import { PROOF_FEED as F } from "@/features/proof/feed-copy";
import { FEED_LIMIT, useProofFeed } from "@/features/proof/useProofFeed";
import { useWhen } from "@/lib/when";
import { haptic } from "~/components/kit";
import { ExplorePage } from "~/features/explore/ExplorePage";
import { SectionHeader } from "~/features/explore/SectionHeader";
import { FONT, useTheme } from "~/theme";
import { CHROME } from "~/theme/chrome";
import { statusTokens } from "~/theme/web/explore/status";
import { FeedRowView, FeedSkeletonRow } from "./FeedRowView";
import { Holding, StatusTable } from "./Frame";

/** Rows drawn at first; the rest of the read opens a page at a time. */
const PAGE = 40;
const SKELETON_ROWS = 8;

/**
 * `/proof` — web's ProofFeedScreen.tsx: the settled Windows across every lane, newest first, each opening its print
 * proof. Masayume's `/status` frame (numbered header, holding states, the hairline table) with mono filter chips over
 * the sources the rows actually hold. One cached read, never polled.
 */
export function ProofFeedScreen() {
  const { name, color } = useTheme();
  const t = statusTokens(name);
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
    haptic.select();
    setSource(next);
    setShown(PAGE);
  };

  return (
    <ExplorePage title={F.title} onRefresh={() => client.invalidateQueries({ queryKey: ["agari", "proof", "feed", FEED_LIMIT] })} style={styles.page}>
      <SectionHeader index={F.section.index} title={F.section.title} desc={F.section.desc} />
      <Text style={[styles.intro, { color: color.inkSecondary }]}>{F.intro}</Text>

      {reading !== null && !reading.ok ? (
        <Holding kind="alert" text={F.unreachable} />
      ) : (
        <View style={styles.report}>
          {chips.length > 0 ? (
            <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={F.filters}>
              {[F.all, ...chips].map((chip) => {
                const on = chip === active;
                return (
                  <Pressable
                    key={chip}
                    onPress={() => pick(chip)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={[styles.chip, on ? { borderColor: color.inkMuted, backgroundColor: t.hover } : { borderColor: color.surface2 }]}
                  >
                    <Text style={[styles.chipText, { color: on ? color.ink : color.inkMuted }]}>{chip}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <StatusTable title={rows ? F.tableTitle(visible.length, filtered.length) : F.loading}>
            {rows === null ? (
              <View accessibilityRole="progressbar" accessibilityLabel={F.loading}>
                {Array.from({ length: SKELETON_ROWS }, (_, i) => (
                  <FeedSkeletonRow key={i} first={i === 0} />
                ))}
              </View>
            ) : filtered.length === 0 ? (
              <Text style={[styles.empty, { color: color.inkMuted }]}>{active === F.all ? F.none : F.noneFor(active)}</Text>
            ) : (
              visible.map((row, i) => <FeedRowView key={row.market} row={row} when={when} first={i === 0} />)
            )}
          </StatusTable>
          {filtered.length > visible.length ? (
            <Pressable
              onPress={() => {
                haptic.tap();
                setShown((n) => n + PAGE);
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.more, { borderColor: pressed ? color.inkDisabled : color.surface2 }]}
            >
              <Text style={[styles.chipText, { color: color.inkSecondary }]}>{F.more(Math.min(PAGE, filtered.length - visible.length))}</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </ExplorePage>
  );
}

const styles = StyleSheet.create({
  // .status-page: 28 px under the header, 48 px over the dock's floor.
  page: { paddingTop: 28, paddingBottom: 48 + CHROME.dockClearance },
  intro: { marginTop: 12, fontFamily: FONT.body, fontSize: 15, lineHeight: 23.25 },
  report: { marginTop: 24, gap: 24 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { height: 30, paddingHorizontal: 14, borderWidth: 1, borderRadius: 9999, justifyContent: "center" },
  chipText: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.1, textTransform: "uppercase", textAlign: "center" },
  empty: { padding: 20, fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8 },
  more: { alignSelf: "center", height: 36, paddingHorizontal: 18, borderWidth: 1, borderRadius: 9999, justifyContent: "center" },
});
