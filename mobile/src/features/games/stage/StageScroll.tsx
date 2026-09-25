import { createContext, useContext, useRef, type ReactNode, type RefObject } from "react";
import { RefreshControl, StyleSheet } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { Checker, PAGE_PADDING, useGamesTokens } from "~/features/games/frame";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ScrollRef = RefObject<any>;
const StageScrollContext = createContext<ScrollRef | null>(null);

/** The page scroller a deck sits in, so the deck's vertical drag can hold the page still while a card is held. */
export function useStageScroll(): ScrollRef | null {
  return useContext(StageScrollContext);
}

/**
 * A games page (`.container.gm-page` over the checker, dock clearance below) that a swipe deck can live in. web's
 * active card is `touch-action: pan-x`: a vertical drag on it plays the card and never scrolls the page. Here the
 * deck's pan blocks this scroller for as long as it is active; everywhere else the page scrolls as usual.
 */
export function StageScroll({ children, refreshing = false, onRefresh }: { children: ReactNode; refreshing?: boolean; onRefresh?: () => void }) {
  const { color } = useGamesTokens();
  const ref = useRef(null);
  return (
    <StageScrollContext.Provider value={ref}>
      <ScrollView
        ref={ref}
        style={[styles.fill, { backgroundColor: color.ground }]}
        contentContainerStyle={PAGE_PADDING}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.inkMuted} /> : undefined}
      >
        <Checker />
        {children}
      </ScrollView>
    </StageScrollContext.Provider>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
