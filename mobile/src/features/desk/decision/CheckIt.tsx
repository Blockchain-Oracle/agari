import { canonicalJson, hashRecord } from "@agari/core/desk";
import type { Signature } from "@agari/core/types";
import { txUrl } from "@agari/core/urls";
import { createBrowserDeskRpc, readSealsOf, type DeskRpc } from "@agari/markets/desk";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Code, Download, ShieldCheck } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { RECORD } from "@/features/desk/copy-record";
import { shortHash } from "@/features/desk/format";
import type { ProofWire } from "@/features/desk/protocol";
import { MAINNET_RPC_PATH } from "@/providers/wallet/mainnet-signer";
import { haptic } from "~/components/kit";
import { openExternal } from "~/lib/external";
import { FONT } from "~/theme";
import { DkControl, DT, useDeskTheme } from "../kit";

/** web's Check it words speak of "your browser"; in the app the same check runs on this phone. */
const onPhone = (text: string): string => text.replace(/Your browser/g, "This phone").replace(/your browser/g, "this phone");
const C = Object.fromEntries(Object.entries(RECORD.checkIt).map(([k, v]) => [k, typeof v === "string" ? onPhone(v) : v])) as typeof RECORD.checkIt;
type KitSignature = Parameters<typeof readSealsOf>[1];
let rpc: DeskRpc | null = null;
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

interface CheckResult {
  computed: string;
  storedOk: boolean;
  links: { seq: number; ok: boolean }[];
  chain: "ok" | "mismatch" | "no_event" | "unreachable" | "unsealed" | "practice";
  eventHash?: string;
}

/** web's CheckIt.tsx `checkRecord`: rebuild the fingerprint, walk the links to the sealing record, ask the chain. */
async function checkRecord(body: unknown, recordHash: string, proof: ProofWire): Promise<CheckResult> {
  const computed = hashRecord(body);
  const storedOk = same(computed, recordHash);
  let expected = computed;
  const links: CheckResult["links"] = [];
  if (proof.kind === "later") {
    for (const link of proof.links) {
      const prev = (link.body as { prevHash?: unknown } | null)?.prevHash;
      links.push({ seq: link.seq, ok: typeof prev === "string" && same(prev, expected) });
      expected = hashRecord(link.body);
    }
  }
  const base = { computed, storedOk, links };
  if (proof.kind === "practice") return { ...base, chain: "practice" };
  if (proof.kind === "unsealed") return { ...base, chain: "unsealed" };
  let found: { decisionHash: string }[] | null;
  try {
    rpc ??= createBrowserDeskRpc(MAINNET_RPC_PATH);
    found = await readSealsOf(rpc, proof.signature as unknown as KitSignature);
  } catch {
    found = null;
  }
  if (found === null) return { ...base, chain: "unreachable" };
  if (found.length === 0) return { ...base, chain: "no_event" };
  const match = found.find((s) => same(s.decisionHash, expected)) ?? found[0]!;
  return { ...base, chain: links.every((l) => l.ok) && same(match.decisionHash, expected) ? "ok" : "mismatch", eventHash: match.decisionHash };
}

