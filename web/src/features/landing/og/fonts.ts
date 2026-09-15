import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * The preview face. `web/public/fonts` holds only the games' m6x11plus pixel font, and the shell's Sora and Inter come
 * through `next/font/google` as WOFF2, which satori cannot read. The closest workable face is the OFL Sora SemiBold TTF
 * already vendored for the ops reply card (`services/ops/src/actors/x-relay/reply-card-assets`), copied here with its
 * licence so the web build owns its own bytes. Read from disk once per process: no request-time fetch.
 * `process.cwd()` is the Next project directory (`web/`), as the `next/og` docs load fonts.
 */
const SORA_SEMIBOLD = join(process.cwd(), "src/features/landing/og/fonts/Sora-SemiBold.ttf");

let sora: Promise<Buffer> | null = null;

export async function ogFonts() {
  sora ??= readFile(SORA_SEMIBOLD);
  const data = await sora;
  return [{ name: "Sora", data, style: "normal" as const, weight: 600 as const }];
}
