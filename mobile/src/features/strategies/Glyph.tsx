import { SymbolView } from "expo-symbols";
import { useTheme } from "~/theme";

const NAMES = {
  external: { ios: "arrow.up.right", android: "north_east" },
  forward: { ios: "arrow.right", android: "arrow_forward" },
  lock: { ios: "lock.fill", android: "lock" },
  unlock: { ios: "lock.open.fill", android: "lock_open" },
  check: { ios: "checkmark", android: "check" },
  copy: { ios: "doc.on.doc", android: "content_copy" },
} as const;

/** A small SF Symbol / Material Symbol in place of web's lucide glyphs and "↗" marks. */
export function Glyph({ name, size = 13, tint }: { name: keyof typeof NAMES; size?: number; tint?: string }) {
  const { color } = useTheme();
  return <SymbolView name={NAMES[name]} size={size} tintColor={tint ?? color.accent} />;
}
