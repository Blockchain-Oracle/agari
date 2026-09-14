/**
 * RainbowKit's default account avatar (`emojiAvatarForAddress`): a colour and an emoji picked by a 32-bit string hash
 * of the address. The colours are `.wm-ava-<n>` in `wallet-modal.css` (no hex in component code). The address is
 * hashed exactly as written: base58 is case-sensitive (D-010).
 */
const AVATARS: ReadonlyArray<readonly [color: number, emoji: string]> = [
  [0, "\u{1F336}"], [1, "\u{1F911}"], [2, "\u{1F419}"], [3, "\u{1FAD0}"], [4, "\u{1F433}"], [0, "\u{1F936}"],
  [5, "\u{1F332}"], [6, "\u{1F31E}"], [7, "\u{1F412}"], [8, "\u{1F435}"], [9, "\u{1F98A}"], [10, "\u{1F43C}"],
  [11, "\u{1F984}"], [12, "\u{1F437}"], [13, "\u{1F427}"], [8, "\u{1F9A9}"], [14, "\u{1F47D}"], [0, "\u{1F388}"],
  [8, "\u{1F349}"], [1, "\u{1F389}"], [15, "\u{1F432}"], [16, "\u{1F30E}"], [17, "\u{1F34A}"], [18, "\u{1F42D}"],
  [19, "\u{1F363}"], [1, "\u{1F425}"], [20, "\u{1F47E}"], [15, "\u{1F966}"], [0, "\u{1F479}"], [17, "\u{1F640}"],
  [4, "⛱"], [21, "⛵️"], [17, "\u{1F973}"], [8, "\u{1F92F}"], [22, "\u{1F920}"],
];

function hashCode(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function emojiAvatarFor(address: string): { colorClass: string; emoji: string } {
  const [color, emoji] = AVATARS[Math.abs(hashCode(address) % AVATARS.length)] ?? AVATARS[0]!;
  return { colorClass: `wm-ava-${color}`, emoji };
}

/** RainbowKit's `formatAddress`: four leading and four trailing characters around an ellipsis. */
export function formatAccountAddress(address: string): string {
  return address.length < 8 ? address : `${address.slice(0, 4)}…${address.slice(-4)}`;
}
