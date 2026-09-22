import { isAddress } from "@agari/core/types";
import { deskStore, findDesk } from "@/features/desk/desk.server";
import { deskImage } from "@/features/desk/og-image";
import { RECORD } from "@/features/desk/copy-record";
import { siteImage } from "@/features/landing/og/site-image";
import { OG_CONTENT_TYPE, OG_SIZE } from "@/features/landing/og/theme";

/** A shared desk's link preview; a desk that is not shared, or no index, falls back to the site's rather than erroring. */
export const runtime = "nodejs";
export const revalidate = 300;
export const alt = RECORD.og.alt;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = deskStore();
  if (!store) return siteImage();
  const desk = await findDesk(store, id, isAddress(id)).catch(() => null);
  if (!desk || !desk.sharePublic) return siteImage();
  const latest = (await store.listRecords({ deskId: desk.id, limit: 1 }).catch(() => []))[0];
  const nowSec = Math.floor(Date.now() / 1000);
  return deskImage({
    mode: desk.mode === "ask_first" || desk.mode === "on_its_own" ? desk.mode : "practice",
    live: desk.address !== null,
    checks: latest ? Number(latest.seq) : 0,
    lastCheckSec: latest ? Number(latest.decidedAtSec) : null,
    nowSec,
  });
}
