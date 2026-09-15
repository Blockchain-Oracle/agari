import { createHash } from "node:crypto";
import { identifyAgariVaultInstruction } from "@agari/clients/agari-vault";
import idl from "@agari/clients/agari-vault/idl.json";
import { describe, expect, it } from "vitest";
import { SPONSOR_ALLOWLIST, SPONSORABLE_INSTRUCTIONS } from "./status";

/** Anchor's instruction discriminator: the first 8 bytes of `sha256("global:<name>")`. */
const discriminatorOf = (name: string) => [...createHash("sha256").update(`global:${name}`).digest().subarray(0, 8)];

const instructions = (idl as { instructions: { name: string; discriminator: number[] }[] }).instructions;
const byName = new Map(instructions.map((ix) => [ix.name, ix.discriminator]));

describe("the sponsor's allowlist is the program's own instructions", () => {
  it("every agari-vault instruction's IDL discriminator is sha256(global:<name>)", () => {
    expect(instructions.length).toBeGreaterThan(0);
    for (const ix of instructions) expect(ix.discriminator, ix.name).toEqual(discriminatorOf(ix.name));
  });

  it("each allowlisted name exists in the IDL, and its discriminator identifies it to the policy", () => {
    expect(SPONSOR_ALLOWLIST).toEqual(SPONSORABLE_INSTRUCTIONS.map((name) => `agari_vault:${name}`));
    for (const name of SPONSORABLE_INSTRUCTIONS) {
      const discriminator = byName.get(name);
      expect(discriminator, `${name} is not an agari-vault instruction`).toEqual(discriminatorOf(name));
      expect(identifyAgariVaultInstruction(Uint8Array.from(discriminator!))).toBeDefined();
    }
  });

  it("deposits and grants are never sponsorable", () => {
    for (const name of ["owner_deposit", "owner_deposit_and_grant", "owner_grant", "owner_fund_grant", "owner_place", "admin_init_vault"]) {
      expect(SPONSORABLE_INSTRUCTIONS).not.toContain(name);
      expect(byName.has(name), `${name} should still exist in the IDL`).toBe(true);
    }
  });
});
