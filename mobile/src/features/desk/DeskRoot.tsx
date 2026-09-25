import { isOk } from "@agari/core/schemas";
import { useLocalSearchParams } from "expo-router";
import { Lock, ServerOff, type LucideIcon } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { DESK } from "@/features/desk/copy";
import { DESK_ERRORS_UI } from "@/features/desk/copy-controls";
import { ENTRY } from "@/features/desk/entry/copy-entry";
import { DESK_NOT_CONFIGURED, DESK_NOT_SHARED, useDeskView, useInvalidateDesk } from "@/features/desk/useDesk";
import { useDeskWrites } from "@/features/desk/useDeskWrites";
import { useWalletSession } from "@/lib/wallet-session";
import { ErrorState } from "~/components/portfolio/web";
import { ExplorePage } from "~/features/explore/ExplorePage";
import { CHROME } from "~/theme/chrome";
import { DeskCockpit } from "./cockpit/DeskCockpit";
import { DeskEntry } from "./entry/DeskEntry";
import { DeskSkeleton } from "./entry/DeskSkeleton";
import { nativeDeskView as deskView } from "./native-view";
import { DeskStudio } from "./studio/DeskStudio";
import { EmptyState } from "./studio/kit-bits";

/** web's DeskScreen `Notice`: the page with one empty state, 40 px above and below. */
function Notice({ icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <ExplorePage title={DESK.title} style={styles.page}>
      <View style={styles.notice}>
        <EmptyState icon={icon} title={title} body={body} />
      </View>
    </ExplorePage>
  );
}

/**
 * `/desk`, `/desk/new` and `/desk/[id]` (web/src/features/desk/DeskScreen.tsx). `/desk` with no desk yet (no wallet,
 * or a wallet without one) is the entry; `/desk/new` (and `?basket=`) is the studio, editing with `?edit=1`; a wallet
 * with a desk lands on it; anyone else's desk is the same cockpit, read-only.
 */
export function DeskRoot({ id = null, studio = false }: { id?: string | null; studio?: boolean }) {
  const { address, isConnected, isConnecting, connect } = useWalletSession();
  const params = useLocalSearchParams<{ basket?: string; edit?: string }>();
  const basket = typeof params.basket === "string" ? params.basket : null;
  const edit = params.edit !== undefined;
  const key = id ?? address;
  const reading = useDeskView(key, address);
  const writes = useDeskWrites(key);
  const invalidate = useInvalidateDesk();
  // A visitor on someone else's desk: their own, to offer "Your desk" or "Create your desk" in its place.
  const mine = useDeskView(id !== null ? address : null, address);
  const mineExists = mine !== null && isOk(mine) && mine.value.desk !== null;

  const entry = !studio && basket === null;
  if (key === null) {
    // A remembered wallet is still restoring: a skeleton, never the entry flashing before the page.
    if (isConnecting) return <DeskSkeleton />;
    if (entry) {
      return (
        <ExplorePage title={DESK.title} style={styles.entry}>
          <DeskEntry />
        </ExplorePage>
      );
    }
    // Drafting is open to anyone: steps 01 and 02 work with no wallet; the read and Create ask for one inline.
    return <DeskStudio owner={null} view={null} writes={writes} initialBasket={basket} editing={false} onConnect={connect} />;
  }
  // The studio keeps its place while a just-connected wallet's desk is read, so the step and the draft survive.
  if (reading === null) return studio && !edit ? <DeskStudio owner={address} view={null} writes={writes} initialBasket={basket} editing={false} onConnect={connect} /> : <DeskSkeleton />;
  if (!isOk(reading)) {
    if (reading.error.technical === DESK_NOT_CONFIGURED) return <Notice icon={ServerOff} title={ENTRY.notConfiguredTitle} body={DESK_ERRORS_UI.notConfigured} />;
    if (reading.error.technical === DESK_NOT_SHARED) return <Notice icon={Lock} title={ENTRY.notSharedTitle} body={DESK.visitor} />;
    return (
      <ExplorePage title={DESK.title} onRefresh={invalidate} style={styles.error}>
        <ErrorState diagnosis={reading.error} />
      </ExplorePage>
    );
  }
  const view = deskView(reading.value);
  const own = view.isOwner && isConnected;
  if (!view.exists && id === null && entry) {
    return (
      <ExplorePage title={DESK.title} onRefresh={invalidate} style={styles.entry}>
        <DeskEntry />
      </ExplorePage>
    );
  }
  if (!view.exists || (studio && own)) {
    return <DeskStudio owner={own || !view.exists ? address : null} view={view.exists ? view : null} writes={writes} initialBasket={basket} editing={studio && view.exists && edit} onConnect={connect} />;
  }
  const visitorCta = view.isOwner ? null : mineExists ? { href: "/desk", label: ENTRY.yours, primary: false } : { href: "/desk/new", label: ENTRY.start, primary: true };
  return <DeskCockpit view={view} actions={own ? writes : null} visitorCta={visitorCta} />;
}

const styles = StyleSheet.create({
  // .dk-page: 28 px above, 64 px below (plus the dock's 112).
  page: { paddingTop: 28, paddingBottom: 64 + CHROME.dockClearance },
  entry: { paddingTop: 28, paddingBottom: 64 + CHROME.dockClearance },
  notice: { paddingVertical: 40 },
  // web's `container py-8`.
  error: { paddingTop: 32, paddingBottom: 32 + CHROME.dockClearance },
});
