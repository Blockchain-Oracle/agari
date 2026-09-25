import { StyleSheet, View } from "react-native";
import { DESK } from "@/features/desk/copy";
import { Skeleton } from "~/components/portfolio/web";
import { ExplorePage } from "~/features/explore/ExplorePage";
import { useTheme } from "~/theme";
import { CHROME } from "~/theme/chrome";

/** web's entry/DeskSkeleton.tsx: the desk page while it loads, in the cockpit's shape — header, value chart, tabs, cards. */
export function DeskSkeleton() {
  const { color } = useTheme();
  return (
    <ExplorePage title={DESK.title} style={styles.page}>
      <View style={styles.skel} accessibilityRole="progressbar" accessibilityLabel="Loading" accessibilityState={{ busy: true }}>
        <Skeleton width={224} height={12} radius={6} />
        <View style={styles.head}>
          <Skeleton width={44} height={44} radius={22} />
          <Skeleton width={192} height={32} radius={6} />
          <Skeleton width={80} height={24} radius={12} />
        </View>
        <Skeleton width={176} height={40} radius={6} />
        <Skeleton height={260} radius={18} />
        <View style={[styles.tabs, { borderBottomColor: color.hairline }]}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width={80} height={20} radius={6} />
          ))}
        </View>
        <View style={styles.grid}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={140} radius={14} />
          ))}
        </View>
      </View>
    </ExplorePage>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 64 + CHROME.dockClearance },
  skel: { gap: 16 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  tabs: { flexDirection: "row", gap: 10, paddingBottom: 10, borderBottomWidth: 1, overflow: "hidden" },
  grid: { gap: 14 },
});
