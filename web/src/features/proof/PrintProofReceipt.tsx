import { etDateOf } from "@agari/core/market";
import { toSignature } from "@agari/core/types";
import { shortHex } from "@agari/core/units";
import { txUrl } from "@agari/core/urls";
import type { PrintProof } from "@agari/markets";
import { Receipt, ReceiptRow } from "@/components/receipt";
import { oraclePriceText } from "@/features/markets/hero";
import { isPreStocksAsset, printSourceName } from "@/features/markets/price-source/source-label";
import { webEnv } from "@/lib/env";
import { PROOF } from "./copy";
import { etClockSecText, integerText } from "./format";
import { PythReplayRows } from "./PythReplayRows";

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
      <ReceiptRow label={PROOF.rows.sha256}>
        <span title={archive.payloadSha256}>{shortHex(archive.payloadSha256, 10, 6)}</span>
      </ReceiptRow>
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
      {packageTsMs !== null && <ReceiptRow label={PROOF.rows.packageTime}>{`${packageTsMs} ms · ${etClockSecText(Math.floor(packageTsMs / 1000))}`}</ReceiptRow>}
      {addresses.map((address, i) => (
        <ReceiptRow key={address} label={i === 0 ? PROOF.rows.signers : ""}>
          <span title={address}>{shortHex(address, 8, 6)}</span>
        </ReceiptRow>
      ))}
    </>
  );
}

/** One recorded print as a cream receipt: the source, the boundary, the record tx, the archive, and the source's own proof. */
export function PrintProofReceipt({ print }: { print: PrintProof }) {
  const source = sourceWord(print);
  const signers = print.source === "redstone" ? ` · ${PROOF.signerCount(print.signers)}` : "";
  return (
    <Receipt
      title={PROOF.receiptTitle(PROOF.whichShort[print.which])}
      figure={<span className="numbers">{oraclePriceText(print.priceE8)}</span>}
      figureLabel={PROOF.figure(source)}
      settledAtMs={print.boundarySec * 1000}
      footer={PROOF.footer}
    >
      <ReceiptRow label={PROOF.rows.source}>{`${source}${signers}${print.copied ? ` · ${PROOF.copied}` : ""}`}</ReceiptRow>
      <ReceiptRow label={PROOF.rows.boundary}>{`${etClockSecText(print.boundarySec)} · ${etDateOf(print.boundarySec)}`}</ReceiptRow>
      <ReceiptRow label={PROOF.rows.print}>{integerText(print.priceE8, -8)}</ReceiptRow>
      <ReceiptRow label={PROOF.rows.recordTx} href={txUrl(toSignature(print.recordSignature), webEnv.markets.cluster)}>
        {shortHex(print.recordSignature, 10, 4)}
      </ReceiptRow>
      <ArchiveRows print={print} />
      {print.source === "pyth" && <PythReplayRows print={print} />}
      {print.source === "redstone" && <RedStoneRows print={print} />}
      {print.source === "switchboard" && <ReceiptRow label={PROOF.rows.verification}>{PROOF.switchboard}</ReceiptRow>}
      {print.source === "attested" && <ReceiptRow label={PROOF.rows.verification}>{isPreStocksAsset(print.symbol) ? PROOF.attestedPreStocks : PROOF.attested}</ReceiptRow>}
    </Receipt>
  );
}
