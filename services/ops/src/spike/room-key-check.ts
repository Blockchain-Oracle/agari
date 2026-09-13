/**
 * One pass of the key-signed room, with no wallet and no browser: a fresh key signs the auth message
 * for a claimed wallet, the web app mints, the ops room admits the token and answers `hello` with a
 * snapshot. Scratch driver for slice B (2026-09-04); not a product path.
 *
 *   WEB_URL=http://localhost:3000 pnpm --filter @masayume/ops exec tsx src/spike/room-key-check.ts
 */
import { roomAuthMessage, ROOM_PROTOCOL_VERSION } from "@masayume/core/games";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import WebSocket from "ws";

const WEB_URL = process.env.WEB_URL ?? "http://localhost:3000";
const WALLET = (process.env.WALLET ?? "0xd357019E2c55375477802A047dB7bC1A77819358") as `0x${string}`;

async function main(): Promise<void> {
  const key = privateKeyToAccount(generatePrivateKey());
  const target = (await (await fetch(`${WEB_URL}/api/games/room-token`)).json()) as { chainId: number | null; arena: string | null; url: string | null };
  if (!target.chainId || !target.arena || !target.url) throw new Error(`no room target: ${JSON.stringify(target)}`);
  console.log(`target: chain ${target.chainId} arena ${target.arena} room ${target.url}`);

  const issuedAtMs = Date.now();
  const message = roomAuthMessage({ wallet: WALLET, key: key.address, chainId: target.chainId, arena: target.arena as `0x${string}`, issuedAtMs });
  const signature = await key.signMessage({ message });
  const minted = await fetch(`${WEB_URL}/api/games/room-token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet: WALLET, key: key.address, issuedAtMs, signature }),
  });
  const grant = (await minted.json()) as { token?: string; error?: string; expiresAtMs?: number };
  if (!minted.ok || !grant.token) throw new Error(`mint refused: ${minted.status} ${grant.error}`);
  console.log(`minted: ${grant.token.split(".").length} parts, key ${key.address}, expires in ${Math.round(((grant.expiresAtMs ?? 0) - Date.now()) / 1000)}s`);

  // A wallet-signed forgery of the same claims must be refused: only the key may sign.
  const forged = await fetch(`${WEB_URL}/api/games/room-token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet: WALLET, key: WALLET, issuedAtMs, signature }),
  });
  console.log(`forgery (key claimed = wallet, signed by another key): ${forged.status} ${((await forged.json()) as { error?: string }).error ?? ""}`);

  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(target.url as string, [grant.token as string, "masayume.room.v1"]);
    const timer = setTimeout(() => reject(new Error("no snapshot within 8s")), 8_000);
    ws.on("open", () => ws.send(JSON.stringify({ type: "hello", protocolVersion: ROOM_PROTOCOL_VERSION })));
    ws.on("message", (raw) => {
      const msg = JSON.parse(String(raw)) as { type: string; wallet?: string; state?: { phase?: string }; code?: string; message?: string };
      if (msg.type === "snapshot") {
        console.log(`room admitted: snapshot for ${msg.wallet}, phase ${msg.state?.phase}`);
        clearTimeout(timer);
        ws.close(1000, "done");
        resolve();
      } else if (msg.type === "error") {
        clearTimeout(timer);
        reject(new Error(`room refused: ${msg.code} ${msg.message}`));
      }
    });
    ws.on("unexpected-response", (_req, res) => {
      clearTimeout(timer);
      reject(new Error(`upgrade refused: ${res.statusCode} ${res.headers["x-room-refusal"]}`));
    });
    ws.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  },
);
