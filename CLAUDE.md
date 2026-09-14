# Agari (上がり) — agent guide

Stock-price Up/Down prediction market on Solana: a source-led port of Masayume (`reference/masayume` @ `68f7a09`, the only design authority).

## Read order (every session, before editing)

1. This file.
2. `docs/plan/STATUS.md`: the single resume pointer. **Never trust memory over STATUS.md.**
3. The current stage file `docs/plan/stage-NN-*.md`: first unchecked box, then `## Handoff`.
4. The last 10 `D-` entries and all open `Q-` in `docs/plan/decisions.md`.
5. Only the `docs/plan/00-plan.md` sections the stage names, then the stage's "Open first" sources.
6. Run `git status && git log --oneline -5`, confirm HEAD matches STATUS, and run the fast gate.

## Rules

- **Package manager:** pnpm only (`pnpm add`, `pnpm dlx`); no npm/npx/yarn/bun lockfiles.
- **File size:** at most 400 lines (TS/TSX/CSS/RS/MJS), target 300.
- **Boundaries:**
  - Only `packages/markets` imports `@solana/*`, `@solana-program/*`, `@agari/clients`, `@pythnetwork/*`, `@switchboard-xyz/*`, and only it sends transactions.
  - `packages/core` stays pure.
- **Money:** integer base units; YES ticks `u16`; lots `u64`; no floats.
- **Tests:** not a deliverable. Targeted tests only where money or settlement correctness is in doubt.
- **Libraries:** research with Context7 first; performance-first choices.
- **Secrets:** never print or commit them. Data-provider keys are server-only. Keypairs live in `~/.config/agari/`.
- **CLI:** `NO_DNA=1 anchor …`, `NO_DNA=1 surfpool …`. New shells need `~/.local/share/solana/install/active_release/bin`, `~/.avm/bin`, `~/.surfpool/bin` on PATH. Never run `avm use` or `agave-install` casually.
- **Commits:** one per step, `<type>(S<n>.<step>/<area>): <summary>`, trailers `Stage:` and `Parity:`. Tick the stage checkbox in the same commit. Never end a session dirty (`wip(...)`).
- **Evidence:** every devnet transaction goes in `docs/plan/acceptance.md`; `parity.md` advances only at stage gates.

## Gates

- **Fast:** `pnpm typecheck && pnpm invariants`
- **Web:** `pnpm build`
- **Programs:** `NO_DNA=1 anchor build --arch v0` (from S0 scaffold on). Anchor 1.2 defaults to `--arch v3`, which devnet and mainnet reject until SBPFv3 activates (D-024).
