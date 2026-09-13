# 04 — Solana developer stack + Masayume → Solana port map

Researched 2026-09-13 for **Stocklana** (submissions close 2026-09-18). Versions were checked live on
the npm registry and the crates.io API that day. Rent was read from devnet and mainnet RPC. Jupiter and Pyth
were called live. Anything not confirmed from a primary source is marked **UNVERIFIED**.

Local toolchain check: `solana`, `anchor`, `avm` and `surfpool` are **not installed**. rustc 1.96, node 25.9 and pnpm
are. Budget about an hour on Day 1 for the toolchain.

---

## 0. Decisions at a glance

| Question | Pick | Why |
| --- | --- | --- |
| Program framework | **Anchor 1.2.0** (`anchor-lang`/`anchor-spl` 1.2.0, released 2026-09-04) | First stable major is 1.0 (Apr 2026). It has no Solana CLI dependency, uses LiteSVM and Surfpool by default, and generates the IDL for Codama. Pinocchio is too slow to write in 5 days. |
| Number of programs | **One monolithic Anchor program** (`stocklana`) | Each devnet deploy costs about 1.5–4 SOL of rent (see §1.6). One program means no CPI between our own programs and one IDL/client. |
| Outcome positions | **Internal ledger PDAs** (`Position` per window × owner), **not** SPL mints per outcome | No ATAs (0.0015 SOL each, paid by the sponsor), no transfer surface, and a simpler claim. Masayume already holds ERC-6909 positions inside the vault (`positionOf`), so this matches. |
| TS client for our program | **Codama-generated `@solana/kit` client** | This is what the official `kit/nextjs-anchor` template does. `@anchor-lang/core` still depends on web3.js 1.x. |
| Frontend base | `@solana/kit` 8.3.0 + template hooks (`@solana/react-hooks`) or `@solana/react` 8.3.0 | Official docs call web3.js v1 and wallet-adapter "legacy". Masayume's web app uses RainbowKit/wagmi/viem, so the wallet layer is a rewrite anyway. |
| Login / no seed phrase | **Privy** `@privy-io/react-auth` 3.42.0 (Solana embedded wallets; peer `@solana/kit >=3.0.3`) | Email, Google and X login. X login matters for trade-from-X. Kit-native. Phantom Connect is the alternative. |
| Gasless | **Our own `/api/sponsor` co-sign route** (a policy-checked fee payer) on Day 2. Swap in **Kora** only if time allows. | Solana separates fee payer from signer natively, so no forwarder contract is needed. Kora is the audited "Onara policy file" equivalent but is another service to run. |
| Tap-to-trade and agent caps | **Port EventVault grants natively**: a `Grant` PDA naming a session or agent pubkey with caps, budget and expiry | One popup to create the grant, then no popups. Works with any wallet and keeps Masayume's no-divert invariant. MagicBlock session keys give no amount caps and drag in web3.js/anchor 0.30. |
| Oracle | Pyth pull oracle, `pyth-solana-receiver-sdk` 2.0.0 (depends on `anchor-lang ^1.0.2`) | Hermes has `Equity.US.AAPL/USD`-style feeds with a **market-hours schedule** (confirmed live). |
| Realtime | Kit `accountNotifications` over a Helius WSS endpoint (free tier) | No indexer. Use `getProgramAccounts` + memcmp in place of Masayume's `VaultTally`. |
| Randomness (Lucky Draw) | Keep Masayume's **off-chain HMAC commit-reveal** (`packages/core/src/games/lucky.ts`) | Zero on-chain dependency. MagicBlock VRF is the upgrade path. |
| Ephemeral Rollups | **Cut** | 400 ms slots are fast enough for minute/hour windows. Delegating accounts that hold USDC ledgers adds risk. |
| Blinks | Build one Action endpoint (about 2 h). Demo via dial.to or the Phantom extension with the experimental flag on. | On X, a blink unfurls only for extension users and only if it is registered with Dialect. |
| Swap into xStocks | Jupiter Swap API v2 (**mainnet only**). On devnet, show a quote plus a deep link and mock the rest. | `TSLAx` is verified on Jupiter (Token-2022, 8 decimals). |
| Earn yield | **The house reserves are Earn** (LP shares in the Parlay/Range reserve). External lending is roadmap only. | Neither Jupiter Lend nor Kamino documents devnet. |

---

## 1. Programs

### 1.1 Anchor 1.x — what changed and how to install

- **Versions:** crates `anchor-lang` 1.2.0 and `anchor-spl` 1.2.0. npm `@anchor-lang/core`, `@anchor-lang/cli`, `@anchor-lang/spl-token`
  and `@anchor-lang/borsh` are all 1.2.0. The old `@coral-xyz/anchor` stops at 0.32.1 (Oct 2025).
- **1.0.0 (2026-04-02) breaking changes:**
  - The TS package moved to `@anchor-lang/core`.
  - The CLI no longer needs the `solana` binary (native `balance`, `airdrop`, `address`, `deploy`).
  - `anchor test` and `anchor localnet` use **Surfpool** by default (needs v1.1.2+).
  - `anchor init` generates a **LiteSVM** test template by default (`--test-template mollusk` is the alternative).
  - `anchor build` checks that `declare_id!` matches the keypair.
  - Context lifetimes drop from 4 to 2.
  - **Duplicate mutable accounts are rejected unless you add the `dup` constraint.**
  - Legacy IDL instructions are replaced by the Program Metadata Program.
  - 1.0 required Solana 3.x (3.1.10 recommended). AVM 1.2 resolves Solana and platform-tools from the Anchor version.
- **1.1/1.2 highlights:** versioned tx support in the client, `--arch`/`--tools-version`, TS error constants generated from the
  IDL, SPL pausable-mint helpers, `AccountLoader::new_unchecked`, and all-zero discriminators rejected. Rust MSRV is 1.89.
- **Install** (from anchor-lang.com/docs/installation):
  ```bash
  curl --proto '=https' --tlsv1.2 -sSfL https://solana-install.solana.workers.dev | bash   # rust + solana + anchor + surfpool one-liner
  # or step by step:
  cargo install --git https://github.com/otter-sec/anchor avm --force   # repo is also served at solana-foundation/anchor
  avm install 1.2.0 && avm use 1.2.0
  curl -sL https://run.surfpool.run/ | bash                                # Surfpool
  anchor init stocklana            # LiteSVM tests by default
  anchor build && anchor test
  solana config set -ud && anchor deploy --provider.cluster devnet   # 'solana' only needed for config/airdrop convenience
  ```
- **Gotcha:** most blog posts and LLM output still target 0.30/0.31 (`@coral-xyz/anchor`, 4-lifetime `Context`,
  `solana-test-validator`, `ctx.bumps.get("x")`). Pin 1.2.0 everywhere. The `kit/nextjs-anchor` template's pinned Anchor
  version is **UNVERIFIED**, so check `anchor/Cargo.toml` after scaffolding and bump it.

### 1.2 Third-party crates vs Anchor 1.x (checked against crates.io dependency metadata)

| Crate | Version | `anchor-lang` requirement | Works with Anchor 1.2? |
| --- | --- | --- | --- |
| `pyth-solana-receiver-sdk` | 2.0.0 | `^1.0.2` | Yes |
| `session-keys` (MagicBlock) | 3.1.1 | `>=0.28, <2.0` | Yes |
| `ephemeral-rollups-sdk` / `ephemeral-vrf-sdk` | 0.17.0 | both `<1.0` and `^1.0` (feature-gated) | Probably. The feature flag name is **UNVERIFIED**. |
| `switchboard-on-demand` | 0.13.0 | `>=0.31.0` (docs still say Anchor 0.31.1) | Semver allows it. Compile compatibility is **UNVERIFIED**. |
| `orao-solana-vrf` | 0.7.0 | `^0.32.1` | **No.** It would pull in two anchor-lang versions. |
| `anchor-litesvm` | 0.4.0 | `^1.0.0` (litesvm ^0.11) | Yes |

