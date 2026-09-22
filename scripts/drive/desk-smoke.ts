// A practice desk on a deployed site, from the command line (S21, D-126): the owner is a drive keypair, the mandate a
// preset with the default limits, the signature the same wallet signature the studio's step 04 makes, and the request
// the same POST the studio sends with `trigger: "test_read"`, so the runner on that site wakes the desk within its
// tick and the first decision lands. Then the desk view is polled until a record appears.
//
//   pnpm exec tsx --env-file-if-exists=.env.local scripts/drive/desk-smoke.ts [--site https://useagari.xyz] [--as drive-owner] [--preset ailabs] [--cash 1000] [--wait 600]
//
// Nothing here touches a chain: a practice desk is a paper ledger. Secrets are never printed.
import { createPrivateKey, sign as edSign } from "node:crypto";
import { deskMandateText, mandateFingerprint, mandateToWire, presetMandate } from "@agari/core/desk";
import { encodeBase58 } from "@agari/core/types";
import { roleSecret } from "../deploy/ops-cluster";

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

/** ed25519 over UTF-8 text with a role's keypair file, as a wallet's signMessage would. */
function signText(secret: Uint8Array, text: string): string {
  const pkcs8 = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(secret.slice(0, 32))]);
  return encodeBase58(new Uint8Array(edSign(null, Buffer.from(text, "utf8"), createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" }))));
}

const site = (arg("--site") ?? "https://useagari.xyz").replace(/\/$/, "");
const role = arg("--as") ?? "drive-owner";
const presetId = arg("--preset") ?? "ailabs";
const cashE6 = BigInt(Math.round(Number(arg("--cash") ?? "1000") * 1_000_000));
const waitSec = Number(arg("--wait") ?? "600");

const secret = roleSecret(role);
const owner = encodeBase58(secret.slice(32, 64));
const mandate = presetMandate(presetId);
if (!mandate) throw new Error(`no preset ${presetId}`);
const fingerprint = mandateFingerprint(mandate);
const signedAtIso = new Date().toISOString();

/** The site sits behind a CDN that refuses a bare client, so every request carries a browser-like agent; a non-JSON answer is reported, never parsed. */
const HEADERS = { accept: "application/json", "user-agent": "Mozilla/5.0 (Macintosh) agari-desk-smoke/1" };
async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: `non-JSON ${res.status}: ${text.slice(0, 160).replace(/\s+/g, " ")}`, status: res.status };
  }
}
const view = async (): Promise<Record<string, unknown> | null> => {
  const res = await fetch(`${site}/api/desk/${owner}?viewer=${owner}`, { headers: HEADERS });
  if (res.status === 404) return null;
  const body = await readJson(res);
  return res.ok ? body : { error: body, status: res.status };
};

console.log(`desk-smoke: site ${site}, owner ${owner} (${role}), preset ${presetId}, cash $${Number(cashE6) / 1e6}, fingerprint ${fingerprint}`);
const existing = await view();
const existingDesk = existing && !("error" in existing) ? (existing.desk as { mandateVersion?: number } | null) : null;
const version = existingDesk ? (existingDesk.mandateVersion ?? 0) + 1 : 1;
const text = deskMandateText({ owner: owner as never, cluster: "mainnet-beta", version, fingerprint, signedAtIso });
const signature = signText(secret, text);
const res = await fetch(`${site}/api/desk/${owner}/mandate`, {
  method: "POST",
  headers: { ...HEADERS, "content-type": "application/json" },
  body: JSON.stringify({ owner, signature, signedAtIso, mandate: mandateToWire(mandate), version, trigger: "test_read", practiceCashE6: cashE6.toString() }),
});
const answer = await readJson(res);
console.log(`  POST /api/desk/${owner}/mandate → ${res.status}`, JSON.stringify(answer).slice(0, 400));
if (!res.ok) process.exit(1);

const deadline = Date.now() + waitSec * 1000;
let seen = 0;
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 15_000));
  const v = await view();
  if (!v || "error" in v) {
    console.log(`  ${new Date().toISOString().slice(11, 19)}Z view: ${v ? JSON.stringify(v).slice(0, 160) : "404"}`);
    continue;
  }
  const recent = (v.recent as { seq: number; outcome: string; summary: string; decidedAtSec: number }[] | undefined) ?? [];
  const desk = v.desk as { mode?: string; state?: string; practiceChecks?: number } | null;
  console.log(`  ${new Date().toISOString().slice(11, 19)}Z desk ${desk?.mode ?? "?"} ${desk?.state ?? "?"} checks=${desk?.practiceChecks ?? 0} records=${recent.length}`);
  for (const r of recent) if (r.seq > seen) console.log(`    #${r.seq} ${r.outcome}: ${r.summary}`);
  seen = Math.max(seen, ...recent.map((r) => r.seq));
  if (recent.length > 0) break;
}
console.log(seen > 0 ? "done: the desk has decided." : "no record yet within the wait; the runner wakes it on the hour or on its next tick.");
