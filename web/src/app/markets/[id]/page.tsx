import { isMarketId } from "@agari/core/types";
import { marketDeepLink } from "@agari/core/urls";
import { redirect } from "next/navigation";

/**
 * `/markets/<id>` is the shareable address of one Window — the link preview (`opengraph-image.tsx`) is drawn for
 * that Window, and Blinks and receipts hand it out.
 *
 * The market browser is the page that shows a Window, keyed by `?m=`, so this resolves into it **carrying the id**.
 * It used to redirect to a bare `/markets`, which meant a shared link previewed one Window and then opened whichever
 * one the browser happened to pick. A path that is not a Market address at all goes to the browser as before,
 * rather than failing: a mistyped link should land somewhere, not throw.
 */
export default async function Redirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(isMarketId(id) ? marketDeepLink({ marketId: id }) : "/markets");
}
