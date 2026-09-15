/**
 * One `admin_set_authorities` for the stage owners' registrations (D-026: the instruction replaces every field, so the
 * whole current set is re-sent with only the intended changes): the vault's `["seat"]` PDA at its fixed index (D-063)
 * and the Switchboard queue + minimum (D-053, D-055 §2.3 step 5), planned as a field-by-field diff first. Server-only;
 * `scripts/deploy/set-authorities.ts` calls these.
 */
import { findConfigPda, getAdminSetAuthoritiesInstructionAsync, type AdminSetAuthoritiesInstructionDataArgs } from "@agari/clients/agari-events";
import { findSeatPda } from "@agari/clients/agari-vault";
import type { Address } from "@solana/kit";
import type { DeployClient } from "./client";
import { send, type SendContext } from "./send";
import { VAULT_AUTHORITY_INDEX } from "./vault";
import { DEFAULT_ADDRESS } from "./venue-spec";

export type AuthoritiesChange = {
  /** Put the vault seat at `program_authorities[VAULT_AUTHORITY_INDEX]`. */
  vaultSeat: boolean;
  /** Pin this Switchboard queue with `minOracles` (1..8); null leaves the pin as it is. */
  queue: Address | null;
  minOracles: number | null;
};

export type AuthoritiesPlan = {
  config: Address;
  treasury: Address;
  admin: Address;
  vaultSeat: Address;
  current: AdminSetAuthoritiesInstructionDataArgs;
  want: AdminSetAuthoritiesInstructionDataArgs;
  /** "field: chain → want" lines; empty when the chain already matches. */
  diffs: string[];
};

const argsOf = (c: AdminSetAuthoritiesInstructionDataArgs): AdminSetAuthoritiesInstructionDataArgs => ({
  rollers: [...c.rollers],
  attestors: [...c.attestors],
  redstoneSigners: [...c.redstoneSigners],
  redstoneSignerCount: c.redstoneSignerCount,
  redstoneThreshold: c.redstoneThreshold,
  switchboardQueue: c.switchboardQueue,
  switchboardMinOracles: c.switchboardMinOracles,
  programAuthorities: [...c.programAuthorities],
  resultRetentionSec: c.resultRetentionSec,
});

const show = (value: unknown): string => (Array.isArray(value) ? `[${value.map(String).join(", ")}]` : String(value));

/** Reads GlobalConfig and plans the change; refuses when the vault index holds a different non-zero key. */
export async function planAuthorities(client: DeployClient, change: AuthoritiesChange): Promise<AuthoritiesPlan> {
  const [config] = await findConfigPda();
  const [vaultSeat] = await findSeatPda();
  const { data } = await client.agariEvents.accounts.globalConfig.fetch(config);
  const current = argsOf(data);
  const want = argsOf(data);
  if (change.vaultSeat) {
    const held = current.programAuthorities[VAULT_AUTHORITY_INDEX];
    if (held !== undefined && held !== DEFAULT_ADDRESS && held !== vaultSeat) throw new Error(`program_authorities[${VAULT_AUTHORITY_INDEX}] holds ${held}, not the vault seat ${vaultSeat}`);
    want.programAuthorities = current.programAuthorities.map((key, i) => (i === VAULT_AUTHORITY_INDEX ? vaultSeat : key));
  }
  if (change.queue !== null) {
    const min = change.minOracles;
    if (min === null || !Number.isInteger(min) || min < 1 || min > 8) throw new Error(`switchboard min oracles must be 1..8, got ${min}`);
    want.switchboardQueue = change.queue;
    want.switchboardMinOracles = min;
  }
  const diffs: string[] = [];
  for (const key of Object.keys(want) as (keyof AdminSetAuthoritiesInstructionDataArgs)[]) {
    if (show(current[key]) !== show(want[key])) diffs.push(`${key}: ${show(current[key])} → ${show(want[key])}`);
  }
  return { config, treasury: data.treasury, admin: data.admin, vaultSeat, current, want, diffs };
}

/** Sends the planned set as the config admin (the client's payer); null when the chain already matches. */
export async function setAuthorities(ctx: SendContext, plan: AuthoritiesPlan): Promise<string | null> {
  if (plan.diffs.length === 0) {
    ctx.log({ step: "set authorities", signature: null, note: "every field already matches" });
    return null;
  }
  if (ctx.client.payer.address !== plan.admin) throw new Error(`the payer ${ctx.client.payer.address} is not the config admin ${plan.admin}`);
  // The handler checks a non-zero queue account itself (owner and discriminator), so it rides along when pinned.
  const queue = plan.want.switchboardQueue === DEFAULT_ADDRESS ? undefined : plan.want.switchboardQueue;
  const ix = await getAdminSetAuthoritiesInstructionAsync({ admin: ctx.client.payer, treasury: plan.treasury, queue, ...plan.want });
  return send(ctx, "set authorities", [ix], plan.diffs.join("; "));
}
