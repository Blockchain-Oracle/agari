import { isOk } from "@agari/core/schemas";
import type { Address } from "@agari/core/types";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { DESK, DESK_ADVICE } from "@/features/desk/copy";
import { RECORD } from "@/features/desk/copy-record";
import type { RecordSummaryWire } from "@/features/desk/protocol";
import { useDeskRecords, useDeskView, useInvalidateDesk } from "@/features/desk/useDesk";
import { useWalletSession } from "@/lib/wallet-session";
import { Button, ErrorState, LoadingState, Screen } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";
import { Eyebrow } from "../kit";
import { useDeskClock } from "../useDeskClock";
import { ActivityTimeline } from "./ActivityTimeline";

const L = RECORD.list;

/** Opening the whole record is one of Go live's two conditions: the owner's first visit tells the index so. */
function useMarkOpened(id: string, owner: Address | null, needed: boolean) {
  const invalidate = useInvalidateDesk();
  useEffect(() => {
    if (!needed || !owner) return;
    void fetch(`/api/desk/${encodeURIComponent(id)}/opened`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ owner }) }).then(() => invalidate());
  }, [id, owner, needed, invalidate]);
}

/**
 * `/desk/[id]/record` (web's RecordList.tsx `RecordScreen`): every check the desk made, newest first, quiet runs
 * folded, older pages on demand. The owner's first visit marks the record opened.
 */
export function RecordScreen({ id }: { id: string }) {
  const { color } = useTheme();
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

  if (view === null || page === null) {
    return (
      <Screen title={L.title}>
        <LoadingState shape="list" />
      </Screen>
    );
  }
  if (!isOk(view) || !isOk(page)) {
    const error = !isOk(view) ? view.error : !isOk(page) ? page.error : null;
    return (
      <Screen title={L.title} onRefresh={invalidate}>
        {error ? <ErrorState diagnosis={error} retry={() => void invalidate()} /> : null}
      </Screen>
    );
  }
  const records = before === null ? page.value.records : pages.flat();
  const next = page.value.nextBefore;
  const isLive = desk?.address !== null && desk?.address !== undefined;
  const older = () => {
    setPages((p) => (before === null ? [page.value.records, []] : [...p, []]));
    setBefore(next);
  };
  return (
    <Screen title={L.title} onRefresh={invalidate}>
      <View style={styles.hero}>
        <Eyebrow text={isOwner ? (isLive ? DESK.eyebrow.live : DESK.eyebrow.practice) : isLive ? DESK.eyebrow.visitorLive : DESK.eyebrow.visitorPractice} live={isLive} />
        <Text style={[TYPE.headline, { color: color.ink }]} accessibilityRole="header">
          {L.title}
        </Text>
        <Text style={[TYPE.body, { color: color.inkSecondary }]}>{L.intro}</Text>
        {!isOwner ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{DESK.visitor}</Text> : null}
      </View>
      <ActivityTimeline records={records} base={`/desk/${desk?.id ?? id}`} nowSec={nowSec} zone={zone} />
      {next !== null ? <Button label={L.older.replace(" →", "")} variant="outline" trailing="→" onPress={older} /> : null}
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{DESK_ADVICE}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 8 },
});
