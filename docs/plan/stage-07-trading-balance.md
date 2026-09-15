# S7 — Trading Balance vault, tap trading, plain cash-out

**Goal:** a Phantom (Wallet Standard) user on devnet runs Masayume's Trading Balance and tap-trading loop on Solana.
1. `/portfolio` → Trading Balance → deposit tUSDC, then withdraw (Y-16).
2. Ticket → Tap-trading → caps sheet → **one signature** opens the vault account, deposits and grants a SESSION key.
3. **Three taps with zero wallet popups.** The session key signs, the `sponsor` role pays the fee, and each fill goes through `agari-vault` into the vault's PROGRAM seat.
4. A tap over the caps is refused before anything is signed or sent.
5. The Window settles → `crank_settle` credits the owner's Trading Balance, by anyone and always to the owner.
6. Revoke returns the budget → owner withdraw to their own ATA.
7. A plain position cashes out with an IOC sell. With nothing to sell into, it says "No exit liquidity" (L-35).

- **Plan:** `00-plan.md` §3.2 (vault row `:367`, fees `:376-385`), §3.3, §3.4, §7.2 S7 (`:985-1009`).
- **Contract:**
  - `docs/plan/specs/vault.md` (program);
  - `docs/plan/specs/tap-trading.md` (adapter, session key, sponsor, web, lanes).
- **Wallets:** Wallet Standard via the Kit wallet plugin; there is no Privy (D-023). The sponsor co-sign moved here from S4 (D-023, D-035).

**Branch:** `stage/S7-trading-balance` in worktree `../agari-wt/s7`, cut from `stage/S4-first-call` @ `c5ddb60` while S4's gate items (devnet drive, browser pass) are still open.
- Lanes `slice/S7{a,b,c}-*` live in `../agari-wt/s7{a,b,c}` and merge into the stage branch in the order foundation → 7a.1 → codegen → 7a → 7b → 7c (tap-trading.md §6).
- Nothing merges to `main` before the S1/S2/S3/S4 gates.

**D-number range:** D-061…D-070.

## Steps

- [x] Foundation (stage owner, D-061…D-069; the deployer SOL ask is raised and still open):
  - **D-entries:**
    - D-061: contract frozen; lanes; S7 starts before the S4 gate.
    - D-062: account model deltas (vault.md §1).
    - D-063: `program_authorities` index table and `set-authorities` (vault.md §5.1).
    - D-064: error range 7000–7299 and CPI client; 7a supplies the size evidence.
    - D-065: sponsor co-sign policy (tap-trading.md §3).
    - D-066: non-extractable session key (§2).
    - D-067: cash-out ports (§1.4, §5).
    - D-068: settler cranks the vault seat and the indexer decodes vault events.
    - D-069: `VaultDeployment` reshape; gate row "sponsored fill" moved here.
  - **Keys and addresses:** `~/.config/agari/programs/agari-vault.json` (create-once; give 7a the address), `anchor/Anchor.toml` `[programs.*] agari_vault`, `addresses.devnet.json` `programs.agari_vault` placeholder, so `program-id-drift` holds.
  - **Ports** (tap-trading.md §5): `VaultDeployment`, `VAULT_NOT_DEPLOYED`, `keyTopUpLamports?`, `CashOutRequest` + `submitCashOut` + `BookedOrder.proceedsBase?`, `freshExitQuote` + `ExitQuote`.
  - **Env and exports:** `NEXT_PUBLIC_AGARI_VAULT_PROGRAM_ID` (`packages/markets/src/env.ts`, `web/src/lib/env.ts`, `.env.example`, `web/.env.local`); the `web/.env.example:84-98` EVM vault and sponsor block rewritten for Solana; package exports `@agari/markets/sponsor` and `generateSessionKey`.
  - **Context7:**
    - Kit 8.3 `generateKeyPair` (non-extractable) and IndexedDB structured clone of `CryptoKey`;
    - `partiallySignTransactionMessageWithSigners`;
    - `simulateTransaction` `accounts` config and `getFeeForMessage`;
    - Anchor 1.2 `Option<AccountLoader>` and `declare_program!`.
  - **Invariant:** `session-key-non-extractable` (`optional: true` until the files exist).
  - **User:** devnet SOL for the deployer (≈ 5.5 SOL; Handoff).
- [x] 7a.1 IDL freeze: every vault accounts struct, arg, zero-copy layout (offset and size asserts), event and error builds with `NO_DNA=1 anchor build --arch v0`. Stage owner: `pnpm codegen` → `@agari/clients/agari-vault` (D-025); `idl-no-destination` and `program-id-drift` green.
- [x] 7a program:
  - handlers per vault.md §3;
  - LiteSVM `vault_caps` (10 vectors), `vault_funding`, `vault_trading` (AD-5, WindowPredatesVault, seat invariant, Ledger closes after cranks);
  - CU and transaction bytes measured into vault.md §9;
  - `.so` size of both CPI-client options (D-064).
  - Merged ebf9259 (f842877): vault_caps 10/10 vectors, vault_funding 8/8, vault_trading 13/13, events 34/34; program_autofixer clean. Measured CU/bytes and sizes in vault.md §9; D-064 outcome keeps (a); budget ≈ 6 SOL.
