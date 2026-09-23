import { etDateOf } from "@agari/core/market";
import { shortHex } from "@agari/core/units";
import type { PrintProof } from "@agari/markets";
import { StyleSheet, Text, View } from "react-native";
import { isPreStocksAsset, printSourceName } from "@/features/markets/price-source/source-label";
import { PROOF } from "@/features/proof/copy";
import { etClockSecText, integerText, replayDiff } from "@/features/proof/format";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { oraclePriceText } from "~/features/surface/parts";
import { ReceiptRow } from "./ReceiptRow";

const sourceWord = (print: PrintProof) => (print.source ? printSourceName(print.source, print.symbol) : PROOF.unknownSource);

/** What the archive kept at T: when it was fetched and stored, how many signed bytes, their digest. */
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

/** web's `PythReplayRows`: the stored PriceUpdateV2 decode beside the print it re-proves, and its post/close txs. */
function PythRows({ print }: { print: PrintProof }) {
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
        <ReceiptRow key={signature} label={PROOF.rows.postTx(i, n)} explorer={{ kind: "tx", id: signature }}>
          {shortHex(signature, 8, 4)}
        </ReceiptRow>
      ))}
      {replay.closeSignatures.map((signature) => (
        <ReceiptRow key={signature} label={PROOF.rows.closeTx} explorer={{ kind: "tx", id: signature }}>
          {shortHex(signature, 8, 4)}
        </ReceiptRow>
      ))}
    </>
  );
}

/** RedStone prints verify in the program at record; the archive names who signed. */
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

/**
 * web's `PrintProofReceipt` (features/proof/PrintProofReceipt.tsx): one recorded print on the cream receipt — the
 * source, the boundary, the record transaction, the archived bytes, and the source's own proof.
 */
export function PrintReceipt({ print }: { print: PrintProof }) {
  const { color } = useTheme();
  const source = sourceWord(print);
  const signers = print.source === "redstone" ? ` · ${PROOF.signerCount(print.signers)}` : "";
  return (
    <View style={[styles.receipt, { backgroundColor: color.cream, borderColor: color.creamHairline, shadowColor: color.shadow }]}>
      <Text style={[styles.title, { color: color.accent }]}>{PROOF.receiptTitle(PROOF.whichShort[print.which])}</Text>
      <Text style={[TYPE.dataHero, styles.figure, { color: color.creamInk }]} adjustsFontSizeToFit numberOfLines={1}>
        {oraclePriceText(print.priceE8, print.symbol ?? "")}
      </Text>
      <Text style={[TYPE.caption, { color: color.creamInk }]}>{PROOF.figure(source)}</Text>
      <View style={styles.rows}>
        <ReceiptRow label={PROOF.rows.source}>{`${source}${signers}${print.copied ? ` · ${PROOF.copied}` : ""}`}</ReceiptRow>
        <ReceiptRow label={PROOF.rows.boundary}>{`${etClockSecText(print.boundarySec)} · ${etDateOf(print.boundarySec)}`}</ReceiptRow>
        <ReceiptRow label={PROOF.rows.print}>{integerText(print.priceE8, -8)}</ReceiptRow>
        <ReceiptRow label={PROOF.rows.recordTx} explorer={{ kind: "tx", id: print.recordSignature }}>
          {shortHex(print.recordSignature, 10, 4)}
        </ReceiptRow>
        <ArchiveRows print={print} />
        {print.source === "pyth" ? <PythRows print={print} /> : null}
        {print.source === "redstone" ? <RedStoneRows print={print} /> : null}
        {print.source === "switchboard" ? <ReceiptRow label={PROOF.rows.verification}>{PROOF.switchboard}</ReceiptRow> : null}
        {print.source === "attested" ? (
          <ReceiptRow label={PROOF.rows.verification}>{isPreStocksAsset(print.symbol) ? PROOF.attestedPreStocks : PROOF.attested}</ReceiptRow>
        ) : null}
      </View>
      <Text style={[styles.footer, { color: color.creamInk, borderTopColor: color.creamHairline }]}>{PROOF.footer}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  receipt: {
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    gap: 6,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  title: { fontFamily: FONT.dataStrong, fontSize: 10.5, letterSpacing: 1.6 },
  figure: { fontSize: 36, lineHeight: 40 },
  rows: { marginTop: 6 },
  footer: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 0.4, borderTopWidth: 1, borderStyle: "dashed", paddingTop: 10, textAlign: "center" },
});