/** The verdict as web's `.dk-card` with a `.dk-receipt` of the fingerprints. */
function Verdict({ result, recordHash, proof, explorer }: { result: CheckResult; recordHash: string; proof: ProofWire; explorer: string | null }) {
  const { color } = useDeskTheme();
  const good = result.storedOk && (result.chain === "ok" || result.chain === "practice" || result.chain === "unsealed");
  const bad = !result.storedOk || result.chain === "mismatch" || result.chain === "no_event";
  const sentence = !result.storedOk ? C.storedMismatch : result.chain === "ok" ? C.matches : result.chain === "mismatch" ? C.mismatch : result.chain === "no_event" ? C.noEvent : result.chain === "unreachable" ? C.unreachable : C.storedMatches;
  const rows: [string, string][] = [[C.computed, result.computed], [C.stored, recordHash], ...(result.eventHash ? [[C.onChain, result.eventHash] as [string, string]] : [])];
  return (
    <View style={[styles.verdict, { backgroundColor: color.surface1, borderColor: good ? color.profit : bad ? color.loss : color.hairline }]} accessibilityLiveRegion="polite">
      <Text style={[DT.body, { color: good ? color.ink : bad ? color.warning : color.inkSecondary }]}>{sentence}</Text>
      {proof.kind === "later" ? (
        <>
          <Text style={[DT.caption, { color: color.inkSecondary }]}>{C.links(result.links.length, proof.sealingSeq)}</Text>
          <View>
            {result.links.map((l, i) => (
              <Text key={l.seq} style={[DT.caption, styles.linkRow, i > 0 && { borderTopWidth: 1, borderTopColor: color.hairline }, { color: l.ok ? color.inkMuted : color.warning }]}>
                {l.ok ? C.linkOk(l.seq) : C.linkBroken(l.seq)}
              </Text>
            ))}
          </View>
        </>
      ) : null}
      <View style={styles.receipt}>
        {rows.map(([dt, dd]) => (
          <View key={dt} style={styles.receiptRow}>
            <Text style={[styles.dt, { color: color.inkMuted }]}>{dt}</Text>
            <Text style={[styles.hash, { color: color.ink }]} selectable>
              {dd}
              {dt === C.onChain && explorer ? (
                <Text style={{ color: color.accent }} accessibilityRole="link" onPress={() => void openExternal(explorer)}>
                  {" "}({C.seeTx})
                </Text>
              ) : null}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * "Check it" (web's CheckIt.tsx): this phone rebuilds the record's fingerprint from its canonical bytes, compares it with
 * the one stored beside it, then asks Solana mainnet for the fingerprint the sealing transaction carries. The exact
 * bytes can be shown, and saved as the same JSON file web downloads (through the phone's share sheet).
 */
export function CheckIt({ body, recordHash, proof }: { body: unknown; recordHash: string; proof: ProofWire }) {
  const { color } = useDeskTheme();
  const [result, setResult] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [bytes, setBytes] = useState(false);
  const check = async () => {
    setBusy(true);
    const r = await checkRecord(body, recordHash, proof);
    setResult(r);
    setBusy(false);
    if (r.storedOk && (r.chain === "ok" || r.chain === "practice" || r.chain === "unsealed")) haptic.success();
    else haptic.error();
  };
  const download = async () => {
    const file = new File(Paths.cache, `desk-record-${recordHash.slice(2, 12)}.json`);
    file.create({ overwrite: true });
    file.write(`${canonicalJson(body)}\n`);
    await Sharing.shareAsync(file.uri, { mimeType: "application/json", UTI: "public.json", dialogTitle: C.download });
  };
  const explorer = proof.kind === "own" || proof.kind === "later" ? txUrl(proof.signature as Signature, "mainnet-beta") : null;
  return (
    <View style={styles.wrap}>
      <View style={styles.actions}>
        <DkControl tone="primary" icon={ShieldCheck} label={busy ? C.checking : C.check} disabled={busy} onPress={() => void check()} />
        <DkControl icon={Download} label={C.download} onPress={() => void download()} />
        <DkControl icon={Code} label={bytes ? C.hideBytes : C.showBytes} onPress={() => setBytes((b) => !b)} />
      </View>
      {result ? (
        <Verdict result={result} recordHash={recordHash} proof={proof} explorer={explorer} />
      ) : (
        <Text style={[DT.caption, { color: color.inkMuted }]}>{proof.kind === "practice" ? C.beforePractice : proof.kind === "unsealed" ? C.beforeUnsealed : C.before}</Text>
      )}
      {bytes ? (
        <ScrollView style={[styles.bytes, { borderColor: color.hairline }]} nestedScrollEnabled>
          <Text style={[styles.bytesText, { color: color.inkSecondary }]} selectable>
            {canonicalJson(body)}
          </Text>
        </ScrollView>
      ) : null}
      {!bytes && result?.storedOk ? (
        <Text style={[DT.caption, { color: color.inkMuted }]}>
          {RECORD.decision.proof.fingerprint} {shortHash(result.computed)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  verdict: { gap: 12, padding: 16, borderWidth: 1, borderRadius: 12 },
  linkRow: { paddingVertical: 8 },
  receipt: { gap: 6 },
  receiptRow: { flexDirection: "row", gap: 16 },
  dt: { width: 110, fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8 },
  hash: { flex: 1, minWidth: 0, fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2 },
  bytes: { maxHeight: 260, padding: 12, borderWidth: 1, borderRadius: 10 },
  bytesText: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 16.5 },
});