### 1.3 Native / Pinocchio

`pinocchio` 0.11.2 and `pinocchio-token` 0.7.0 are zero-dependency and much cheaper in compute units and binary size.
There's a `kit/pinocchio-counter` template. **Don't use it this week**: you hand-roll account validation, there's no IDL,
and Codama needs a manual IDL or Shank. It only makes sense later to shrink deploy rent.

### 1.4 EVM → Solana concept map (for Solidity devs)

| EVM / Masayume | Solana / Anchor | Notes and gotchas |
| --- | --- | --- |
| Contract storage (`mapping`) | **Accounts**, usually **PDAs**: `seeds = [b"user", owner.as_ref()]` | Size is fixed at `init` (`space = 8 + T::INIT_SPACE`, `#[derive(InitSpace)]`). Grow with `realloc`. Every account costs rent (§1.6). No unbounded arrays: cap `Vec` lengths with `#[max_len(n)]`. |
| `mapping(address=>mapping(..))` iteration and paged getters (`VaultTally`, `parlaysOf`) | Client-side `getProgramAccounts` with `memcmp` on the owner field (offset 8) | There are no view functions. Reads mean fetching and decoding accounts (Codama `fetchX`) or simulating. |
| `msg.sender` | A `Signer<'info>` account in the instruction | Several signers are possible. The fee payer is a separate signer. |
| `ERC2771Context._msgSender()` + forwarder | **Delete it.** The user or session key signs the instruction; the server signs only as fee payer. | Relaying with only an off-chain signature is possible via the Ed25519 program plus instruction introspection. Not needed here. |
| ERC-20 (`IERC20`, `safeTransferFrom`) | SPL Token / **Token-2022** mint + token accounts (ATAs); `transfer_checked` CPI | Use `anchor_spl::token_interface` (`InterfaceAccount<Mint>`, `Interface<TokenInterface>`) so classic USDC and Token-2022 xStocks both work. There's no `approve` then `transferFrom` pull pattern inside one tx: the user signs the transfer directly. |
| ERC-4626 shares (reserves `supply`/`withdraw`) | An SPL mint whose `mint::authority` is the reserve PDA; `mint_to`/`burn` CPIs | You could also track shares in the ledger (simpler, but not composable). |
| ERC-6909 outcome tokens | **`Position` PDA per (window, owner)** (recommended) or 2 SPL mints per window | Mints add 0.00107 SOL each plus an ATA (0.00149 SOL) per user per outcome, which the sponsor pays. |
| `onlyOwner` / `onlyAdmin` | `has_one = admin` or `constraint = config.admin == signer.key()` | The program upgrade authority is a separate key. |
| Contract holds tokens | A token account owned by a **PDA**; the program signs with `CpiContext::new(..).with_signer(&[&[b"vault", &[bump]]])` | Store bumps in the account. |
| Events (`emit X`) | `emit!(X{..})` writes to logs; `emit_cpi!` uses a self-CPI (needs the `event-cpi` feature) | Logs can be truncated (about a 10 KB log cap). Use `emit_cpi!` for anything indexers must not miss. |
| `nonReentrant` | Mostly unnecessary. Solana forbids reentrancy except direct self-recursion. CPI depth is limited to 4. | The real risks are **missing account constraints** (fake accounts passed in), missing signer/owner checks, and PDA seed collisions. |
| `block.timestamp` | `Clock::get()?.unix_timestamp` | Slot time is about 400 ms, and the timestamp can drift by seconds. |
| Gas limit | Compute units: 200k default, 1.4M max via ComputeBudget instructions | Transaction size is 1232 bytes and the account list is limited, so use Address Lookup Tables for big parlays. Reports of 4,096-byte v1 transactions are **UNVERIFIED** for devnet. |
| `revert Error()` | `require!(cond, ErrorCode::X)`, `#[error_code]` | Anchor 1.2 generates TS error constants. |
| Proxy upgrade | Programs are upgradeable in place (upgrade authority); `Migration<From,To>` for account schema changes | Upgrading needs a buffer as big as the binary, so keep SOL on hand. |
| Foundry tests | LiteSVM (TS or Rust), Mollusk (Rust, instruction-level), Surfpool (RPC-compatible local net with mainnet fork) | §1.5 |

### 1.5 Testing

| Tool | Package / version | Use it for |
| --- | --- | --- |
| **LiteSVM** | crate `litesvm` 0.16.0; npm `litesvm` 1.4.1 (kit-based) | Default `anchor init` template. In-process and fast. Lets you `setClock` (window expiry) and write arbitrary accounts (fake USDC, fake Pyth `PriceUpdateV2`). |
| **Mollusk** | `mollusk-svm` 0.15.1 (+ `mollusk-svm-programs-token`) | Rust single-instruction tests and compute-unit benchmarks. Optional. |
| **Surfpool** | `surfpool-core` 1.5.0; install `curl -sL https://run.surfpool.run/ \| bash` | `anchor test`/`localnet` default. RPC on 8899, WS on 8900, Studio on 18488. **Copy-on-read mainnet fork**, so real xStocks mints and Pyth accounts appear locally. Cheatcodes (`surfnet_*`) set token balances and time-travel. |
| `solana-test-validator` | ships with Agave (`agave-validator` 4.2.2) | Legacy; only needed if a template still uses it. |
| `anchor-litesvm` | 0.4.0 | Anchor-flavoured LiteSVM helpers in Rust. |

LiteSVM TS (from litesvm docs, kit-based):
```ts
import { LiteSVM, FailedTransactionMetadata } from "litesvm";
const svm = new LiteSVM();
svm.addProgramFromFile(programAddress, "target/deploy/stocklana.so");
svm.airdrop(payer.address, lamports(2_000_000_000n));
const tx = await pipe(createTransactionMessage({ version: 0 }),
  (m) => setTransactionMessageFeePayerSigner(payer, m),
  (m) => svm.setTransactionMessageLifetimeUsingLatestBlockhash(m),
  (m) => appendTransactionMessageInstruction(depositIx, m),
  (m) => signTransactionMessageWithSigners(m));
const res = svm.sendTransaction(tx); if (res instanceof FailedTransactionMetadata) throw new Error(String(res.err()));
```

### 1.6 Rent and deploy cost (live numbers)

`getMinimumBalanceForRentExemption` on **both devnet and mainnet** today returns 650,240 lamports for 0 bytes and
5,730,240 for 1,000 bytes. That's **5,080 lamports per byte, including the 128-byte header**. So SIMD-0437 step 2 (a 27% cut)
is already live. Steps 3–5 (down to 696 lamports per byte) are expected in November 2026 with Agave 4.4.

| Thing | Bytes | Rent |
| --- | --- | --- |
| Program data for a 300 KB `.so` | 307,200 + 45 | **≈1.56 SOL** |
| Program data for a 500 KB `.so` | 512,000 + 45 | **≈2.60 SOL** |
| Program data for an 800 KB `.so` | 819,200 + 45 | **≈4.16 SOL** |
| Deploy/upgrade **buffer** (temporary, refunded) | same as the binary | You need about **2× in the wallet** during deploy |
| SPL token account / ATA | 165 | 0.00149 SOL |
| Mint | 82 | 0.00107 SOL |
| `UserAccount` PDA (about 120 B) | 120 | 0.00126 SOL |
| 1 KB account (a parlay with legs) | 1,000 | 0.0058 SOL |

