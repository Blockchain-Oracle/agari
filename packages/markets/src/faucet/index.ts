import { FaucetError, STT_FAUCET_POLICY, type FaucetClaim } from "@masayume/core/faucet";
import { createPublicClient, http, keccak256, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SOMNIA_SHANNON } from "../chain";

/** Dedicated server-side funding key. Nothing from this module is imported by browser code. */
export function createFaucetChain(privateKey: Hex, rpcUrl: string = SOMNIA_SHANNON.rpcUrls.default.http[0]) {
  const account = privateKeyToAccount(privateKey);
  const client = createPublicClient({ chain: SOMNIA_SHANNON, transport: http(rpcUrl, { timeout: 7_000, retryCount: 0 }) });
  async function checkNetwork() {
    if (await client.getChainId() !== STT_FAUCET_POLICY.chainId) throw new FaucetError("wrong-network", "The testnet faucet is unavailable on this network.", 503);
  }
  return {
    address: account.address.toLowerCase(),
    balance: (wallet: string) => client.getBalance({ address: wallet as Address, blockTag: "latest" }),
    verify: (wallet: string, message: string, signature: string) => client.verifyMessage({ address: wallet as Address, message, signature: signature as Hex }),
    async prepare(wallet: string, amountWei: bigint) {
      await checkNetwork();
      const [latestNonce, pendingNonce, gasPrice, estimate] = await Promise.all([
        client.getTransactionCount({ address: account.address, blockTag: "latest" }),
        client.getTransactionCount({ address: account.address, blockTag: "pending" }),
        client.getGasPrice(), client.estimateGas({ account, to: wallet as Address, value: amountWei }),
      ]);
      if (latestNonce !== pendingNonce) throw new FaucetError("busy", "A funding transfer is still confirming. Please try again shortly.");
      const gas = (estimate * 12n + 9n) / 10n;
      const price = (gasPrice * 12n + 9n) / 10n;
      const feeWei = gas * price;
      // Shannon estimates 631,500 gas to create a fresh recipient account (read 2026-09-08).
      // Bound treasury spending in STT, not Ethereum-sized gas units: the former 300k cap
      // rejected empty wallets even though their estimated transfer fee was within budget.
      if (feeWei > STT_FAUCET_POLICY.maxTransferFeeWei) throw new FaucetError("fees-high", "Network fees are above the faucet limit. Try again later.", 503);
      const rawTransaction = await account.signTransaction({ chainId: STT_FAUCET_POLICY.chainId, type: "legacy", nonce: latestNonce, gas, gasPrice: price, to: wallet as Address, value: amountWei });
      return { nonce: latestNonce, feeWei: feeWei.toString(), rawTransaction, txHash: keccak256(rawTransaction) };
    },
    async inspect(claim: FaucetClaim): Promise<FaucetClaim["status"]> {
      await checkNetwork();
      try {
        const receipt = await client.getTransactionReceipt({ hash: claim.txHash as Hex });
        const tx = await client.getTransaction({ hash: claim.txHash as Hex });
        if (tx.from.toLowerCase() !== claim.funder || tx.to?.toLowerCase() !== claim.wallet || tx.value !== BigInt(claim.amountWei) || tx.nonce !== claim.nonce || tx.input !== "0x") return "conflict";
        return receipt.status === "success" ? "confirmed" : "reverted";
      } catch (error) {
        // Only an explicit receipt-not-found is uncertainty. RPC failures must not authorize another send.
        if (!(error instanceof Error) || error.name !== "TransactionReceiptNotFoundError") throw error;
      }
      const nonce = await client.getTransactionCount({ address: claim.funder as Address, blockTag: "latest" });
      return nonce > claim.nonce ? "conflict" : "prepared";
    },
    async broadcast(claim: FaucetClaim) {
      await checkNetwork();
      if (keccak256(claim.rawTransaction as Hex) !== claim.txHash) throw new FaucetError("journal-invalid", "The saved gas transfer needs operator review.", 503);
      // Re-broadcasting these exact signed bytes has the same nonce/hash. It cannot create a second payment.
      const hash = await client.sendRawTransaction({ serializedTransaction: claim.rawTransaction as Hex });
      if (hash !== claim.txHash) throw new FaucetError("hash-mismatch", "The funding transaction needs operator review.", 503);
    },
  };
}
export type FaucetChain = ReturnType<typeof createFaucetChain>;
