import { isOk } from "@agari/core/schemas";
import { StyleSheet, View } from "react-native";
import { RECORD } from "@/features/desk/copy-record";
import { useDecision, useDeskView, useInvalidateDesk } from "@/features/desk/useDesk";
import { useWalletSession } from "@/lib/wallet-session";
import { Skeleton } from "~/components/kit";
import { ExplorePage } from "~/features/explore/ExplorePage";
import { nativeDeskView as deskView } from "../native-view";
import { DeskErrorState } from "../record/states";
import { useDeskClock } from "../useDeskClock";
import { DecisionSections } from "./DecisionSections";

/** web's decision/DecisionSkeleton.tsx: the page's own shape while it loads — a line, the hero, four stepper rows. */
function DecisionSkeleton() {
  return (
    <View style={styles.skel} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <Skeleton width={160} height={12} radius={8} />
      <Skeleton height={180} radius={20} />
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.skelStep}>
          <Skeleton width={40} height={40} radius={12} />
          <View style={styles.grow}>
            <Skeleton height={120} radius={14} />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * `/desk/[id]/decision/[seq]` (web's DecisionScreen.tsx): one decision read live; the desk's liveness is read off the
 * proof. The desk's own view (usually cached from the desk page) adds the premium ceiling to the price strip.
 */
export function DecisionScreen({ id, seq }: { id: string; seq: number }) {
  const { address } = useWalletSession();
  const { nowSec, zone } = useDeskClock();
  const invalidate = useInvalidateDesk();
  const reading = useDecision(id, seq, address);
  const desk = useDeskView(id, address);
  const view = desk && isOk(desk) ? deskView(desk.value) : null;
  const ceilingBps = view && (view.mandate || view.wire.chain) ? view.limits.maxPremiumBps : null;
  const ok = reading !== null && isOk(reading);
  return (
    <ExplorePage title={RECORD.decision.sections.decision} onRefresh={invalidate} style={reading !== null && !ok ? styles.state : styles.page}>
      {reading === null ? <DecisionSkeleton /> : null}
      {reading !== null && !isOk(reading) ? <DeskErrorState diagnosis={reading.error} backHref={`/desk/${id}/record`} /> : null}
      {reading !== null && isOk(reading) ? <DecisionSections decision={reading.value} base={`/desk/${id}`} nowSec={nowSec} zone={zone} ceilingBps={ceilingBps} /> : null}
    </ExplorePage>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: 28, gap: 20 },
  state: { paddingTop: 32 },
  skel: { gap: 14 },
  skelStep: { flexDirection: "row", gap: 14 },
  grow: { flex: 1 },
});
