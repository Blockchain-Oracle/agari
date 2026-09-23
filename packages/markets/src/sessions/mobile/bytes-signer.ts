import {
  assertIsTransactionWithinSizeLimit,
  bytesEqual,
  getCompiledTransactionMessageDecoder,
  getTransactionCodec,
  getTransactionLifetimeConstraintFromCompiledTransactionMessage,
  type Address,
  type TransactionModifyingSigner,
} from "@solana/kit";

/** A wallet that signs wire transactions as bytes: a deeplink hand-off (Phantom, Solflare) or Mobile Wallet Adapter. */
export type SignWireTransactions = (wire: Uint8Array[], abortSignal?: AbortSignal) => Promise<Uint8Array[]>;

const codec = getTransactionCodec();

/**
 * A Kit modifying signer over a byte-level wallet, with the lifetime rules of Anza's Wallet Standard signer
 * (@solana/wallet-account-signer): when the wallet returns our message untouched, or keeps our blockhash, our
 * lifetime (with its last valid height) stands; when it changed the blockhash, the lifetime is read from its bytes.
 */
export function bytesSigner(address: Address, signWire: SignWireTransactions): TransactionModifyingSigner {
  return Object.freeze({
    address,
    async modifyAndSignTransactions(transactions, config = {}) {
      config.abortSignal?.throwIfAborted();
      if (transactions.length === 0) return [];
      const signed = await signWire(transactions.map((tx) => new Uint8Array(codec.encode(tx))), config.abortSignal);
      if (signed.length !== transactions.length) throw new Error(`the wallet returned ${signed.length} of ${transactions.length} transactions`);
      // Kit types the result as the caller's own transaction type; the decoded bytes carry the same shape.
      return (await Promise.all(
        signed.map(async (bytes, index) => {
          const decoded = codec.decode(bytes);
          assertIsTransactionWithinSizeLimit(decoded);
          const input = transactions[index]!;
          const existing = "lifetimeConstraint" in input ? input.lifetimeConstraint : undefined;
          if (existing && bytesEqual(decoded.messageBytes, input.messageBytes)) return Object.freeze({ ...decoded, lifetimeConstraint: existing });
          const compiled = getCompiledTransactionMessageDecoder().decode(decoded.messageBytes);
          if (existing && compiled.lifetimeToken === ("blockhash" in existing ? existing.blockhash : existing.nonce)) {
            return Object.freeze({ ...decoded, lifetimeConstraint: existing });
          }
          return Object.freeze({ ...decoded, lifetimeConstraint: await getTransactionLifetimeConstraintFromCompiledTransactionMessage(compiled) });
        }),
      )) as unknown as never;
    },
  });
}
