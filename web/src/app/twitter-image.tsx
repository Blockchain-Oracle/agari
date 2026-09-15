import { OG_COPY } from "@/features/landing/og/copy";
import { siteImage } from "@/features/landing/og/site-image";
import { OG_CONTENT_TYPE, OG_SIZE } from "@/features/landing/og/theme";

/** The X card (Y-14): the same image as the Open Graph preview, at the same 1200 × 630. */
export const runtime = "nodejs";
export const alt = OG_COPY.site.alt;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return siteImage();
}
