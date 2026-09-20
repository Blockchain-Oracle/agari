/**
 * One program seat into the engine's fixed table (D-063): 0 agari-vault · 1 agari-maker · 2 agari-leverage ·
 * 3 agari-private · 4 agari-arena.
 *
 * `admin_set_authorities` replaces every field, so the registration re-sends the whole current set with only one
 * index changed. An index another key already holds is refused rather than overwritten: an authority slot is
 * somebody's money. A seat exists only in the Ledgers of Windows opened after this lands.
 */
import { findConfigPda, getAdminSetAuthoritiesInstructionAsync } from "@agari/clients/agari-events";
import type { Address } from "@solana/kit";
import { DEFAULT_ADDRESS } from "./venue-spec";
import { send, type SendContext } from "./send";

export async function registerProgramSeat(ctx: SendContext, index: number, seat: Address, label: string): Promise<string | null> {
  const [config] = await findConfigPda();
  const { data } = await ctx.client.agariEvents.accounts.globalConfig.fetch(config);
  const current = data.programAuthorities[index];
  if (current === seat) {
    ctx.log({ step: "set authorities", signature: null, note: `${label} seat ${seat} already at index ${index}` });
    return null;
  }
  if (current !== undefined && current !== DEFAULT_ADDRESS) {
    throw new Error(`program_authorities[${index}] holds ${current}, not the ${label} seat ${seat}`);
  }
  const programAuthorities = data.programAuthorities.map((key, i) => (i === index ? seat : key));
  const ix = await getAdminSetAuthoritiesInstructionAsync({
    admin: ctx.client.payer,
    treasury: data.treasury,
    rollers: data.rollers,
    attestors: data.attestors,
    redstoneSigners: data.redstoneSigners,
    redstoneSignerCount: data.redstoneSignerCount,
    redstoneThreshold: data.redstoneThreshold,
    switchboardQueue: data.switchboardQueue,
    switchboardMinOracles: data.switchboardMinOracles,
    programAuthorities,
    resultRetentionSec: data.resultRetentionSec,
    // The engine re-checks the pinned Switchboard queue on every authority write, so the account must come with
    // it whenever one is set (prints.md §4.4). Omitting it fails as `BadAuthorities`, which reads like a bad key.
    queue: data.switchboardQueue === DEFAULT_ADDRESS ? undefined : data.switchboardQueue,
  });
  return send(ctx, "set authorities", [ix], `${label} seat ${seat} at program_authorities[${index}], every other field unchanged`);
}
