"use client";

import { canonicalJson, hashRecord } from "@agari/core/desk";
import type { Signature } from "@agari/core/types";
import { txUrl } from "@agari/core/urls";
import { createDeskRpc, readSealsOf, type DeskRpc } from "@agari/markets/desk";
import { useState } from "react";
import { MAINNET_RPC_PATH } from "@/providers/wallet/mainnet-signer";
import { RECORD } from "./copy-record";
import { shortHash } from "./format";
import type { ProofWire } from "./protocol";

const C = RECORD.checkIt;
type KitSignature = Parameters<typeof readSealsOf>[1];
let rpc: DeskRpc | null = null;
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export interface CheckItResult {
  computed: string;
  storedOk: boolean;
  links: { seq: number; ok: boolean }[];
  expected: string;
  chain: "ok" | "mismatch" | "no_event" | "unreachable" | "unsealed" | "practice";
  eventHash?: string;
}

/** The whole check as a pure-ish function, so a fixture can show it passing and failing on a tampered byte. */
export async function checkRecord(body: unknown, recordHash: string, proof: ProofWire, seals: (signature: string) => Promise<{ decisionHash: string }[] | null>): Promise<CheckItResult> {
  const computed = hashRecord(body);
  const storedOk = same(computed, recordHash);
  let expected = computed;
  const links: CheckItResult["links"] = [];
  if (proof.kind === "later") {
    for (const link of proof.links) {
      const prev = (link.body as { prevHash?: unknown } | null)?.prevHash;
      links.push({ seq: link.seq, ok: typeof prev === "string" && same(prev, expected) });
      expected = hashRecord(link.body);
    }
  }
  const base = { computed, storedOk, links, expected };
  if (proof.kind === "practice") return { ...base, chain: "practice" };
  if (proof.kind === "unsealed") return { ...base, chain: "unsealed" };
  const found = await seals(proof.signature);
  if (found === null) return { ...base, chain: "unreachable" };
  if (found.length === 0) return { ...base, chain: "no_event" };
  const match = found.find((s) => same(s.decisionHash, expected)) ?? found[0]!;
  return { ...base, chain: links.every((l) => l.ok) && same(match.decisionHash, expected) ? "ok" : "mismatch", eventHash: match.decisionHash };
}

async function sealsFromChain(signature: string): Promise<{ decisionHash: string }[] | null> {
  try {
    rpc ??= createDeskRpc(MAINNET_RPC_PATH);
    return await readSealsOf(rpc, signature as unknown as KitSignature);
  } catch {
    return null;
  }
}

/**
 * "Check it" (plan §5.9 item 8): the reader's own browser rebuilds the record's fingerprint from its canonical bytes,
 * compares it with the one stored beside the record, then asks Solana mainnet (through the app's own endpoint, from
 * this browser) for the fingerprint the sealing transaction carries. A record sealed by a later one is linked to it
 * here, record by record. The exact bytes can be shown and downloaded.
 */
export function CheckIt({ body, recordHash, proof, initial = null }: { body: unknown; recordHash: string; proof: ProofWire; initial?: CheckItResult | null }) {
  const [result, setResult] = useState<CheckItResult | null>(initial);
  const [busy, setBusy] = useState(false);
  const [bytes, setBytes] = useState(false);
  const check = async () => {
    setBusy(true);
    setResult(await checkRecord(body, recordHash, proof, sealsFromChain));
    setBusy(false);
  };
  const download = () => {
    const blob = new Blob([`${canonicalJson(body)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `desk-record-${recordHash.slice(2, 12)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const explorer = proof.kind === "own" || proof.kind === "later" ? txUrl(proof.signature as Signature, "mainnet-beta") : null;
  return (
    <div className="flex flex-col gap-3">
      <div className="dk-card-actions">
        <button type="button" className="dk-control" data-tone="primary" onClick={() => void check()} disabled={busy}>{busy ? C.checking : C.check}</button>
        <button type="button" className="dk-control" onClick={download}>{C.download}</button>
        <button type="button" className="dk-control" onClick={() => setBytes((b) => !b)}>{bytes ? C.hideBytes : C.showBytes}</button>
      </div>
      {result ? <Verdict result={result} recordHash={recordHash} proof={proof} explorer={explorer} /> : <p className="type-caption text-ink-muted">{proof.kind === "practice" ? C.beforePractice : proof.kind === "unsealed" ? C.beforeUnsealed : C.before}</p>}
      {bytes && <pre className="dk-bytes"><code>{canonicalJson(body)}</code></pre>}
      {!bytes && result?.storedOk && <p className="type-caption text-ink-muted">{RECORD.decision.proof.fingerprint} {shortHash(result.computed)}</p>}
    </div>
  );
}

function Verdict({ result, recordHash, proof, explorer }: { result: CheckItResult; recordHash: string; proof: ProofWire; explorer: string | null }) {
  const good = result.storedOk && (result.chain === "ok" || result.chain === "practice" || result.chain === "unsealed");
  const bad = !result.storedOk || result.chain === "mismatch" || result.chain === "no_event";
  const sentence = !result.storedOk ? C.storedMismatch : result.chain === "ok" ? C.matches : result.chain === "mismatch" ? C.mismatch : result.chain === "no_event" ? C.noEvent : result.chain === "unreachable" ? C.unreachable : C.storedMatches;
  return (
    <div className="dk-card" data-tone={good ? "good" : bad ? "bad" : undefined}>
      <p className={good ? "type-body text-ink" : bad ? "type-body dk-warn" : "type-body text-ink-secondary"}>{sentence}</p>
      {proof.kind === "later" && (
        <>
          <p className="type-caption text-ink-secondary">{C.links(result.links.length, proof.sealingSeq)}</p>
          <ul className="dk-rows">
            {result.links.map((l) => (
              <li key={l.seq} className={l.ok ? "type-caption text-ink-muted" : "type-caption dk-warn"}>{l.ok ? C.linkOk(l.seq) : C.linkBroken(l.seq)}</li>
            ))}
          </ul>
        </>
      )}
      <dl className="dk-receipt">
        <dt>{C.computed}</dt><dd className="dk-mono dk-break text-left">{result.computed}</dd>
        <dt>{C.stored}</dt><dd className="dk-mono dk-break text-left">{recordHash}</dd>
        {result.eventHash && (
          <>
            <dt>{C.onChain}</dt>
            <dd className="dk-mono dk-break text-left">
              {result.eventHash}
              {explorer && <> <a href={explorer} target="_blank" rel="noopener noreferrer" className="dk-link">({C.seeTx})</a></>}
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}
