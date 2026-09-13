import { randomBytes } from "node:crypto";
import { FAUCET_UNITS } from "@masayume/core/constants";
import { oneUnit } from "@masayume/core/units";
import { createMemoryJournal, createSubmitterSession, loadCollateral } from "@masayume/markets";
import { runSpike } from "./lib/boot";

const json = (value: unknown) => JSON.stringify(value, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v), 2);

/** Proves the tx lane refuses before any popup: an unfunded random key must get a clean out-of-gas diagnosis and send nothing. */
await runSpike(async ({ env }) => {
  const session = await createSubmitterSession({
    env,
    authority: "user-wallet",
    signer: { privateKey: `0x${randomBytes(32).toString("hex")}` },
    journal: createMemoryJournal(),
  });
  const wallet = session.address;

  const collateral = await loadCollateral();
  if (!collateral.ok) throw new Error(collateral.error.technical);

  const { submitter } = session;
  console.log("signer", wallet, "authority", session.authority);
  console.log("checkGas", json(await submitter.checkGas("faucet")));

  const amountBase = FAUCET_UNITS * oneUnit(collateral.value.decimals);
  const outcome = await submitter.submitTx({ kind: "faucet", amountBase }, (phase) => console.log("phase", phase));
  console.log("submitTx", json(outcome));
  console.log("unresolved", json(await submitter.journal.listUnresolved(wallet)));
  await session.dispose();
});
