import { isOk } from "@agari/core/schemas";
import type { Address } from "@agari/core/types";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { DESK, DESK_ADVICE } from "@/features/desk/copy";
import { RECORD } from "@/features/desk/copy-record";
import type { RecordSummaryWire } from "@/features/desk/protocol";
import { useDeskRecords, useDeskView, useInvalidateDesk } from "@/features/desk/useDesk";
import { useWalletSession } from "@/lib/wallet-session";
import { ExplorePage } from "~/features/explore/ExplorePage";
import { DkControl, DkLink, DT, Eyebrow, useDeskTheme } from "../kit";
import { useDeskClock } from "../useDeskClock";
import { ActivityTimeline } from "./ActivityTimeline";
import { DeskErrorState, PlateSkeleton } from "./states";

const L = RECORD.list;

/** Opening the whole record is one of Go live's two conditions: the owner's first visit tells the index so. */
function useMarkOpened(id: string, owner: Address | null, needed: boolean) {
  const invalidate = useInvalidateDesk();
  useEffect(() => {
    if (!needed || !owner) return;
    void fetch(`/api/desk/${encodeURIComponent(id)}/opened`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ owner }) }).then(() => invalidate());
  }, [id, owner, needed, invalidate]);
}

interface ViewProps {
  records: readonly RecordSummaryWire[];
  base: string;
  nowSec: number;
  zone: string | null;
  isOwner: boolean;
  isLive: boolean;
  /** Present when an older page exists. */
  older: (() => void) | null;
}

/** web's RecordList.tsx `RecordListView`: the hero, then every check in one panel, newest first, and Older →. */
function RecordListView({ records, base, nowSec, zone, isOwner, isLive, older }: ViewProps) {
  const { color } = useDeskTheme();
  return (
    <>
      <View style={styles.hero}>
        <Eyebrow text={isOwner ? (isLive ? DESK.eyebrow.live : DESK.eyebrow.practice) : isLive ? DESK.eyebrow.visitorLive : DESK.eyebrow.visitorPractice} live={isLive} />
        <DkLink label={L.back} href={base} />
        <Text style={[DT.title, { color: color.ink }]} accessibilityRole="header">
          {L.title}
        </Text>
        <Text style={[DT.caption, { color: color.inkSecondary }]}>{L.intro}</Text>
        {!isOwner ? <Text style={[DT.caption, { color: color.inkMuted }]}>{DESK.visitor}</Text> : null}
      </View>
      <View style={[styles.panel, { backgroundColor: color.surface1, borderColor: color.hairline }]} accessibilityLabel={L.title}>
        <ActivityTimeline records={records} base={base} nowSec={nowSec} zone={zone} />
        {older ? <DkControl label={L.older} onPress={older} /> : null}
      </View>
      <Text style={[DT.caption, { color: color.inkMuted }]}>{DESK_ADVICE}</Text>
    </>
  );
}

/**
 * `/desk/[id]/record` (web's RecordList.tsx `RecordScreen`): every check the desk made, newest first, quiet runs
 * folded, older pages on demand. The owner's first visit marks the record opened. Loading is web's plate skeleton; a
 * failed read is web's error state.
 */
export function RecordScreen({ id }: { id: string }) {
  const { address } = useWalletSession();
  const { nowSec, zone } = useDeskClock();
  const invalidate = useInvalidateDesk();
  const view = useDeskView(id, address);
  const [pages, setPages] = useState<RecordSummaryWire[][]>([]);
  const [before, setBefore] = useState<number | null>(null);
  const page = useDeskRecords(id, address, before);
  const desk = view && isOk(view) ? view.value.desk : null;
  const isOwner = view && isOk(view) ? view.value.viewer === "owner" : false;
  useMarkOpened(id, address, isOwner && desk !== null && desk.recordOpenedAtSec === null);
  useEffect(() => {
    if (page && isOk(page)) setPages((p) => (before === null ? [page.value.records] : [...p.slice(0, -1), page.value.records]));
  }, [page, before]);

  const body = (() => {
    if (view === null || page === null) return <PlateSkeleton />;
    if (!isOk(view)) return <DeskErrorState diagnosis={view.error} />;
    if (!isOk(page)) return <DeskErrorState diagnosis={page.error} />;
    const records = before === null ? page.value.records : pages.flat();
    const next = page.value.nextBefore;
    return (
      <RecordListView
        records={records}
        base={`/desk/${desk?.id ?? id}`}
        nowSec={nowSec}
        zone={zone}
        isOwner={isOwner}
        isLive={desk?.address !== null && desk?.address !== undefined}
        older={
          next === null
            ? null
            : () => {
                setPages((p) => (before === null ? [page.value.records, []] : [...p, []]));
                setBefore(next);
              }
        }
      />
    );
  })();
  const ready = view !== null && page !== null && isOk(view) && isOk(page);
  return (
    <ExplorePage title={L.title} onRefresh={invalidate} style={ready ? styles.page : styles.state}>
      {body}
    </ExplorePage>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: 28, gap: 20 },
  state: { paddingTop: 32 },
  hero: { gap: 8 },
  panel: { gap: 12, padding: 18, borderWidth: 1, borderRadius: 12 },
});
