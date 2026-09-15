import { OG_COPY } from "@/features/landing/og/copy";
import { siteImage } from "@/features/landing/og/site-image";
import { OG_CONTENT_TYPE, OG_SIZE } from "@/features/landing/og/theme";

/** The site's link preview (L-23): static, rendered once from the vendored face and marks. */
export const runtime = "nodejs";
export const alt = OG_COPY.site.alt;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return siteImage();
}
