import { etDateOf } from "@agari/core/market";
import { shortHex } from "@agari/core/units";
import type { PrintProof } from "@agari/markets";
import { isPreStocksAsset, printSourceName } from "@/features/markets/price-source/source-label";
import { PROOF } from "@/features/proof/copy";
import { etClockSecText, integerText, replayDiff } from "@/features/proof/format";
import { oraclePriceText } from "./price";
import { Receipt, ReceiptRow } from "./Receipt";

const sourceWord = (print: PrintProof) => (print.source ? printSourceName(print.source, print.symbol) : PROOF.unknownSource);

/** What the archive kept at T: when it was fetched and stored, how many signed bytes, and their digest. */
function ArchiveRows({ print }: { print: PrintProof }) {
  const archive = print.archive;
  if (!archive) return <ReceiptRow label={PROOF.rows.bytes}>{PROOF.noArchive}</ReceiptRow>;
  const tMs = print.boundarySec * 1000;
  return (
    <>
      <ReceiptRow label={PROOF.rows.fetched}>{PROOF.afterT(archive.fetchedAtMs - tMs)}</ReceiptRow>
      <ReceiptRow label={PROOF.rows.archived}>{PROOF.afterT(archive.archivedAtMs - tMs)}</ReceiptRow>
      <ReceiptRow label={PROOF.rows.bytes}>{PROOF.bytes(archive.payloadBytes)}</ReceiptRow>
      <ReceiptRow label={PROOF.rows.sha256}>{shortHex(archive.payloadSha256, 10, 6)}</ReceiptRow>
    </>
  );
}

/** web's PythReplayRows.tsx: the stored `PriceUpdateV2` decode beside the print it re-proves, kept after the close. */
function PythReplayRows({ print }: { print: PrintProof }) {
  const replay = print.replay;
  if (!replay || replay.state === "posting" || (replay.state === "failed" && replay.price === null)) {
    return <ReceiptRow label={PROOF.rows.priceUpdate}>{replay ? PROOF.state[replay.state] : PROOF.state.none}</ReceiptRow>;
  }
  const { price, expo, conf, publishTimeSec } = replay;
  const diff = price !== null && expo !== null ? replayDiff(price, expo, print.priceE8) : null;
  const n = replay.postSignatures.length;
  const account = replay.priceUpdate && replay.state === "verified" ? { kind: "address" as const, id: replay.priceUpdate } : undefined;
  return (
    <>
      <ReceiptRow label={PROOF.rows.priceUpdate} explorer={account}>
        {replay.priceUpdate ? shortHex(replay.priceUpdate, 6, 4) : "—"}
      </ReceiptRow>
      <ReceiptRow label={PROOF.rows.verification}>{replay.verification === "full" ? PROOF.full : PROOF.state[replay.state]}</ReceiptRow>
      {price !== null && expo !== null ? <ReceiptRow label={PROOF.rows.price}>{integerText(price, expo)}</ReceiptRow> : null}
      {conf !== null && expo !== null ? <ReceiptRow label={PROOF.rows.conf}>{`± ${integerText(conf, expo)}`}</ReceiptRow> : null}
      {publishTimeSec !== null ? <ReceiptRow label={PROOF.rows.publishTime}>{`${publishTimeSec} · ${etClockSecText(publishTimeSec)}`}</ReceiptRow> : null}
      {diff !== null ? <ReceiptRow label={PROOF.rows.match}>{diff === 0n ? PROOF.matches : PROOF.differs(diff.toString())}</ReceiptRow> : null}
      {replay.postSignatures.map((signature, i) => (
        <ReceiptRow key={signature} label={PROOF.rows.postTx(i, n)} explorer={{ kind: "tx", id: signature }} hash>
          {shortHex(signature, 8, 4)}
        </ReceiptRow>
      ))}
      {replay.closeSignatures.map((signature) => (
        <ReceiptRow key={signature} label={PROOF.rows.closeTx} explorer={{ kind: "tx", id: signature }} hash>
          {shortHex(signature, 8, 4)}
        </ReceiptRow>
      ))}
    </>
  );
}

/** RedStone prints verify in the program at record (signer set, threshold); the archive names who signed. */
function RedStoneRows({ print }: { print: PrintProof }) {
  const addresses = print.archive?.signerAddresses ?? [];
  const packageTsMs = print.archive?.packageTsMs ?? null;
  return (
    <>
      <ReceiptRow label={PROOF.rows.verification}>{PROOF.redstoneVerified}</ReceiptRow>
      {packageTsMs !== null ? <ReceiptRow label={PROOF.rows.packageTime}>{`${packageTsMs} ms · ${etClockSecText(Math.floor(packageTsMs / 1000))}`}</ReceiptRow> : null}
      {addresses.map((address, i) => (
        <ReceiptRow key={address} label={i === 0 ? PROOF.rows.signers : ""}>
          {shortHex(address, 8, 6)}
        </ReceiptRow>
      ))}
    </>
  );
}

/** web's PrintProofReceipt.tsx: one recorded print as a cream receipt — source, boundary, record tx, archive, the source's own proof. */
export function PrintReceipt({ print }: { print: PrintProof }) {
  const source = sourceWord(print);
  const signers = print.source === "redstone" ? ` · ${PROOF.signerCount(print.signers)}` : "";
  return (
    <Receipt
      title={PROOF.receiptTitle(PROOF.whichShort[print.which])}
      figure={oraclePriceText(print.priceE8, print.symbol ?? "")}
      figureLabel={PROOF.figure(source)}
      settledAtMs={print.boundarySec * 1000}
      footer={PROOF.footer}
    >
      <ReceiptRow label={PROOF.rows.source}>{`${source}${signers}${print.copied ? ` · ${PROOF.copied}` : ""}`}</ReceiptRow>
      <ReceiptRow label={PROOF.rows.boundary}>{`${etClockSecText(print.boundarySec)} · ${etDateOf(print.boundarySec)}`}</ReceiptRow>
      <ReceiptRow label={PROOF.rows.print}>{integerText(print.priceE8, -8)}</ReceiptRow>
      <ReceiptRow label={PROOF.rows.recordTx} explorer={{ kind: "tx", id: print.recordSignature }}>
        {shortHex(print.recordSignature, 10, 4)}
      </ReceiptRow>
      <ArchiveRows print={print} />
      {print.source === "pyth" ? <PythReplayRows print={print} /> : null}
      {print.source === "redstone" ? <RedStoneRows print={print} /> : null}
      {print.source === "switchboard" ? <ReceiptRow label={PROOF.rows.verification}>{PROOF.switchboard}</ReceiptRow> : null}
      {print.source === "attested" ? (
        <ReceiptRow label={PROOF.rows.verification}>{isPreStocksAsset(print.symbol) ? PROOF.attestedPreStocks : PROOF.attested}</ReceiptRow>
      ) : null}
    </Receipt>
  );
}
