import { GamesShell } from "@/features/games";

/**
 * The one frame all seven modes share.
 *
 * Doc 06 keeps the eight folders rather than a dynamic `[game]` route so each mode keeps its own
 * loading and error boundary and its own lazy bundle — and puts the things every mode owes a player
 * here, once: the way back, the economic label, the sound/haptics/motion controls and the active
 * match. A mode added later inherits all four without being asked to remember them.
 */
export default function GamesLayout({ children }: LayoutProps<"/games">) {
  return <GamesShell>{children}</GamesShell>;
}
