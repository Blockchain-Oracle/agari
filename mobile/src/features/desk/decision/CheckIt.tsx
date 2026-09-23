import { canonicalJson, hashRecord } from "@agari/core/desk";
import type { Signature } from "@agari/core/types";
import { txUrl } from "@agari/core/urls";
import { createBrowserDeskRpc, readSealsOf, type DeskRpc } from "@agari/markets/desk";
import { useState } from "react";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import { RECORD } from "@/features/desk/copy-record";
import { shortHash } from "@/features/desk/format";
import type { ProofWire } from "@/features/desk/protocol";
import { MAINNET_RPC_PATH } from "@/providers/wallet/mainnet-signer";
import { Button, haptic } from "~/components/kit";
import { openExternal } from "~/lib/external";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

/** web's Check it words, which speak of "your browser"; on the phone the same check runs on the phone. */
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

function Hash({ label, value }: { label: string; value: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.hash}>
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{label}</Text>
      <Text style={[styles.mono, { color: color.ink }]} selectable>
        {value}
      </Text>
    </View>
  );
}

/**
 * "Check it" (web's CheckIt.tsx): this phone rebuilds the record's fingerprint from its canonical bytes, compares it
 * with the one stored beside it, then asks Solana mainnet for the fingerprint the sealing transaction carries.
 */
export function CheckIt({ body, recordHash, proof }: { body: unknown; recordHash: string; proof: ProofWire }) {
  const { color } = useTheme();
  const [result, setResult] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [bytes, setBytes] = useState(false);
  const check = async () => {
    setBusy(true);
    const r = await checkRecord(body, recordHash, proof);
    setResult(r);
    setBusy(false);
    const good = r.storedOk && (r.chain === "ok" || r.chain === "practice" || r.chain === "unsealed");
    if (good) haptic.success();
    else haptic.error();
  };
  const share = () => void Share.share({ title: `desk-record-${recordHash.slice(2, 12)}.json`, message: `${canonicalJson(body)}\n` });
  const explorer = proof.kind === "own" || proof.kind === "later" ? txUrl(proof.signature as Signature, "mainnet-beta") : null;
  const r = result;
  const good = r ? r.storedOk && (r.chain === "ok" || r.chain === "practice" || r.chain === "unsealed") : false;
  const bad = r ? !r.storedOk || r.chain === "mismatch" || r.chain === "no_event" : false;
  const sentence = !r ? null : !r.storedOk ? C.storedMismatch : r.chain === "ok" ? C.matches : r.chain === "mismatch" ? C.mismatch : r.chain === "no_event" ? C.noEvent : r.chain === "unreachable" ? C.unreachable : C.storedMatches;
  return (
    <View style={styles.wrap}>
      <Button label={busy ? C.checking : C.check} loading={busy} icon={{ ios: "checkmark.shield", android: "verified_user" }} onPress={() => void check()} />
      <Button label="Share the record" size="sm" variant="secondary" icon={{ ios: "square.and.arrow.up", android: "share" }} onPress={share} />
      <Button label={bytes ? C.hideBytes : C.showBytes} size="sm" variant="secondary" icon={{ ios: "chevron.left.forwardslash.chevron.right", android: "code" }} onPress={() => setBytes((b) => !b)} />
      {r && sentence ? (
        <View style={[styles.verdict, { borderColor: good ? color.profit : bad ? color.loss : color.hairline }]} accessibilityLiveRegion="polite">
          <Text style={[TYPE.body, { color: good ? color.ink : bad ? color.loss : color.inkSecondary }]}>{sentence}</Text>
          {proof.kind === "later" ? <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{onPhone(C.links(r.links.length, proof.sealingSeq))}</Text> : null}
          {r.links.map((l) => (
            <Text key={l.seq} style={[TYPE.caption, { color: l.ok ? color.inkMuted : color.loss }]}>
              {l.ok ? C.linkOk(l.seq) : C.linkBroken(l.seq)}
            </Text>
          ))}
          <Hash label={C.computed} value={r.computed} />
          <Hash label={C.stored} value={recordHash} />
          {r.eventHash ? <Hash label={C.onChain} value={r.eventHash} /> : null}
          {r.eventHash && explorer ? (
            <Pressable onPress={() => void openExternal(explorer)} accessibilityRole="link" hitSlop={8}>
              <Text style={[TYPE.bodyStrong, { color: color.accent }]}>{C.seeTx} ↗</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{proof.kind === "practice" ? C.beforePractice : proof.kind === "unsealed" ? C.beforeUnsealed : C.before}</Text>
      )}
      {bytes ? (
        <Text style={[styles.mono, styles.bytes, { color: color.inkSecondary, backgroundColor: color.surface2 }]} selectable>
          {canonicalJson(body)}
        </Text>
      ) : null}
      {!bytes && r?.storedOk ? (
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>
          {RECORD.decision.proof.fingerprint} {shortHash(r.computed)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  verdict: { borderWidth: 1, borderRadius: RADIUS.md, padding: 12, gap: 8 },
  hash: { gap: 2 },
  mono: { fontFamily: FONT.data, fontSize: 11.5, lineHeight: 16 },
  bytes: { borderRadius: RADIUS.md, padding: 10 },
});
