import type { XRelayHealth } from "@masayume/db";
import { relayStageLabel } from "./relay-health";

/** OAuth, the polling worker, execution and public reply delivery are different facts. */
export function XRelayStatus({ health }: { health: XRelayHealth | null | undefined }) {
  const now = Date.now();
  return (
    <div className="xt-composer-note" aria-label="X service status" aria-live="polite">
      <p>Mentions: {relayStageLabel(health?.polling, now)} · Orders: {relayStageLabel(health?.execution, now)} · Replies: {relayStageLabel(health?.delivery, now)}</p>
      <p>{health?.delivery?.imagesEnabled === false ? "Image replies are disabled." : health?.lastImageReplyAtMs
        ? `An image reply was last acknowledged ${new Date(health.lastImageReplyAtMs).toLocaleString()}.`
        : "Image delivery has not been verified."}</p>
      {Boolean(health?.unresolvedExecutions || health?.deliveryNeedsInspection) && <p>
        {health?.unresolvedExecutions ?? 0} order(s) and {health?.deliveryNeedsInspection ?? 0} reply(s) need inspection. Check your receipt before another instruction.
      </p>}
    </div>
  );
}
