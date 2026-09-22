# Re-audit: "waiting on the bell" — 2026-09-22 07:1xZ

A previous session filed ten Partial rows as blocked until the 13:30Z NYSE open. The user asked for
that list to be re-checked. It was, against the running venue rather than against the note.

## What the venue actually offers out of hours

Read at 07:05Z, roughly six hours before the bell, with `scripts/drive/x-round-trip.ts lanes`:

- **28 live Windows.** One is `OPENAI 3600s` on the **token** lane and reads `printed`. The other 27
  are the Regular lanes, listed for 13:35Z / 13:45Z / 15:00Z and all reading `open print pending`.
- The seed maker **quotes the pre-IPO lane around the clock**. At `07:00:38Z`, three seconds after
  Window #49 opened, it rested `bid 471 / ask 531 × 5000` around fair 501 — its own heartbeat says
  `session closed` on the same line.

So out of hours the venue has **exactly one enterable Window**, not zero and not 28. That single fact
decides nine of the ten rows one way and the tenth the other.

## Row by row

| Row | Filed as | What the gap actually is | Bell? |
|---|---|---|---|
| L-08 | waiting on the bell | a signing wallet in a browser on any live Window. The Wallet Standard/CDP harness already did L-52's pass | **No** |
| L-33 | waiting on the bell | a **voided** Window seen in a browser. Voids occur on the 24/7 lane already (parlay ticket #9 voided on a missed print, 09-20 06:11Z) and Series 903 is drive-owned for forcing one any hour | **No** |
| L-36 | waiting on the bell | **code**: the ticket centres its band on live spot while the reserve prices from the Window's opening print, so it refuses every width on a moved Window (D-119). Then a wallet pass | **No** — and it is a code gap, not an evidence gap |
| L-37 | waiting on the bell | a void settlement (as L-33) and PD-2's oracle bound (D-109, unbuilt) | **No** |
| L-38 | "two Windows that print (Mon 09-21)" | `OPENAI-60m` prints **every hour, around the clock**; #9 and #10 both printed on 09-20. The builder also has not been driven by hand | **No** — and that date has already passed |
| L-39 | "first weekday session" | L-37 was already proven on the maker-quoted `OPENAI-60m` lane; the same lane serves this. Plus the ticket's private mode (code) | **No** |
| L-42 | "needs a fill on a TSLA Window" | a fill in *a* ticker room, not TSLA's. The maker is resting both sides on OPENAI now | **No** (confirm a pre-IPO ticker hub carries a room) |
| L-52 | waiting on the bell | a browser pass over the studio's progress copy. It names no Window at all | **No** — mis-filed |
| L-63 | "a deck needs three live Windows and the venue has none out of hours" | **Real, but for a different reason.** The venue has *one* enterable Window out of hours, not none. A deck needs three at once: either the bell supplies them, or two more drive-owned Windows do | **Partly** |
| L-67 | waiting on the bell | **code**: D-119 again — the same open-versus-spot centring as L-36 | **No** |

**Nine of ten are not bell-blocked.** Three are code gaps (L-36, L-67 on D-119; L-37 and L-38 also
carry D-109). L-63 needs three *enterable* Windows at once, which the bell supplies for free and two
more drive-owned Windows would supply at any hour.

## The X rows were not evidence gaps either

L-58, L-59, L-60 and A-3d were filed as blocked on "the Agari X account". Driving them found two
defects that no account would have fixed. Both are fixed on this branch:

1. **`selectXWindow` filtered `lane === "regular"`** (`packages/core/src/x/window.ts`). No pre-IPO
   name is ever listed on Regular — D-103 lists them on the 24/7 token lane — so every
   `@… OPENAI …` mention refused `no-window`, and the X rail could only trade inside a NYSE session.
   The Blink path already asked the question correctly via `actionLane`; both now share it.
2. **`X_MONETARY_CEILING` was `(1n << 128n) - 1n`** (`packages/core/src/x/grant-policy.ts`) while the
   deployed vault stores `max_stake_per_trade` as **u64** (IDL `CapsArgs`, `instructions/grants.rs:20`,
   and the state layout test pins 8 bytes). Every X grant was refused by the codec before it left the
   browser, and `isBalanceOnlyXGrant` compared live grants against a value none could hold. Nothing
   could authorize, so nothing could trade.

`X_API_KEY` / `X_API_KEY_SECRET` (the OAuth 1.0a consumer pair) remain genuinely absent — not in this
repo and not in the Masayume reference, which carries only commented placeholders. They gate
**Sign in with X** (L-59) alone.
