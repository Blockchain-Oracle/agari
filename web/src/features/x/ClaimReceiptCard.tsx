import MasayumeMark from "@/components/shell/MasayumeMark";
import { CLAIM } from "./copy";

const BARS = Array.from({ length: 46 }, (_, i) => 2 + ((i * 7 + 3) % 5));

/** The reward as a tangible cream ticket (reference `ReceiptCard`): makes the page feel like a prize, not a form. */
export function ClaimReceiptCard({ amount, handle, done, symbol }: { amount: string | null; handle: string | null; done: boolean; symbol: string }) {
  const known = amount !== null;
  return (
    <div className="xr">
      <div className="xr-top" />
      <div className="xr-body">
        <div className="xr-head">
          <div className="xr-brand">
            <span className="xr-mark"><MasayumeMark /></span>
            <span>{CLAIM.card.brand}</span>
          </div>
          <span className={`xr-pill${known ? " xr-pill--known" : ""}`}>
            <span className="xr-pill-dot" />
            {done ? CLAIM.card.claimed : known ? CLAIM.card.settled : CLAIM.card.waiting}
          </span>
        </div>
        <div className="xr-eyebrow">{CLAIM.card.eyebrow}</div>
        <div className="xr-figure">
          <span className={`xr-amount${known ? " xr-amount--known" : ""}`}>{known ? `${amount} ${symbol}` : `${symbol} ${CLAIM.card.masked}`}</span>
          <span className="xr-word">{done ? CLAIM.card.sent : CLAIM.card.waitingWord}</span>
        </div>
        <div className="xr-sub">{done ? CLAIM.card.paid : handle ? CLAIM.card.waitingFor(handle) : CLAIM.card.reveal}</div>
        <div className="xr-hr" />
        <div className="xr-bars" aria-hidden="true">
          {BARS.map((w, i) => (
            <div key={i} className="xr-bar" style={{ width: `${w}px` }} />
          ))}
        </div>
        <div className="xr-foot">
          <span>{CLAIM.card.footer}</span>
          <span>{CLAIM.card.network}</span>
        </div>
      </div>
    </div>
  );
}
