import { toAddress, toSignature } from "@agari/core/types";
import { addressUrl, txUrl } from "@agari/core/urls";
import { shortHex } from "@agari/core/units";
import type { PrintProof } from "@agari/markets";
import { Hash } from "@/components/data";
import { ReceiptRow } from "@/components/receipt";
import { webEnv } from "@/lib/env";
import { PROOF } from "./copy";
import { etClockSecText, integerText, replayDiff } from "./format";

const cluster = () => webEnv.markets.cluster;

/** The stored `PriceUpdateV2` decode beside the print it re-proves (§2.6 step 4–6); kept on the page after the close. */
export function PythReplayRows({ print }: { print: PrintProof }) {
  const replay = print.replay;
  if (!replay || replay.state === "posting" || (replay.state === "failed" && replay.price === null)) {
    return <ReceiptRow label={PROOF.rows.priceUpdate}>{replay ? PROOF.state[replay.state] : PROOF.state.none}</ReceiptRow>;
  }
  const { price, expo, conf, publishTimeSec } = replay;
  const diff = price !== null && expo !== null ? replayDiff(price, expo, print.priceE8) : null;
  const n = replay.postSignatures.length;
  return (
    <>
      <ReceiptRow label={PROOF.rows.priceUpdate} href={replay.priceUpdate && replay.state === "verified" ? addressUrl(toAddress(replay.priceUpdate), cluster()) : undefined}>
        {replay.priceUpdate ? shortHex(replay.priceUpdate, 6, 4) : "—"}
      </ReceiptRow>
      <ReceiptRow label={PROOF.rows.verification}>{replay.verification === "full" ? PROOF.full : PROOF.state[replay.state]}</ReceiptRow>
      {price !== null && expo !== null && <ReceiptRow label={PROOF.rows.price}>{integerText(price, expo)}</ReceiptRow>}
      {conf !== null && expo !== null && <ReceiptRow label={PROOF.rows.conf}>{`± ${integerText(conf, expo)}`}</ReceiptRow>}
      {publishTimeSec !== null && (
        <ReceiptRow label={PROOF.rows.publishTime}>{`${publishTimeSec} · ${etClockSecText(publishTimeSec)}`}</ReceiptRow>
      )}
      {diff !== null && <ReceiptRow label={PROOF.rows.match}>{diff === 0n ? PROOF.matches : PROOF.differs(diff.toString())}</ReceiptRow>}
      {replay.postSignatures.map((signature, i) => (
        <ReceiptRow key={signature} label={PROOF.rows.postTx(i, n)}>
          <Hash value={signature} href={txUrl(toSignature(signature), cluster())} lead={8} tail={4} />
        </ReceiptRow>
      ))}
      {replay.closeSignatures.map((signature) => (
        <ReceiptRow key={signature} label={PROOF.rows.closeTx}>
          <Hash value={signature} href={txUrl(toSignature(signature), cluster())} lead={8} tail={4} />
        </ReceiptRow>
      ))}
    </>
  );
}
