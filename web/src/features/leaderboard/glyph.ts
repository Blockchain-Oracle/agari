/** Deterministic decorative letter from an address — identity texture, not a readable label (reference `glyphFromAddress`). */
const GLYPH_POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function glyphFromAddress(address: string): string {
  let hash = 0;
  for (let i = 0; i < address.length; i += 1) hash = ((hash << 5) - hash + address.charCodeAt(i)) | 0;
  return GLYPH_POOL[Math.abs(hash) % GLYPH_POOL.length] as string;
}