- [x] 7b adapter:
  - vault reads and `vaultBase`;
  - every vault TxIntent;
  - order route through the vault (`order-lane.ts:63`);
  - plain cash-out on all three routes;
  - sponsor policy + co-sign server module + client transport;
  - session-key session `{ keyPair }`;
  - vault event decoder, index tables and tally route, settler crank helper;
  - Surfpool fork proofs (tap-trading.md §6), policy vitests.
  - Merged 47f31dd (5 commits; 54 vitests) + 7c e45edd6 (route awaits `loadVaultDeployment`, key session co-signs through `createSponsorTransport`, `sponsor_cosigns` DB ledger). Fork proofs on 7a's exact .so: enable in one signature, three sponsored taps with the key at 0 SOL, cap refusal with no send, cash-out on both routes, a killed co-signed tap reconciled by signature, revoke, stranger crank, Ledger close, withdraw. Findings: a tap above ~606 ticks exceeds the 95¢ cap once the 5m cost-cap buffer pads the limit (feeds the open cost-cap decision); fork drives must `syncClock()` after time travel. Still unprovable until the devnet deploy: sponsored taps with zero popups, armed/expired/revoked with real data, a cap refusal, a cash-out fill. Open for the stage owner: the `wallet/:w/vault-tallies` index route + `idx_vault_fills`/`idx_vault_settlements` writer.
- [x] 7c web:
  - session key v2 store and one-transaction enable;
  - `/api/sponsor` GET/POST on the policy, with P-11 gating;
  - fee rows from the real key balance;
  - cash-out links on `BetRow` and `VaultBetRow`;
  - Solana copy (`VAULT.notDeployed.how`, how-it-works cash-out answer);
  - dev fixtures;
  - checked against masayume.app.
  - Merged f11ff6d and 034738c (651b5c1): `useKeySession` signs with `{ keyPair }`; the sponsor policy, chain checks, gates, co-sign and service live in `packages/markets/src/sponsor` (`@agari/markets/sponsor`, server-only: its index pulls node:fs); `/api/sponsor` is a thin route. 17 sponsor vitests on real Kit v0 transactions, build green. The invariant is no longer optional; P-11 closed. Top-up writes: `vault-grant.keyTopUpLamports?` and `vault-key-top-up` (7b builds, 7c wires). Still 7b: client sponsor transport, DB `SponsorLedger`, real `resolveVaultDeployment`.
- [ ] Deploy (stage owner):
  - `solana program deploy` `--arch v0` binary;
  - IDL metadata (D-026);
  - `scripts/deploy/init-vault.ts` (`admin_init_vault`);
  - `scripts/deploy/set-authorities.ts` (index 0 = vault seat; every other field re-sent unchanged);
  - `venue-spec.ts:100` updated;
  - `sponsor` role funded;
  - acceptance rows for each transaction.
- [ ] Ops wiring (stage owner): indexer program set; settler cranks vault slots after `SETTLER_REDEEM_GRACE_SEC`, then closes the Ledger (venue-ops.md §7 amended by D-068). The soak shows a vault-touched Ledger closing.
- [ ] Devnet drive `scripts/drive/vault.ts` (7b, finished by the stage owner) through the gate list below, during NYSE hours.
- [ ] Browser pass at 390/768/1440 in both themes:
  - not deployed, empty, funded;
  - armed, expired, revoked;
  - cap refusal;
  - sponsor refused (key pays or wallet fallback);
  - Window predating the vault;
  - cash-out fill, no exit liquidity, locked.
  - Update `docs/plan/audits/ui-fidelity-2026-09-14.md` (P-11 closed).
- [ ] `parity.md` rows L-27, L-28, L-35, L-46, Y-16 advanced at the gate.

## Gate

- **Full gate:** `pnpm typecheck && pnpm invariants`, `pnpm build`, `NO_DNA=1 anchor build --arch v0`; `cargo test --manifest-path anchor/tests/Cargo.toml` (vault suites).
- **Caps:** all 10 vectors pass in the Rust replay and in `packages/core/src/vault/caps.test.ts`. `idl-no-destination` passes over the vault IDL.
- **Devnet (Wallet Standard, Phantom; no Privy), each an `acceptance.md` row:**
  - vault deploy, `admin_init_vault`, `admin_set_authorities` registering the vault seat;
  - `owner_deposit_and_grant`: **one wallet signature**;
  - **3 session taps with zero popups, fee payer = `sponsor`, signer = session key**: the "sponsored fill (fee payer = sponsor)" row moved from S4 (D-023, D-035);
  - a cap refusal that sends **no transaction and no co-sign request**;
  - `owner_revoke` returns the budget;
  - `owner_withdraw` to the owner's ATA;
  - `public_crank_settle` by a third party credits the owner;
  - a plain cash-out IOC sell fills (wallet route);
  - the Ledger closes after the settler cranks the vault seat.
