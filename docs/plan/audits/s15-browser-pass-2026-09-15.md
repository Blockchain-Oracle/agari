# S15 browser pass — 2026-09-15 (closed market, after hours)

Stage-owner record for the S15 "Browser pass" box. The chrome-devtools MCP browser profile stayed locked by another session all evening, so every pass used headless Chrome over the DevTools protocol with its own throwaway profile and port (`Emulation.setDeviceMetricsOverride`, the `agari_theme` localStorage key per job). The market was closed, so every page shows its after-hours state; the open-state capture of `/` is Wednesday's (D-097).

## 1. Lane passes (before merge)

| Surface | Widths × themes | Checks | Result | Owner |
| --- | --- | --- | --- | --- |
| `/` landing | 320 / 390 / 768 / 1440 × dark, light | no horizontal overflow; dial chart, three lanes and five settled Windows loaded | pass | lane 15a (`slice/S15a-landing` 51c1148) |
| `/opengraph-image`, `/twitter-image`, `/tickers/{TSLA,SPY,QQQ}/opengraph-image`, `/markets/{settled, unknown, malformed}/opengraph-image` | 1200 × 630 PNG | 200 `image/png`; ticker with no archive renders without a price; unknown id renders the fallback | pass | lane 15a |
| `/how-it-works`, `/demo`, `/pitch`, `/download`, `/native-auth` | 320 / 390 / 768 / 1440 × dark, light (40 captures) | no overflow, no console errors, no failed requests, no visible "masayume" | pass (one light-theme contrast bug in the demo notice found and fixed, 4d16ff4) | lane 15b |
| `/markets` with `AGARI_REGION_OVERRIDE=US` and without | 390 / 1440 × dark, light | restricted CTA, note and link present with the override; normal ladder without | pass (note link underline fixed) | lane 15d |

## 2. Merged build on `:3000` (`integration/w1` e7daa51, S15 + S18)

24 captures: 6 routes × 390 (mobile, touch) and 1440 × dark and light, 4.5 s settle each. Per capture: `scrollWidth − innerWidth`, visible text matching /masayume/i, the text "LOADING", console errors, responses ≥ 400.

| Route | h1 | 390 dark | 390 light | 1440 dark | 1440 light |
| --- | --- | --- | --- | --- | --- |
| `/` | Up or down. Call the close. | ok, advice line shown | ok, advice line shown | ok, advice line shown | ok, advice line shown |
| `/how-it-works` | How It Works | ok | ok | ok | ok |
| `/demo` | See Agari work. | ok | ok | ok | ok |
| `/pitch` | (slide deck, no h1; cover checked by eye) | ok | ok | ok | ok |
| `/download` | Call it in ten seconds. | ok | ok | ok | ok |
| `/native-auth` | Native sign-in | ok | ok | ok | ok |

0 of 24 flagged. Screenshots: session scratchpad `s15-gate/`.

## 3. Observations (not defects of S15 surfaces)

- The app shell leaves a tall blank band under the footer at 1440 on every page, `/markets` included (shared shell bottom padding for the phone tab bar); recorded for S17's route-by-route pass.
- `/markets/[id]` still redirects to `/markets`, so per-market Open Graph images exist but are not used by shared market links until that route renders.
- The Next dev overlay's "1 Issue" badge (dev only) comes from React's performance tracer and appears on `/markets` too.