Devnet SOL: faucet.solana.com (GitHub login raises the limit; about 5 SOL/day is commonly cited but **UNVERIFIED**), plus the QuickNode
and Chainstack faucets. **Get about 10 SOL on Day 1.** Develop on Surfpool or LiteSVM and deploy to devnet rarely. `solana program close`
reclaims rent.

---

## 2. Client stack (September 2026 reality)

| Layer | Package @ version | Built on | Status |
| --- | --- | --- | --- |
| Core SDK | **`@solana/kit` 8.3.0** (2026-09-09) | — | Officially recommended ("for new work, prefer `@solana/kit` with the kit plugins"). |
| Kit plugins | `@solana/kit-plugin-wallet` 0.20.0, `-rpc` 0.19.0, `-payer` 0.15.1, `-instruction-plan` 0.19.0 | kit | Active. |
| React bindings (official, low-level) | `@solana/react` 8.3.0 | kit + wallet-standard | Hooks like `useWalletAccountTransactionSendingSigner(account, 'solana:devnet')` and `useSignAndSendTransaction`. |
| framework-kit (batteries included) | `@solana/client` 1.7.0 + `@solana/react-hooks` 1.4.1 | kit ^5 | Last published **2026-01-16**. Used by the `kit/nextjs-anchor` and `kit/react-vite` templates. Next.js needs `'use client'`. |
| Legacy | `@solana/web3.js` 1.99.0 (still patched), `@solana/wallet-adapter-react` 0.15.40 (peer web3.js ^1.99), `@solana/spl-token` 0.4.15 | web3.js 1.x | Labelled legacy but still widely used. |
| gill | 0.14.0 (2025-11) | kit | Kit wrapper, gone quiet. Skip. |
| Token program clients | `@solana-program/token` 0.16.1, `@solana-program/token-2022` 0.17.0, `@solana-program/system` 0.14.1, `@solana-program/memo` 0.13.1 | kit | Use these. |
| Program client generation | **`codama` 1.10.2**, `@codama/renderers-js` 2.4.0, `@codama/nodes-from-anchor` 1.5.5 | kit | Generate from the Anchor IDL. |
| Anchor TS | `@anchor-lang/core` 1.2.0 | **web3.js 1.x** (`@solana/web3.js ^1.69.1`) | Fine for scripts. Don't mix into the kit frontend. |
| Compatibility layer | `@solana/web3-compat` 0.0.21 | — | Exists in framework-kit; maturity **UNVERIFIED**. |

**Which SDKs still use web3.js 1.x:** Anchor TS, MagicBlock ER SDK and session keys (`gum-react-sdk` pins `@coral-xyz/anchor ^0.30.1`
and wallet-adapter), Switchboard, `@jup-ag/lend`, `solana-agent-kit`, `@solana/actions`, and Pyth's receiver.
**On kit:** Privy, Kora (`@solana/kit ^6.1`), Swig (`@solana/kit ^2.1`), LiteSVM, Codama output and the official templates.
**Rule:** keep our own code (web + ops) on kit + Codama, and keep web3.js 1.x confined to the ops keeper for Pyth posting.

Codama (from solana.com/docs/programs/codama/clients):
```jsonc
// codama.json
{ "idl": "anchor/target/idl/stocklana.json",
  "scripts": { "js": { "from": "@codama/renderers-js", "args": ["web/src/generated/stocklana"] } } }
```
```bash
npx codama run js    # re-run after every `anchor build`
```
Generated usage follows Codama's usual naming (exact names depend on the IDL): `await getDepositInstructionAsync({ owner: signer, amount: 1_000_000n })`
resolves PDAs, and `await fetchUserAccount(rpc, address)` fetches an account.

Kit transaction (from kit docs):
```ts
const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
const msg = pipe(createTransactionMessage({ version: 0 }),
  (m) => setTransactionMessageFeePayerSigner(signer, m),
  (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
  (m) => appendTransactionMessageInstructions([ixA, ixB], m));
const signed = await signTransactionMessageWithSigners(msg);
await sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })(signed, { commitment: "confirmed" });
```

framework-kit (from its README):
```tsx
'use client';
import { autoDiscover, createClient } from "@solana/client";
import { SolanaProvider, useWalletConnection } from "@solana/react-hooks";
const client = createClient({ endpoint: "https://api.devnet.solana.com", walletConnectors: autoDiscover() });
// <SolanaProvider client={client}> … const { connectors, connect } = useWalletConnection();
```

### 2.1 Wallets and login (the "no seed phrase" UX)

| Option | Package @ version | Social login | Notes |
| --- | --- | --- | --- |
| **Privy** (pick) | `@privy-io/react-auth` 3.42.0; server `@privy-io/node` 0.34.0 | Email, Google, X, … | Solana embedded wallets; peer `@solana/kit >=3.0.3`. Native gas sponsorship covers SVM (`"sponsor": true`, blog 2025-09-24); **devnet support UNVERIFIED**. Kora can use Privy as a signer backend. Template: `mobile/kit-expo-privy`. |
| Phantom Connect | `@phantom/react-sdk` 2.0.2 (+ `@phantom/browser-sdk`, `@phantom/server-sdk`) | Google, Apple | Solana only, 7-day sessions, React >=19.0.1. Templates: `community/phantom-embedded-react`. |
| Dynamic | `@dynamic-labs/sdk-react-core` 5.8.0 | Yes | Heavier bundle. |
| Para | `@getpara/react-sdk` 3.18.0 | Yes | Partnered with Swig smart accounts. |
| Wallet Standard (Phantom, Solflare, Backpack) | `@solana/react` / framework-kit `autoDiscover()` | No | Keep as "connect existing wallet". |
| Mobile | `@solana-mobile/mobile-wallet-adapter-protocol` 2.3.0 | — | Out of scope this week. |

Privy setup (from Privy docs):
```tsx
<PrivyProvider appId={APP_ID} config={{
  loginMethods: ["email", "google", "twitter"],
  embeddedWallets: { solana: { createOnLogin: "users-without-wallets" } },
}}>
// then: import { useWallets, useSignTransaction } from "@privy-io/react-auth/solana";
```
The exact v3 `solana.rpcs` config shape and how to suppress confirmation modals are **UNVERIFIED**. Check docs.privy.io/basics/react/setup.
The session-grant design in §4 means Privy only signs about 2 transactions per user anyway.

---

## 3. Gasless: the ERC-2771 replacement

On Solana, **the fee payer is just another signer**. There's no forwarder or `_msgSender()` trick. The user (or their
session key) signs as the authority on the instruction, and the sponsor signs as fee payer.

| Option | Package @ version | Devnet | Verdict |
| --- | --- | --- | --- |
| **Own co-sign route** | kit | Yes | **Day 2 pick.** About 60 lines. Implements Masayume's Onara rules: whole-transaction allowlist, never sponsor capital intake, and don't let the payer be drained. |
| **Kora** (Solana Foundation) | `kora-cli`/`kora-lib` 2.0.5 (2026-07-29); npm `@solana/kora` 0.2.1 (beta 0.3.0-beta.3) | Yes (self-hosted; any RPC) | Audited by Runtime Verification (per-commit status in `audits/AUDIT_STATUS.md`). `price.type = "free"` for full sponsorship. Signers: memory key, Turnkey, Privy, Openfort. Adopt if time allows. |
| Octane | `anza-xyz/octane` | — | Kora's ancestor. **Don't use.** |
| Privy native sponsorship | Privy dashboard + `sponsor: true` | **UNVERIFIED** | Nice if it works on devnet, but it's opaque, and the docs page still shows the custom fee-payer recipe. |

