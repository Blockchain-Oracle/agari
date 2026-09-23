import { useRouter } from "expo-router";
import { useMemo } from "react";
import { useVenueUsage } from "@/features/pitch/useVenueUsage";
import { Screen } from "~/components/kit";
import { Pager } from "./Pager";
import { SLIDES_A } from "./SlidesA";
import { slidesB } from "./SlidesB";

/**
 * `/pitch` — web PitchDeck.tsx: the folio's fifteen slides as native paged sheets. Swipe or Back / Next replace
 * web's arrow keys and dots; the usage slide reads the venue once at mount, as web's deck does.
 */
export function PitchScreen() {
  const router = useRouter();
  const usage = useVenueUsage();
  const pages = useMemo(() => [...SLIDES_A, ...slidesB(usage)], [usage]);
  return (
    <Screen title="Pitch" scroll={false}>
      <Pager pages={pages} finish={{ label: "Check it live", onPress: () => router.push("/status") }} />
    </Screen>
  );
}
