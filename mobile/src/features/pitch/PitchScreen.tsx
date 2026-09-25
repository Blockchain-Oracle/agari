import { useMemo } from "react";
import { useVenueUsage } from "@/features/pitch/useVenueUsage";
import { Screen } from "~/components/kit";
import { Deck } from "./Deck";
import { SLIDES_A } from "./SlidesA";
import { slidesB } from "./SlidesB";

/** `/pitch` — web PitchDeck.tsx: the folio's fifteen slides; the usage slide reads the venue once at mount, as web's does. */
export function PitchScreen() {
  const usage = useVenueUsage();
  const slides = useMemo(() => [...SLIDES_A, ...slidesB(usage)], [usage]);
  return (
    <Screen title="Pitch" scroll={false}>
      <Deck slides={slides} />
    </Screen>
  );
}
