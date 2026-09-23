import { TabStack } from "~/components/shell/TabStack";
import { GamesProvider } from "~/features/games/shell";

/**
 * The Games tab's stack inside web's games frame (`app/games/layout.tsx` → `GamesShell`): one settings store,
 * the active match, and the settings and how-to sheets, owned once for every mode under it.
 */
export default function GamesLayout() {
  return (
    <GamesProvider>
      <TabStack />
    </GamesProvider>
  );
}
