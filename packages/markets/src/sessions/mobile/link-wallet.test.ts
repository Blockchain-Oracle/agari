import {
  appendTransactionMessageInstruction,
  compileTransaction,
  createTransactionMessage,
  generateKeyPairSigner,
  getBase58Decoder,
  getBase58Encoder,
  getTransactionCodec,
  partiallySignTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  verifySignature,
  type Blockhash,
} from "@solana/kit";
import nacl from "tweetnacl";
import { describe, expect, it } from "vitest";
import { connectLinkWallet, linkWalletSession, WalletLinkError, type LinkPort } from "./link-wallet";

const b58 = { enc: (b: Uint8Array) => getBase58Decoder().decode(b), dec: (s: string) => new Uint8Array(getBase58Encoder().encode(s)) };

/** Phantom's side of the protocol, in process: decrypts what Agari sends, signs with a real key, answers encrypted. */
async function fakePhantom(opts: { reject?: boolean } = {}) {
  const account = await generateKeyPairSigner();
  const box = nacl.box.keyPair();
  let shared: Uint8Array | null = null;
  const answer = (payload: unknown) => {
    const nonce = nacl.randomBytes(24);
    const data = nacl.box.after(new TextEncoder().encode(JSON.stringify(payload)), nonce, shared!);
    return new URLSearchParams({ nonce: b58.enc(nonce), data: b58.enc(data) });
  };
  const port: LinkPort = {
    redirectFor: (method) => `agari://wallet/${method}`,
    async roundTrip(url, method) {
      const q = new URL(url).searchParams;
      expect(q.get("redirect_link")).toBe(`agari://wallet/${method}`);
      if (opts.reject) return new URLSearchParams({ errorCode: "4001", errorMessage: "User rejected the request." });
      shared = nacl.box.before(b58.dec(q.get("dapp_encryption_public_key")!), box.secretKey);
      if (method === "connect") {
        expect(q.get("cluster")).toBe("devnet");
        const p = answer({ public_key: account.address, session: "s-1" });
        p.set("phantom_encryption_public_key", b58.enc(box.publicKey));
        return p;
      }
      const plain = nacl.box.open.after(b58.dec(q.get("payload")!), b58.dec(q.get("nonce")!), shared)!;
      const req = JSON.parse(new TextDecoder().decode(plain)) as Record<string, string>;
      expect(req.session).toBe("s-1");
      if (method === "signMessage") {
        const sig = await crypto.subtle.sign("Ed25519", account.keyPair.privateKey, b58.dec(req.message!));
        return answer({ signature: b58.enc(new Uint8Array(sig)) });
      }
      const codec = getTransactionCodec();
      const tx = codec.decode(b58.dec(req.transaction!));
      const signed = await partiallySignTransaction([account.keyPair], tx);
      return answer({ transaction: b58.enc(new Uint8Array(codec.encode(signed))) });
    },
  };
  return { account, port };
}

describe("the deeplink wallet (Phantom / Solflare protocol)", () => {
  it("connects on devnet, then signs a transaction and a message the account's key verifies", async () => {
    const { account, port } = await fakePhantom();
    const state = await connectLinkWallet("phantom", port, "https://useagari.xyz", "devnet");
    expect(state.address).toBe(account.address);
    const session = linkWalletSession(state, port);

    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(session.signer, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash({ blockhash: "11111111111111111111111111111111" as Blockhash, lastValidBlockHeight: 99n }, m),
      (m) => appendTransactionMessageInstruction({ programAddress: "11111111111111111111111111111111" as never, data: new Uint8Array([1]) }, m),
    );
    const signed = await signTransactionMessageWithSigners(message);
    const sig = signed.signatures[account.address]!;
    expect(await verifySignature(account.keyPair.publicKey, sig, signed.messageBytes)).toBe(true);
    // Untouched message: our lifetime, with its last valid height, survives the hand-off.
    expect(signed.lifetimeConstraint).toEqual({ blockhash: "11111111111111111111111111111111", lastValidBlockHeight: 99n });
    expect(compileTransaction(message).messageBytes).toEqual(signed.messageBytes);

    const text = new TextEncoder().encode("Agari faucet");
    const textSig = await session.signMessage(text);
    expect(await verifySignature(account.keyPair.publicKey, textSig as never, text)).toBe(true);
  });

  it("surfaces the wallet's rejection as the user's", async () => {
    const { port } = await fakePhantom({ reject: true });
    await expect(connectLinkWallet("phantom", port, "https://useagari.xyz", "devnet")).rejects.toBeInstanceOf(WalletLinkError);
    await expect(connectLinkWallet("phantom", port, "https://useagari.xyz", "devnet")).rejects.toThrow("User rejected the request.");
  });
});