Kora config and run (from launch.solana.com/docs/kora):
```toml
# kora.toml
[validation]
allowed_programs = ["<STOCKLANA_PROGRAM_ID>", "ComputeBudget111111111111111111111111111111"]
allowed_tokens = ["<tUSDC mint>"]
[validation.price]
type = "free"
[validation.fee_payer_policy.spl_token]
allow_transfer = false
allow_close_account = false
allow_approve = false
# signers.toml:
#   [[signers]]
#   name = "main"
#   type = "memory"
#   private_key_env = "KORA_SIGNER_PRIVATE_KEY"
#   weight = 1
```
```bash
kora rpc --config kora.toml start --signers-config signers.toml
```
```ts
import { KoraClient } from "@solana/kora";
const kora = new KoraClient({ rpcUrl: "http://localhost:8080" });
const { signer_address } = await kora.getPayerSigner();   // set this as the tx fee payer
const signed = await kora.signTransaction({ transaction });  // also signAndSendTransaction, estimateTransactionFee
```

Own route sketch. This is adapted from kit APIs; **verify the function names against kit 8.x**:
```ts
// client: session key signs the instruction; fee payer is the server's address
const msg = pipe(createTransactionMessage({ version: 0 }),
  (m) => setTransactionMessageFeePayer(address(SPONSOR), m),
  (m) => setTransactionMessageLifetimeUsingBlockhash(bh, m),
  (m) => appendTransactionMessageInstructions([tradeIx], m));
const partial = await partiallySignTransactionMessageWithSigners(msg);
await fetch("/api/sponsor", { method: "POST", body: JSON.stringify({ tx: getBase64EncodedWireTransaction(partial) }) });
// server: decode, check EVERY instruction's program is allowlisted, the sponsor isn't a
// token/system authority, then partiallySignTransaction([sponsorKeyPair], tx) and send.
```
**Gotchas:**
- The blockhash expires after about 60–90 s (150 blocks), so co-sign right away.
- **Rent drain.** If the sponsor is the `payer` for `init` accounts, closing them must refund the sponsor
  (store `rent_payer`, use `close = rent_payer`). ATA closes refund the *owner*; Privy documents this drain attack.
- Rate-limit per user.
- Never sponsor `deposit` (Masayume/Yosuku lesson: sponsored capital intake got farmed).

---

## 4. Session keys and bounded permissions (replaces EventVault grants)

| Option | Version | Caps/budget | Expiry | Scope | Verdict |
| --- | --- | --- | --- | --- | --- |
| **Custom `Grant` PDA** in our program | — | **Yes** (per-trade cap, budget, kind) | Yes | Exactly our instructions | **Pick.** It's a direct port of `EventVault.grant/depositAndGrant`. |
| MagicBlock session keys | crate `session-keys` 3.1.1; npm `@magicblock-labs/gum-react-sdk` 3.0.10 | **No.** Authentication only; you'd add caps yourself. | Yes | One target program | Only for game-style "sign as me" flows. Program `KeyspM2ssCJbqUhQ4k7sveSiY4WjnYsrXkC8oDbwde5` (devnet). Brings web3.js + anchor 0.30 + wallet-adapter. |
| SPL Token `approve` | `@solana-program/token` `getApproveCheckedInstruction` | Amount only | **No** | Any program the delegate chooses | One delegate per token account. Too loose for agents. |
| Swig smart wallet | `@swig-wallet/kit` 2.1.0 (2026-06) | SolLimit, TokenLimit, TokenRecurringLimit | Session authorities (duration in slots) | ProgramScope | Strong primitive, audited by Accretion. **AGPL-3.0** licence. The user's wallet becomes a Swig account, which is a big change. Roadmap. |
| Squads Smart Account | program v0.1 (mainnet + devnet); SDK `@sqds/smart-account` (**not found on npm today, UNVERIFIED**) | Spending limits | Session keys | Policies | Overkill for 5 days. |

MagicBlock session keys (from their docs), for reference:
```rust
#[derive(Accounts, Session)]
pub struct Trade<'info> {
  #[account(mut)] pub signer: Signer<'info>,
  #[session(signer = signer, authority = user.authority.key())]
  pub session_token: Option<Account<'info, SessionToken>>,
  #[account(mut)] pub user: Account<'info, UserAccount>,
}
#[session_auth_or(ctx.accounts.user.authority.key() == ctx.accounts.signer.key(), ErrorCode::InvalidToken)]
pub fn trade(ctx: Context<Trade>) -> Result<()> { Ok(()) }
```
```ts
const sessionWallet = useSessionKeyManager(anchorWallet, connection, "devnet");
await sessionWallet.createSession(PROGRAM_ID, 10_000_000 /* top-up lamports */, 60 /* minutes */);
```

**Recommended Stocklana grant design.** This is a design sketch in Anchor 1.x style, not taken from docs:
```rust
#[account] #[derive(InitSpace)]
pub struct Grant { pub owner: Pubkey, pub actor: Pubkey, pub kind: u8,          // 0 SESSION (tap), 1 AGENT, 2 STRATEGY
                   pub max_cost_per_trade: u64, pub budget_remaining: u64, pub expires_at: i64, pub bump: u8 }

#[derive(Accounts)]
pub struct TradeAsActor<'info> {
  pub actor: Signer<'info>,                                                     // msg.sender
  #[account(mut, seeds=[b"grant", grant.owner.as_ref(), &[grant.kind]], bump=grant.bump, has_one=actor)]
  pub grant: Account<'info, Grant>,
  #[account(mut, seeds=[b"user", grant.owner.as_ref()], bump=user.bump)]
  pub user: Account<'info, UserAccount>,
  #[account(mut)] pub window: Account<'info, Window>,
  #[account(init_if_needed, payer=sponsor, space=8+Position::INIT_SPACE,
            seeds=[b"pos", window.key().as_ref(), grant.owner.as_ref()], bump)]
  pub position: Account<'info, Position>,                                      // beneficiary = owner, no param
  #[account(mut)] pub sponsor: Signer<'info>,
  pub system_program: Program<'info, System>,
}
// handler: require!(now < expires_at); require!(cost <= max_cost_per_trade && cost <= budget_remaining);
// user.available -= cost; grant.budget_remaining -= cost; position.owner = grant.owner; emit!(Traded{..})
```
Notes:
- `init_if_needed` requires `anchor-lang = { features = ["init-if-needed"] }`.
- The tap-to-trade session key is a browser-generated keypair stored in IndexedDB. The owner signs one `deposit_and_grant`.
- Agents get kind=AGENT with a runner pubkey held by `services/ops strategy-runner`.
- The no-divert rule holds: `withdraw` pays only the owner's ATA (`associated_token::authority = owner`), and no instruction takes a destination.

---

## 5. Speed and realtime

- **Base layer is enough.** About 400 ms slots with `confirmed` commitment in roughly 1 s beats Somnia-era UX for 1m/5m/1h windows.
- **MagicBlock Ephemeral Rollups** (crate and npm `ephemeral-rollups-sdk` 0.17.0). You mark the program `#[ephemeral]` and delegate accounts with
  `#[delegate]` + `delegate_pda(...)`. Commits go through `MagicIntentBundleBuilder::new(..).commit_and_undelegate(&[..]).build_and_invoke()`.
  Devnet endpoints: router `https://devnet-router.magicblock.app`, ER `https://devnet.magicblock.app`, TEE `https://devnet-tee.magicblock.app`.
  Transactions are zero-fee. Without a fee payer, an account stops after 10 commits.
  **Cut for Stocklana.** Delegated accounts are locked on the base layer, and USDC ledgers inside an ER complicate settlement.
  The only plausible use is a Duel/Candle-Hop game state if games survive the scope cut.