- **Journal recovery:** a tap killed after the co-sign returns reconciles by signature, and nothing is re-signed.

**Rows:** L-27, L-28, L-35, L-46, Y-16.

## Findings

- **Foundation (Context7 + installed sources):**
  - Kit 8.3 `generateKeyPair(extractable = false)` → `crypto.subtle.generateKey("Ed25519", false, …)`; `getAddressFromPublicKey(publicKey)`; `createSignerFromKeyPair(keyPair): KeyPairSigner`. Forbid `generateKeyPair(true)`, and in the session key's path the bytes constructors (`createKeyPairFromBytes`, `createKeyPairSignerFromBytes`), which hold the secret in JS memory.
  - `CryptoKey` is `[Serializable]` (WebCrypto spec): IndexedDB structured clone keeps `[[extractable]] = false`. Ed25519 WebCrypto: Chrome 137, Firefox 129, Safari 17. Safari signs Ed25519 randomized, so a re-sign changes the txid (never re-sign, D-033).
  - Names outside the DOM lib: `services/ops` has no `CryptoKeyPair` global, so markets names it `Awaited<ReturnType<typeof generateKeyPair>>`.
  - `partiallySignTransactionMessageWithSigners(msg)` accepts a plain-address fee payer (`setTransactionMessageFeePayer(address, msg)`). It compiles every missing signer slot as 64 zero bytes and never asserts full signing. The wire form is `getBase64EncodedWireTransaction(tx)`.
  - `simulateTransaction(base64, { encoding: "base64", sigVerify: false, replaceRecentBlockhash?, accounts: { addresses, encoding } })` returns `accounts` in address order, plus `unitsConsumed`, `fee` and balances. `sigVerify` and `replaceRecentBlockhash` conflict only when both are true.
  - `getFeeForMessage(base64Message)` → `Lamports | null` (null = the blockhash expired). Kit has no message-to-base64 helper: use `getBase64Decoder().decode(tx.messageBytes)`.
  - Anchor 1.2 supports `Option<AccountLoader<'info, T>>` with `mut`/`seeds` (the constraints run only when `Some`; `None` = the program id in that slot).
  - `declare_program!(name)` reads `idls/<name>.json` from the nearest ancestor `idls/` directory. It generates `cpi`, `accounts` (zero-copy types with `ZeroCopy`/`Owner`), `program`, `errors` and `events`. CPI account structs are plain `AccountInfo`, so drop loaders before invoking.

## Handoff

- **Foundation facts (`feat(S7.0/foundation)`):**
  - **agari-vault program id `84puRVxGcjs7JNcPCVAEkkK6ZFXneEC8yky8RTMzhPi9`** (keypair `~/.config/agari/programs/agari-vault.json`, create-once, never printed). 7a: `declare_id!("84puRVxGcjs7JNcPCVAEkkK6ZFXneEC8yky8RTMzhPi9")`, crate `anchor/programs/agari-vault`, lib name `agari_vault`. It is already in `Anchor.toml` (localnet, devnet), `addresses.devnet.json` `programs.agari_vault` and `web/.env.local` `NEXT_PUBLIC_AGARI_VAULT_PROGRAM_ID`. Before the first `anchor build` in a worktree, copy it to `anchor/target/deploy/agari_vault-keypair.json` (gitignored; Anchor otherwise generates a mismatching key, as stage-02 notes for agari-events); never run `anchor keys sync`.
  - **Ports (additive, D-067/D-069):**
    - core `VaultDeployment { chainId, eventVault, seat, config, collateral, fromBlock }` and `VAULT_NOT_DEPLOYED`;
    - `ExitQuote` (core types);
    - `MarketsProvider.freshExitQuote(target, side, contractsRaw)`;
    - `CashOutRequest`, `CashOutOutcome` (requote carries `exit`), `Submitter.submitCashOut`, `BookedOrder.proceedsBase?`, `vault-deposit-and-grant.keyTopUpLamports?`.
  - **Stubs 7b replaces:** `packages/markets/src/provider/exit-quote.ts` (not-deployed reading) and `submitter/cash-out.ts` (refused not-deployed), both already wired into `marketsProvider` and `createSubmitter`. `resolveVaultDeployment` still returns null.
  - **Exports:**
    - `generateSessionKey(): Promise<{ address, keyPair }>` is implemented in `sessions/session-key.ts` and exported from `@agari/markets` and `@agari/markets/sessions`. 7c's store imports it instead of `F/session/keygen.ts`.
    - `@agari/markets/sponsor` (server-only) has a placeholder index. `sponsor.ts` moved to `sponsor/status.ts`; `SponsorStatus` gains `reason?`, and it is the only thing the root re-exports.
  - **Env:** `MarketsEnv.vaultProgramId`, from `NEXT_PUBLIC_AGARI_VAULT_PROGRAM_ID` via `marketsEnvInputFrom` and `web/src/lib/env.ts`.
    - 7c: `F/session/sponsor.server.ts` `marketsEnvFromProcess` lists the vars by hand and doesn't pass `vaultProgramId`. Use `parseMarketsEnv(marketsEnvInputFrom(process.env))`.
    - 7b: `.env.local` now carries the id before the program exists, so a deployment resolved from env alone would read a missing `VaultConfig`. Treat an absent config account as not deployed.
  - **Invariants:**
    - `session-key-non-extractable` is optional only while `F/session/keygen.ts` still exports its key (that file is waived, everything else is checked now). 7c removes the waiver; the gate needs the rule to run, not skip.
    - `program-id-drift` now also holds Anchor.toml devnet == `addresses.devnet.json` for a program with no crate yet.
  - `web/.env.example` has the Solana vault and sponsor block, with the spec's `SPONSOR_*` limit names. `pnpm env:check` lists the vault id (S7) and `SPONSOR_PRIVATE_KEY` (optional; role file fallback).
  - **Q-S7-1/2/3:** answered with the defaults (D-065, D-063, D-062).
