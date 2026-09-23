# S22 — The desk, redesigned: a cockpit with a value chart and tabs, a visual studio, an activity timeline

**Goal:** the user's 2026-09-23 verdict on the S21 desk surfaces was "mediocre": text-only basket cards, raw number boxes, no logos, no tabs, no chart, a record that reads as a wall of text. Rebuild every desk surface from real 21st catalogue components in Masayume's tokens (D-081, D-127). Plan: `~/.claude/plans/vectorized-dazzling-fairy.md`. Branch `../agari-wt/s22` on `slice/S22-desk-ux`.

## Steps

- [x] **0 kit** (`feat(S22.0/web)`): `web/src/components/ui/desk-kit/` — tabs, number ticker, slider, radio cards, status dot, donut, partition bar, radial gauge, sparkline, logo stack, timeline, step progress, empty state, area chart; `@number-flow/react`; D-127.
- [x] **1 data** (`feat(S22.1/data)`): `snapshotSeries` in `@agari/db`, `series` on the desk view wire, `seriesInRange` (+ test), holdings' price history, `/api/desk/marks` + `useDeskMarks` (basket lines via `basketIndexE8`), fixtures `series` and `fresh`.
- [x] **2 studio basket** (`feat(S22.2/web)`): logo radio cards with the live basket line and "Build your own"; the weight editor (logo chips, sliders, partition bar, donut, Even split, Reset).
- [x] **3 studio frame** (`feat(S22.3/web)`): step progress, limits as sliders and radio cards, the test read as an activity stream, the create receipt, the side card.
- [x] **4 cockpit** (`feat(S22.4/web)`): header, value hero + chart + ranges, next-check strip, tabs Overview · Holdings · Activity · Rules.
- [x] **5 timeline + record + decision** (`feat(S22.5/web)`): the shared activity timeline with filters and day groups, `/record`, the visual decision page.
- [x] **6 entry + states** (`feat(S22.6/web)`): `/desk` for a visitor with no desk (hero, the judges' desk preview), empty and loading states.
- [ ] **7 sweep** (`chore(S22.7/web)`): `21st review --strict`, both themes at 390/768/1440, keyboard, dead CSS removed; merge, Coolify web deploy, live capture.

## Handoff

Read STATUS on `integration/w1`, then this file. Gate per step: `pnpm typecheck && pnpm invariants`; web steps `pnpm build`; vitest from the repo root. Screens: the scratchpad CDP script against `/dev/desk` and `/desk/new` at 390 and 1440, both themes.