- **Subscriptions** (kit):
  ```ts
  const subs = createSolanaRpcSubscriptions("wss://devnet.helius-rpc.com/?api-key=KEY");
  const it = await subs.accountNotifications(windowAddr, { commitment: "confirmed", encoding: "base64" }).subscribe({ abortSignal });
  for await (const n of it) { /* decode with Codama getWindowDecoder() */ }
  // ops: subs.logsNotifications({ mentions: [PROGRAM_ID] }) → parse Anchor events
  ```
  Public `api.devnet.solana.com` WebSockets are flaky and rate-limited, so use a provider.
- **Helius:**
  - Free plan: 1M credits and 10 RPC req/s.
  - Developer plan ($49/mo): LaserStream (gRPC) on devnet.
  - Business plan ($499/mo): LaserStream with 10 connections. Streaming prices were cut in April 2026.
  - Webhooks: 1 credit per event, 100 credits per create/edit. Enhanced, raw and Discord types. Devnet webhook support is **UNVERIFIED**.
  - LaserStream now powers all Helius WebSockets.
- **Triton:** comparable RPC and gRPC (Dragon's Mouth); pricing not checked.
- **Indexing:** don't build one this week. Use `getProgramAccounts` + `memcmp`/`dataSize` for portfolio lists, and ops `logsNotifications` plus
  Masayume's existing Postgres (`packages/db`) for history. Later option: **Carbon** (`carbon-core` 2.0.0, 2026-09-05), a Rust pipeline of
  datasource → decoder (generated from the Anchor IDL) → processor.

---

## 6. Randomness (Lucky Draw etc.)

| Option | Package | Pattern | Devnet | Notes |
| --- | --- | --- | --- | --- |
| **Keep Masayume HMAC commit-reveal** | `packages/core/src/games/lucky.ts` | Server seed commitment + candidate-set hash, shown before the draw | n/a | **Pick.** No on-chain work. It chooses which window to bet, and the bet itself is a normal trade. |
| MagicBlock VRF | `cargo add ephemeral-rollups-sdk --features anchor,vrf` (0.17.0) | Request with `create_request_scoped_randomness_ix(..)` + `invoke_signed_vrf`, then callback `#[vrf_callback]` (only the VRF program can call it) | Yes. Queue `Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh` (base-layer devnet) | Best upgrade path; works with Anchor 1.x. Cost **UNVERIFIED**. |
| Switchboard On-Demand | crate `switchboard-on-demand` 0.13.0; npm `@switchboard-xyz/on-demand` 3.10.6 | Commit to a slothash (`commitIx`), then `revealIx`. The program checks `seed_slot == clock.slot - 1` and `get_value(slot)`. | Yes | "Take payment at commit, not reveal." Docs cite Anchor 0.31.1, so 1.x compatibility is a risk. |
| ORAO VRF | crate 0.7.0; npm `@orao-network/solana-vrf` 0.8.0 | Request + fulfil | Yes | **Incompatible with Anchor 1.x** (`anchor-lang ^0.32.1`). |

---

## 7. Trade from X: Actions, Blinks and the X API

- **Spec.**
  - Serve `GET` metadata (`title`, `icon`, `description`, `label`, `links.actions[]` with parameters).
  - `POST {account}` returns `{ type: "transaction", transaction: <base64> }`.
  - Chain follow-ups with `links.next`.
  - Host `actions.json` at the domain root, e.g. `{ "rules": [{ "pathPattern": "/w/**", "apiPath": "/api/actions/w/**" }] }`.
  - CORS must be `*`.
  - Debug with the Blinks Inspector.
- **Packages:** `@solana/actions` 1.6.6 (last published 2025-06; web3.js-based helpers `createPostResponse` and `ACTIONS_CORS_HEADERS`),
  `@solana/actions-spec` 2.4.2, `@dialectlabs/blinks` 0.22.5 / `@dialectlabs/blinks-core` 0.20.7 (for rendering blinks in our own UI).
  **Tip:** return the POST JSON yourself with a kit-serialized transaction, and use only the spec types.
- **Unfurling on X in 2026:**
  - Blinks unfurl only through browser extensions: Phantom (**opt-in**, Settings → Experimental Features → Blinks), Backpack or Dialect.
  - Only **registered** actions unfurl (Dialect registry at dial.to/registry; docs updated April 2026).
  - Everyone else sees a plain link, which opens the dial.to interstitial where it still works.
  - **Demo plan:** register early (review takes time), record the demo with Phantom's flag on, and give the link a good OG image fallback.
- **Next.js route:**
  ```ts
  export const GET = () => Response.json({ type: "action", icon, title: "TSLA ≥ $250 at 16:00 ET?", description, label: "Bet",
    links: { actions: [{ type: "transaction", label: "UP $5", href: "/api/actions/w/tsla-1600?side=up&amt=5" }] } },
    { headers: CORS });
  export const OPTIONS = GET;
  export async function POST(req: Request) { const { account } = await req.json();
    return Response.json({ type: "transaction", transaction: await buildTradeTxBase64(account) }, { headers: CORS }); }
  ```
- **X API** (docs.x.com): pure **pay-per-use, no free tier**.
  - Post read: $0.005. User lookup: $0.010. Post create: **$0.015**. Post create **with a URL: $0.20**.
  - Activity API webhook events are billed per event (e.g. `post.create` $0.005).
  - Cap: 3M post reads per month.
  - **Gotcha:** replying to mentions with a blink link costs $0.20 each. Reuse Masayume's `services/ops/src/actors/x-relay`, keep the bot's
    link replies rare, and let users paste the link.

---

## 8. Swaps, xStocks and stablecoins

- **Jupiter** (from developers.jup.ag/docs/llms.txt):
  - Base paths:
    - Swap API **v2** `https://api.jup.ag/swap/v2`: `GET /order` + `POST /execute` (managed), or `GET /build` + `POST /submit`.
    - Tokens **v2** `https://api.jup.ag/tokens/v2`: `/search`, `/tag`, `/category`, `/recent`.
    - Price **v3** `https://api.jup.ag/price/v3?ids=` (up to 50 ids).
    - Lend `https://api.jup.ag/lend/v1`.
    - Trigger v2.
    - **Prediction API v1** `https://api.jup.ag/prediction/v1` (events, markets, orders, positions). This is a competitor and a reference point.
  - **Ultra (`ultra-api.jup.ag`) has migration guides pointing to Swap v2**, and lite-api is being phased out.
  - **Keys:** keyless access gets 0.5 RPS. With a key: free 1 RPS, Developer $25 (10 RPS), Launch $100 (50 RPS), Pro $500 (150 RPS).
    `/execute` has its own bucket (keyless 20 RPS). Send the key in the `x-api-key` header (portal: developers.jup.ag/portal).
  - **Live-verified today, keyless:** `GET /tokens/v2/search?query=TSLAx` returns **`XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB` (Tesla xStock),
    Token-2022, 8 decimals, `isVerified: true`, tags `stocks, rwa, equities, xstocks, verified`**. It also returns several *impostor* TSLAx
    pump mints, so **always filter on `isVerified` + the `xstocks` tag**. `GET /price/v3` works keyless.
  - `@jup-ag/api` 6.0.48 is the old v6 quote client. Just use `fetch`.
  ```ts
  const o = await fetch(`https://api.jup.ag/swap/v2/order?inputMint=${USDC}&outputMint=${TSLAX}&amount=5000000&taker=${user}`,
    { headers: { "x-api-key": KEY } }).then(r => r.json());
  // user signs o.transaction (base64 v0 tx), then POST /swap/v2/execute { signedTransaction, requestId: o.requestId }
  ```
  Exact v2 parameter names (`taker`, `requestId`) are **UNVERIFIED**; they're carried over from Ultra.
- **xStocks gotchas:**
  - They're Token-2022 mints with extensions: **Scaled UI Amount** (a multiplier for splits and dividends, so display via `amountToUiAmount`
    or apply the multiplier), metadata pointer, and pausable/permanent-delegate (introspect the mint).
  - Use `token_interface` in the program.
  - Mainnet only, with no devnet xStocks. Issuer is Backed, acquired by Kraken in December 2025. Geo-restricted for US persons (**UNVERIFIED** detail).
- **Devnet stablecoin:**
  - Circle devnet USDC is `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` (6 decimals), from faucet.circle.com. Rate limits are **UNVERIFIED**.
  - **Recommendation:** mint our own `tUSDC` (classic SPL, 6 decimals) with a program-owned or ops-held mint authority, and reuse Masayume's
    faucet flow (`packages/core/src/faucet`, `packages/db/src/faucet.ts`). Judges can fund themselves in one click. Accept Circle USDC too if trivial.
  - For "buy the underlying" on devnet, create mock `xTSLA`/`xAAPL` Token-2022 mints and a price-oracle-priced mock swap, or show a
    live mainnet Jupiter quote read-only.
- **Oracle** (brief; see the oracle research doc if one exists):
  - `pyth-solana-receiver-sdk` 2.0.0 (Rust); TS `@pythnetwork/hermes-client` 3.1.0 + `@pythnetwork/pyth-solana-receiver` 0.16.0.
  - Hermes lists `Equity.US.AAPL/USD` (feed `49f6b65c…d55688`) with schedule `America/New_York;0930-1600` on weekdays, closed weekends and holidays.
    **Windows must expire inside market hours**, and settlement must require `publish_time >= expiry` (post the update in the settle transaction).
    Equity feeds are probably **not** sponsored on-chain, so the keeper posts updates itself (**UNVERIFIED** per feed).
  - Pyth Pro US equities ($5k/mo) isn't needed for the free core feeds.
  ```rust
  let feed_id = get_feed_id_from_hex("0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688")?;
  let p = ctx.accounts.price_update.get_price_no_older_than(&Clock::get()?, 120, &feed_id)?; // + check publish_time vs expiry
  ```

---

## 9. Yield for "Earn" (brief)

| Option | SDK | Devnet | Verdict |
| --- | --- | --- | --- |
| **House reserves as Earn** (Masayume's Earn is already "supply to a reserve") | our program: `Reserve` + LP share mint | Yes | **Pick.** Real yield from the house edge. No external dependency. |
| Jupiter Lend (Fluid-based; accepts xStocks as collateral) | `@jup-ag/lend` 0.2.0: `getDepositIx`/`getWithdrawIx` from `@jup-ag/lend/earn`; REST `api.jup.ag/lend/v1/earn/deposit`; program `7tjE28izRUjzmxC1QNXnNwcc4N82CNYCexf3k8mw67s3` | Docs show `cluster: "mainnet"` only, so **devnet is UNVERIFIED** | Roadmap "idle USDC → jlUSDC". web3.js 1.x + anchor 0.31. |
| Kamino Lend | `@kamino-finance/klend-sdk` 12.0.0 (`KaminoAction.buildDepositTxns`) | A devnet program ID `KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD` is cited by a third party; **devnet markets UNVERIFIED** | Roadmap. |
| Drift insurance/earn | `@drift-labs/sdk` 2.163.0-beta.13 | Drift has a devnet historically (**UNVERIFIED**) | Skip. |
| "Solana Vault Standard" | — | — | No established standard found. Skip. |

---

## 10. AI agents (brief)

- **Don't adopt an agent kit for trading.** Masayume's `packages/brain` (AI SDK v7 with Anthropic/OpenAI/Google) already decides. The
  runner just builds a Codama instruction (`trade_as_actor`) and signs with its grant key, so caps are enforced on-chain.
- **Solana Agent Kit v2** (SendAI): `solana-agent-kit` 2.0.10 (last published 2025-09). Plugins include `@solana-agent-kit/plugin-token` 2.0.9, plus
  -defi, -nft, -misc and -blinks. It's built on web3.js 1.x with old `ai@4` and langchain dependencies. The MCP server is `sendaifun/solana-mcp`.
  Useful only for a "Sensei can check balances and swap" demo.
- **GOAT SDK:** `@goat-sdk/core` 0.5.0 (last published 2025-05). Stale; skip.
- **Solana Developer MCP** (`https://mcp.solana.com/`, for us while coding): tools `Solana_Expert__Ask_For_Help`,
  `Solana_Documentation_Search`, `get_documentation`, and `program_autofixer` (Anchor/Pinocchio checks). **Add it to Claude Code / Cursor now.**