- **Lanes** (tap-trading.md §6):
  - **7a program:** Surfpool 8980/8981; LiteSVM in `anchor/tests`.
  - **7b adapter:** Surfpool 8990/8991, DB `agari_s7b`.
  - **7c web:** web on port 3007.
  - Lanes report back. Only the stage owner edits manifests, the lockfile, `packages/core/src/ports/**`, `packages/core/src/vault/types.ts`, `packages/markets/src/{env,index}.ts`, `web/src/providers/**`, `web/src/lib/env.ts`, `.env.example`, `web/.env.local`, `services/ops/**`, `scripts/invariants/**`, `scripts/deploy/**`, `anchor/Anchor.toml`, `anchor/Cargo.toml`, program and role keypairs, deploys and `docs/plan/**`.
- **Order of work:**
  - 7c starts at the foundation against `/dev/{vault,session}` fixtures and the stub.
  - 7b starts at the 7a.1 IDL freeze.
  - An IDL change after the freeze needs a D-entry and a re-codegen before 7b continues.
- **Chain facts the lanes rely on:**
  - agari-events `cDcHZiQ1…` has no program authorities (`packages/markets/src/deploy/venue-spec.ts:100`).
  - Live Windows listed before `set-authorities` keep user seats at index 0, so the vault refuses them (7207) until each Series rolls once (≤ 60 min).
  - Off-hours write proofs use a Surfpool devnet fork with a drive-opened Window, the vault deployed locally and `set-authorities` signed by the fork's `deployer` (D-027 pattern).
  - `NO_DNA=1 surfpool start --network devnet --no-deploy --no-tui -p <port> -w <ws>`, run from a directory without `Anchor.toml`.
- **Keys** (`~/.config/agari/devnet/`, never printed):
  - `sponsor.json` exists (the fee payer; the server reads it when `SPONSOR_PRIVATE_KEY` is unset, D-034 pattern);
  - `deployer.json` is the engine admin and vault upgrade authority.
  - The program keypair is new at the foundation.
- **Devnet SOL:**
  - Needed: vault deploy peak ≈ 3.1–4.6 SOL (buffer refunded; programdata rent ≈ 1.5–2.3 SOL kept), IDL ≈ 0.03, sponsor float 0.5, drive owners ≈ 0.06. **Ask the user for ≈ 5.5 SOL.**
  - Available: the deployer held 3.32 SOL at 2026-09-14 16:50Z (STATUS) and **0.73 SOL at 2026-09-15 06:18Z**. `sponsor` (`5kKwdNLo…`) holds 0 SOL. The ≈ 5.5 SOL ask stands. Funding inbox `5zjywmmJ…` forwards to the deployer.
- **Coordination:**
  - S8 (maker) registers index 1 with the same `set-authorities` script, and S6 sets the Switchboard queue with it. Run one at a time; each run re-sends every field.
  - The games sponsor route shares the `sponsor` role (S12), not this policy.
- **Open questions** (tap-trading.md §8, defaults recommended):
  - Q-S7-1: faucet SOL target stays 0.02 with the sponsor on;
  - Q-S7-2: the fixed index table;
  - Q-S7-3: 16 position slots.