- **llms.txt:** `https://solana.com/llms.txt` (+ llms-full.txt, SKILL.md and agent skills listed in solana.com's AI guide) and
  `https://developers.jup.ag/docs/llms.txt`. The Context7 ids `/websites/anchor-lang`, `/anza-xyz/kit`, `/litesvm/litesvm`, `/magicblock-labs/docs`
  and `/websites/launch_solana` (covers Kora) all work.

---

## 11. Hackathon fast path

1. **Scaffold** (create-solana-dapp 4.8.5): `npx -y create-solana-dapp@latest -t solana-foundation/templates/kit/nextjs-anchor`.
   You get Next.js 16, React 19, Tailwind 4, `@solana/kit`, `@solana/react-hooks` with wallet-standard auto-discovery, an Anchor
   vault program (a deposit/withdraw SOL vault, already on devnet at `F4jZpgbtTb6RWNWq6v35fUeiAsRJMrDczVPv9U23yXjB`), a Codama client in
   `app/generated/vault`, and LiteSVM tests. Scripts: `npm run setup`, `anchor-build`, `anchor-test`, `codama:js`, `dev`. Run `anchor keys sync`
   before your own deploy. Masayume's web app is already Next.js 16, so **copy the template's `anchor/`, `codama.json` and `lib/wallet` into the
   Masayume `web/` workspace** rather than starting a new web app.
2. Other useful templates (solana-foundation/templates `TEMPLATES.md`): `kit/nextjs` (no program), `kit/nextjs-keychain` (server signing),
   `community/phantom-embedded-react`, `community/lazorkit-starter-next` (passkey wallet), `community/solana-blinks-axum`,
   `community/supabase-solana-indexing`, `mobile/kit-expo-privy`. Legacy `web3js/*` templates use wallet-adapter.
3. **Solana Playground** (`https://beta.solpg.io`) is browser-only with devnet as the default cluster. Handy for a 10-minute Anchor spike. Its
   Anchor version is **UNVERIFIED**.
4. **Toolchain one-liner:** see §1.1. Add the Solana Developer MCP and llms.txt from §10.

---

## 12. Masayume → Solana port map

Masayume leans on **DreamDEX** (a CLOB with ERC-6909 outcome tokens and OracleHub settlement). **Solana has no equivalent programmable
stock-window venue on devnet**, so the biggest new piece is our own market core. Everything else becomes an instruction group in a single
`stocklana` Anchor program.

Effort: S ≤ ½ day, M ≈ 1 day, L ≥ 2 days (for this team, new to Solana).

| Masayume piece | Solana design (accounts / PDAs → key instructions) | Effort | Risk | 5-day call |
| --- | --- | --- | --- | --- |
| **DreamDEX venue** (`IBinaryModule`, ERC-6909, `WindowQuestion`/OracleHub) | `Config["config"]` (admin, tUSDC mint, fee bps, keeper). `Window["window", symbol, expiry]` holds feed id, strike, `up_total`, `down_total`, status and settle price. `Vault` token account `["vault"]` has the PDA as authority. Instructions: `open_window` (keeper; strike from Pyth), `settle_window` (**permissionless**; verifies Pyth `PriceUpdateV2` with `publish_time >= expiry`), `void_window` (after grace, refunds). **Parimutuel Up/Down**: payout = stake × (total − fee) / winning side. It's solvent by construction and needs no pricing engine. | **L** | **High.** Pyth equity market hours, posting updates in the settle tx, and rounding. | **MUST, Day 1–2.** Fixed-odds (house-priced) windows can reuse Range pricing later. |
| **EventVault** (Trading Balance + typed grants) | `UserAccount["user", owner]` (available, locked, totals). `Grant["grant", owner, kind]`. `Position["pos", window, owner]`. Instructions: `deposit` (user pays their own fee, never sponsored), `withdraw` (to owner's ATA only), `grant`/`deposit_and_grant`/`revoke`/`fund_grant`, `trade` (owner signer), `trade_as_actor` (grant actor signer, caps), `claim` (**permissionless**, credits `user.available` of `position.owner`). | **M** | Low–Med. `init_if_needed` rent payer and sponsor drain. | **MUST, Day 1–2.** |
| **ERC2771Forwarder** | **Deleted.** Replaced by `/api/sponsor` (allowlist = `stocklana` program + ComputeBudget; refuse `deposit`) or Kora `kora.toml`. | **S** | Med (fee-payer drain) | **MUST, Day 2.** |
| **StrategyRegistry** | `Strategy["strategy", id]` (creator, runner, envelope caps, fee, spec hash). `Subscription["sub", strategy, subscriber]`. `subscribe` pays the fee (transfer from the user's `available`) and creates or updates a kind=STRATEGY `Grant` with envelope caps in one instruction. `unsubscribe` revokes. | **S–M** | Low | **MUST-ish, Day 3.** It carries the agents and copy-trading story. |
| **ParlayReserve** | `Reserve["reserve", b"parlay"]` (liquid, locked, share mint `["lp", reserve]`), `supply`/`withdraw` (mint and burn LP). `Parlay["parlay", owner, nonce]` with `#[max_len(4)] legs: Vec<Leg{window, side, prob_bps, status}>`. `open_parlay` needs an ed25519 **keeper-signed quote** for probabilities (instruction introspection), or reads parimutuel implied odds from window totals. `resolve_leg` (permissionless) and `claim` (pays owner). | **M–L** | Med. Account-list size (use `remaining_accounts` for windows) and pricing trust. | **STRETCH, Day 4.** Pick Parlay *or* Range, not both. |
| **RangeReserve** | Same `Reserve` pattern. `Round["range", owner, nonce]` with lower/upper band on one window's settle price. `open_range` (keeper-signed price), `settle` from `Window.settle_price`, `void_stale`, `claim`. | **M** | Med. Pricing basis (reuse `packages/core/src/range` off-chain + signed quote). | **STRETCH** (alternative to Parlay). |
| **MarketMakerVault** | No CLOB to quote on. The parimutuel design makes it unnecessary. Earn = Reserve LP. | **L** | High | **CUT** |
| **LeverageReserve** (knock-out boost) | Would need a live mark and a keeper knock-out; parimutuel has no mid-window mark. | **L** | High | **CUT** |
| **PrivateDesk** (link-private bets) | Fresh-keypair slots plus pool hops are possible but heavy, and the privacy claim is weak. | **L** | High | **CUT** (mention as roadmap) |
| **GameArena / ArenaMatches / ArenaAgents** (duel) | `Match["match", id]` side-pot escrow + deck commitment. Picks are normal `trade_as_actor` calls with a kind=GAME grant scoped by `match` and expiry. `settle_match` reads positions. | **M–L** | Med | **CUT** on-chain duel. Keep **Practice** (off-chain) and **Lucky Draw** (off-chain commit + a real trade). |
| **SeasonPrizePool** | `Season["season", id]` + token account. `fund`, `distribute(winners[], amounts[])` (admin, single-shot, `remaining_accounts` for ATAs), `withdraw_remainder`. | **S** | Low | **KEEP only if the Games tab survives**; otherwise cut. |
| **VaultTally** (paged history for Somnia's getLogs limits) | Not needed. `getProgramAccounts` memcmp on `Position.owner` plus the DB. | **S** | Low | **DROP** |
| `ArenaCommitment` / `lucky.ts` commit-reveal | Unchanged, off-chain. Optional: store the commitment hash in `Window` or `Match`, or use MagicBlock VRF. | **S** | Low | **KEEP off-chain** |
| `services/ops` **strategy-runner** | Port from viem to kit + Codama. The signer is the runner key named in STRATEGY grants. `packages/brain` is unchanged. | **M** | Med | **MUST, Day 3** |
| `services/ops` **x-relay** | Keep the X API client. Reply with blink URLs `/w/<symbol>-<expiry>` (costs $0.20 per link post). | **S** | Low–Med (X API cost) | **MUST, Day 3** |
| **New:** `services/ops` **window-keeper** | Cron that calls `open_window` per symbol/interval (inside market hours) and, after expiry, fetches Hermes → `addPostPriceUpdates` → `settle_window` → batch `claim`. Uses web3.js 1.x for the Pyth receiver. | **M** | **High.** Hermes update-at-time and the market-hours calendar. | **MUST, Day 2–3** |
| `market-maker`, `leverage-keeper`, `matchmaker`, `duel-settler`, `duel-projector`, `game-room` actors | — | — | — | **CUT** |
| `packages/markets` (DreamDEX SDK wrapper, addresses) | Replace with `packages/solana`: Codama client, PDA helpers, program id/mints/feeds JSON, Hermes and Jupiter fetchers. | **M** | Med | **MUST, Day 1–2** |
| `web` data layer (wagmi/viem/RainbowKit) | Privy provider + kit RPC/subscriptions + Codama fetchers. Keep routes and components; swap hooks. | **M–L** | Med (the largest UI churn) | **MUST, Day 2–4** |
| Blinks (new) | `/actions.json` + `/api/actions/w/[id]` GET/POST, registered with Dialect | **S** | Low (unfurl reach) | **MUST, Day 3** |
| Jupiter "buy the stock" (new) | Mainnet read-only quote (`/swap/v2/order`) + deep link; devnet mock swap | **S** | Low | **NICE, Day 4** |

### Suggested 5-day sequence

- **Day 1 (Sep 13–14).**
  - Toolchain and devnet SOL.
  - Scaffold from `kit/nextjs-anchor` into the Masayume monorepo.
  - `stocklana` program: `Config`, `UserAccount`, `deposit`/`withdraw`, `Window` `open`/`trade`/`settle` (Pyth), `claim`.
  - LiteSVM tests with a fake `PriceUpdateV2` and `setClock`.
  - Deploy to devnet (keep about 5 SOL).
- **Day 2.** `Grant` + `trade_as_actor`. Sponsor route. Privy login plus a session keypair. Codama client wired into the trade UI. Window-keeper v1.
- **Day 3.** StrategyRegistry + strategy-runner port. Blink action + registry submission. x-relay wired to blink links.
- **Day 4.** Earn reserve (LP) + one specialist ticket (Parlay *or* Range). Jupiter quote card. Polish and error states.
- **Day 5 (Sep 18).** Freeze the program, rehearse the demo **during US market hours**, record, write docs. No program upgrades after midday.

### Top risks to watch

1. **Equity oracle hours.** Weekend or after-hours windows can't settle, so the demo schedule must respect NY hours (UTC−4 in September).
2. **Anchor 1.x ecosystem skew.** Tutorials, LLM output and some crates target 0.3x. Pin versions and use the Solana MCP `program_autofixer`.
3. **Two JS worlds.** Kit (our code, Privy, Kora) vs web3.js 1.x (Pyth receiver, MagicBlock, Anchor TS). Keep web3.js inside ops.
4. **Sponsor drain and rent.** Store `rent_payer`, close accounts back to the sponsor, rate-limit.
5. **Devnet SOL.** Program data rent is about 1.5–4 SOL per deploy, and upgrades need a buffer. Get SOL early.

---

## Sources

Registries (queried 2026-09-13): npm registry (`npm view`) for all npm versions and dependencies; crates.io API
`https://crates.io/api/v1/crates/<name>` (+ `/<ver>/dependencies`); live RPC `getMinimumBalanceForRentExemption` on
`https://api.devnet.solana.com` and `https://api.mainnet-beta.solana.com`; live `https://api.jup.ag/tokens/v2/search?query=TSLAx`,
`https://api.jup.ag/price/v3`, `https://hermes.pyth.network/v2/price_feeds?query=AAPL&asset_type=equity`.

- Anchor 1.0.0 release notes — https://www.anchor-lang.com/docs/updates/release-notes/1-0-0
- Anchor releases — https://github.com/solana-foundation/anchor/releases
- Anchor 1.2.0 changelog — https://raw.githubusercontent.com/solana-foundation/anchor/v1.2.0/CHANGELOG.md
- Anchor installation — https://www.anchor-lang.com/docs/installation
- Anchor token CPI docs — https://www.anchor-lang.com/docs/tokens/basics/transfer-tokens
- Solana Devs on Anchor v1 — https://x.com/solana_devs/status/2039837963840803283
- Surfpool — https://solana.com/docs/tools/surfpool , https://github.com/solana-foundation/surfpool
- LiteSVM — https://github.com/litesvm/litesvm
- Reduced rent / SIMD-0437 — https://solana.com/upgrades/reduced-rent , https://solanacompass.com/news/simd-0437-step-1-goes-live-on-solana-mainnet-beginning-a-five-phase-rent-reduction
- Solana frontend docs — https://solana.com/docs/frontend , https://solana.com/docs/frontend/react-hooks
- framework-kit — https://github.com/solana-foundation/framework-kit
- Kit docs — https://github.com/anza-xyz/kit (transactions, signers, react README)
- Codama clients — https://solana.com/docs/programs/codama/clients , https://github.com/codama-idl/codama
- nextjs-anchor template — https://solana.com/developers/templates/nextjs-anchor
- Templates list — https://github.com/solana-foundation/templates/blob/main/TEMPLATES.md
- Kora — https://solana.com/docs/tools/kora/getting-started , https://launch.solana.com/docs/kora , https://launch.solana.com/docs/kora/operators/configuration , https://launch.solana.com/docs/kora/guides/kit-client , https://launch.solana.com/docs/kora/getting-started/quick-start , https://github.com/solana-foundation/kora
- Octane — https://github.com/anza-xyz/octane
- BlockEden on Kora — https://blockeden.xyz/blog/2026/04/22/solana-kora-signing-node-fee-relayer-gasless-ux-primitive/
- Privy Solana sponsorship — https://docs.privy.io/wallets/gas-and-asset-management/gas/solana , https://privy.io/blog/introducing-privy-native-gas-sponsorship
- Privy setup — https://docs.privy.io/basics/react/setup , https://docs.privy.io/recipes/solana/getting-started-with-privy-and-solana
- Phantom Connect — https://docs.phantom.com/wallet-sdks-overview
- MagicBlock session keys — https://docs.magicblock.gg/pages/tools/session-keys/integrating-sessions-in-your-program , https://github.com/magicblock-labs/docs (session-keys usage examples)
- Swig — https://github.com/anagrambuild/swig-wallet , https://build.onswig.com/
- Squads smart account — https://squads.xyz/blog/squads-smart-account-program-live-on-mainnet , https://github.com/Squads-Protocol/smart-account-program
- MagicBlock ER quickstart — https://docs.magicblock.gg/pages/ephemeral-rollups-ers/how-to-guide/quickstart
- MagicBlock VRF quickstart — https://docs.magicblock.gg/pages/verifiable-randomness-functions-vrfs/how-to-guide/quickstart
- Switchboard randomness — https://docs.switchboard.xyz/docs-by-chain/solana-svm/randomness/randomness-tutorial
- Helius — https://www.helius.dev/docs/billing/plans , https://www.helius.dev/pricing , https://www.helius.dev/docs/webhooks , https://www.helius.dev/blog/laserstream-websockets
- Carbon — https://github.com/sevenlabs-hq/carbon
- Actions & Blinks — https://solana.com/docs/tools/actions , https://docs.phantom.com/developer-powertools/solana-actions-and-blinks , https://docs.dialect.to/blinks/blinks-provider/blink-registry
- X API pricing — https://docs.x.com/x-api/getting-started/pricing
- Jupiter — https://developers.jup.ag/docs/swap , https://developers.jup.ag/docs/llms.txt
- Jupiter Lend SDK — https://github.com/jup-ag/jupiter-lend/blob/main/docs/earn/sdk.md
- Kamino klend-sdk — https://github.com/Kamino-Finance/klend-sdk
- Circle testnet USDC — https://developers.circle.com/stablecoins/docs/usdc-on-testing-networks , https://faucet.circle.com
- xStocks — https://solana.com/news/case-study-xstocks , https://blockeden.xyz/blog/2025/09/03/xstocks-on-solana-a-developer-s-field-guide-to-tokenized-equities/ , https://solanacompass.com/news/solana-tokenized-equity-value-hits-535m-all-time-high-as-jupiter-lend-crosses-20m-in-xstocks-deposits
- Pyth on Solana — https://docs.pyth.network/price-feeds/use-real-time-data/solana
- Pyth Pro report — https://solanacompass.com/news/pyth-pro-reaches-749m-arr-in-july-with-22-monthly-growth-and-3501-market-feeds
- Solana Agent Kit v2 — https://docs.sendai.fun/docs/v2/introduction , https://github.com/sendaifun/solana-agent-kit , https://github.com/sendaifun/solana-mcp
- Solana Developer MCP / AI — https://mcp.solana.com/ , https://github.com/solana-foundation/solana-mcp-official , https://solana.com/llms.txt , https://solana.com/developers/guides/getstarted/intro-to-ai
- Faucets — https://faucet.solana.com/ , https://solana.com/developers/cookbook/development/airdrops-and-faucets
- Solana Playground — https://beta.solpg.io , https://www.anchor-lang.com/docs/quickstart/solpg
- Masayume local sources — `/Users/abu/dev/hackathon/sommina-events/README.md`, `context/14-yosuku-contracts-and-services.md`, `contracts/src/**` (EventVault, StrategyRegistry, ParlayReserve, RangeReserve, MarketMakerVault, LeverageReserve, PrivateDesk, GameArena, SeasonPrizePool), `services/ops/src/actors/*`, `packages/core/src/games/lucky.ts`, `web/package.json`
